import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Installation } from "@slack/bolt";
import type { PendingRequest } from "@/lib/database";
import type { ThreadSignInContext } from "@/lib/sign-in-context";
import type { SlackRequest } from "@/lib/slack-request";
import type { RequestSignal } from "@/lib/requests";

const mocks = vi.hoisted(() => ({
  installations: new Map<string, Installation>(),
  users: new Set<string>(),
  requests: new Map<string, PendingRequest>(),
  calls: [] as { method: string; body: object }[],
  resumeHook: vi.fn(),
  cancel: vi.fn(),
  getRun: vi.fn(),
  markUninstalling: vi.fn(),
  removeInstallation: vi.fn(),
  signOut: vi.fn(),
  getConflict: vi.fn(),
  createHook: vi.fn(),
  disposeHook: vi.fn(),
  beforeSignal: vi.fn(),
  signals: [] as RequestSignal[],
  slackError: undefined as Error | undefined,
  dispatch: vi.fn(),
}));

vi.mock("workflow/api", () => ({ resumeHook: mocks.resumeHook, getRun: mocks.getRun }));
vi.mock("workflow", () => ({
  createHook: mocks.createHook,
  getWorkflowMetadata: () => ({ workflowRunId: "run-a" }),
  getStepMetadata: () => ({ stepId: "step-hello" }),
}));
vi.mock("@/workflows/dispatch", () => ({ dispatchRequest: mocks.dispatch }));
vi.mock("@/lib/database", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/database")>();
  return {
    ...actual,
    getInstallation: async (id: string) => mocks.installations.get(id),
    isSignedIn: async (id: string, user: string) => mocks.users.has(`${id}:${user}`),
    signInUser: async (id: string, user: string) => {
      mocks.users.add(`${id}:${user}`);
    },
    signOutUser: mocks.signOut,
    getRequest: async (id: string) => mocks.requests.get(id),
    rememberRequest: async (row: PendingRequest) => {
      if (!mocks.installations.has(row.installationId)) return false;
      mocks.requests.set(row.runId, { ...row, promptTs: row.promptTs ?? null });
      return true;
    },
    setPromptTimestamp: async (id: string, ts: string) => {
      mocks.requests.get(id)!.promptTs = ts;
    },
    listPendingRequests: async (id: string, user?: string) =>
      [...mocks.requests.values()].filter(
        (row) => row.installationId === id && (!user || row.userId === user),
      ),
    forgetRequest: async (id: string) => {
      mocks.requests.delete(id);
    },
    markInstallationUninstalling: mocks.markUninstalling,
    removeInstallation: mocks.removeInstallation,
  };
});
vi.mock("@/lib/slack", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/slack")>()),
  slackApi: async (_id: string, method: string, body: object) => {
    mocks.calls.push({ method, body });
    if (mocks.slackError) throw mocks.slackError;
    return { ts: "200.000001" };
  },
  homeClient: () => ({
    views: {
      publish: async (body: object) => {
        mocks.calls.push({ method: "views.publish", body });
      },
    },
  }),
}));

import { EntityConflictError, HookNotFoundError } from "workflow/errors";
import { completeSignIn, goBack } from "@/lib/sign-in";
import {
  handleRequestAction,
  refreshPendingRequests,
  signalRequest,
  uninstallInstallation,
} from "@/lib/requests";
import { beginRequest, resolveRequest } from "@/workflows/sign-in-steps";
import { signInMiddleware } from "@/workflows/sign-in-middleware";
import { handleRequest } from "@/workflows/request";
import { matchesSignIn } from "@/lib/sign-in-matcher";
import { actionRequestId } from "@/lib/slack-request";

const input: ThreadSignInContext = {
  userId: "U1",
  teamId: "T1",
  isEnterpriseInstall: false,
  channel: "C1",
  ts: "100.000001",
};
const request = {
  ...input,
  type: "event",
  id: "Ev1",
  body: { type: "event_callback", team_id: "T1", event_id: "Ev1", event: { text: "hello" } },
  event: {
    type: "app_mention",
    user: "U1",
    channel: "C1",
    ts: input.ts,
    text: "hello",
    event_ts: input.ts,
  },
} satisfies SlackRequest;
const actionRequest = {
  ...input,
  type: "action",
  id: "click-1",
  body: {
    type: "block_actions",
    actions: [{ action_id: "hello.say", value: "original-value" }],
    state: { values: { selected: "original-state" } },
  },
  action: {
    type: "button",
    action_id: "hello.say",
    block_id: "hello-block",
    action_ts: "300.1",
    text: { type: "plain_text", text: "Say hello" },
    value: "original-value",
  },
} satisfies SlackRequest;
function pending(runId = "run-a", ts = "100.000001"): PendingRequest {
  const row = {
    runId,
    hookToken: `hook:${runId}`,
    installationId: "T1",
    userId: "U1",
    channel: "C1",
    ts,
    promptTs: `200.${runId}`,
  };
  mocks.requests.set(runId, row);
  return row;
}
const home = { userId: "U1", teamId: "T1", isEnterpriseInstall: false, home: true as const };
const actionInput = (row: PendingRequest) => ({
  requestId: row.runId,
  installationId: row.installationId,
  userId: row.userId,
  channel: row.channel,
  ts: row.promptTs!,
});

beforeEach(() => {
  mocks.installations.clear();
  mocks.users.clear();
  mocks.requests.clear();
  mocks.calls.length = 0;
  mocks.installations.set("T1", {
    team: { id: "T1", name: "Test" },
    enterprise: undefined,
    user: { id: "UINSTALL", token: undefined, scopes: undefined },
    appId: "A1",
  });
  mocks.resumeHook.mockReset();
  mocks.cancel.mockReset();
  mocks.getRun.mockReset();
  mocks.signOut.mockReset();
  mocks.markUninstalling.mockReset();
  mocks.removeInstallation.mockReset();
  mocks.getConflict.mockReset();
  mocks.createHook.mockReset();
  mocks.disposeHook.mockReset();
  mocks.beforeSignal.mockReset();
  mocks.slackError = undefined;
  mocks.dispatch.mockReset();
  mocks.dispatch.mockImplementation(async (original: SlackRequest) => {
    expect(mocks.requests.size).toBe(0);
    mocks.calls.push({ method: "dispatch", body: original.body });
  });
  mocks.signals = [{ type: "cancel", reason: "sign-in" }];
  mocks.getRun.mockReturnValue({ cancel: mocks.cancel, status: Promise.resolve("running") });
  mocks.getConflict.mockResolvedValue(null);
  mocks.createHook.mockImplementation(({ token }: { token: string }) => ({
    token,
    getConflict: mocks.getConflict,
    [Symbol.dispose]: mocks.disposeHook,
    async *[Symbol.asyncIterator]() {
      for (const signal of mocks.signals) {
        await mocks.beforeSignal(signal);
        yield signal;
      }
    },
  }));
});

describe("web sign-in", () => {
  it("Home sign-in refreshes every pending request without continuing any", async () => {
    pending();
    pending("run-b", "100.000002");
    const links = await completeSignIn(home);
    expect(mocks.users.has("T1:U1")).toBe(true);
    expect(mocks.resumeHook.mock.calls).toEqual([
      ["hook:run-a", { type: "refresh" }],
      ["hook:run-b", { type: "refresh" }],
    ]);
    expect(mocks.requests.size).toBe(2);
    expect(mocks.calls[0].method).toBe("views.publish");
    expect(links.app).toContain("tab=home");
  });

  it("thread sign-in continues one request and refreshes the other request in the same thread", async () => {
    pending();
    pending("run-b", "100.000002");
    const links = await completeSignIn({ ...input, requestId: "run-a" });
    expect(mocks.resumeHook.mock.calls).toEqual([
      ["hook:run-a", { type: "continue" }],
      ["hook:run-b", { type: "refresh" }],
    ]);
    expect(links.app).toContain("message=100.000001");
    expect(mocks.requests.size).toBe(2);
  });

  it("thread Go Back cancels only its request without signing the user out", async () => {
    pending();
    pending("run-b", "100.000002");
    mocks.users.add("T1:U1");
    await goBack({ ...input, requestId: "run-a" });
    expect(mocks.resumeHook).toHaveBeenCalledExactlyOnceWith("hook:run-a", {
      type: "cancel",
      reason: "sign-in",
    });
    expect(mocks.signOut).not.toHaveBeenCalled();
    expect(mocks.users.has("T1:U1")).toBe(true);
  });

  it("Home Go Back has no auth, message, or request side effects", async () => {
    pending();
    await goBack(home);
    expect(mocks.resumeHook).not.toHaveBeenCalled();
    expect(mocks.calls).toEqual([]);
    expect(mocks.signOut).not.toHaveBeenCalled();
    expect(mocks.requests.size).toBe(1);
  });
});

describe("request routing", () => {
  it.each(["userId", "installationId", "channel", "ts"] as const)(
    "rejects a Slack action with the wrong %s",
    async (field) => {
      const row = pending();
      await handleRequestAction({ ...actionInput(row), [field]: "other" }, { type: "continue" });
      expect(mocks.resumeHook).not.toHaveBeenCalled();
    },
  );

  it("refresh fan-out excludes the selected request and stays within the user", async () => {
    pending();
    pending("run-b", "100.000002");
    const other = pending("run-other");
    other.userId = "U2";
    await refreshPendingRequests("T1", "U1", "run-a");
    expect(mocks.resumeHook).toHaveBeenCalledExactlyOnceWith("hook:run-b", { type: "refresh" });
    expect(mocks.requests.size).toBe(3);
  });

  it("a completion race removes a stale directory entry", async () => {
    const row = pending();
    mocks.resumeHook.mockRejectedValueOnce(new HookNotFoundError(row.hookToken));
    await signalRequest(row, { type: "refresh" });
    expect(mocks.requests.has(row.runId)).toBe(false);
  });
});

describe("workflow steps", () => {
  it("a stale Continue after sign-out renders Sign In and remains waiting", async () => {
    pending();
    expect(await resolveRequest(input, "run-a", { type: "continue" })).toBe("waiting");
    expect(mocks.calls.at(-1)?.body).toMatchObject({
      text: "Waiting for <@U1> to sign in before continuing.",
    });
    expect(mocks.requests.size).toBe(1);
  });

  it.each([
    ["sign-in", "<@U1> cancelled sign-in"],
    ["request", "<@U1> cancelled the request"],
  ] as const)(
    "%s cancellation preserves login and has the correct message",
    async (reason, text) => {
      pending();
      mocks.users.add("T1:U1");
      expect(await resolveRequest(input, "run-a", { type: "cancel", reason })).toBe("cancelled");
      expect(mocks.calls.at(-1)?.body).toMatchObject({ text });
      expect(mocks.signOut).not.toHaveBeenCalled();
      expect(mocks.users.has("T1:U1")).toBe(true);
    },
  );

  it("posting retries delete an existing prompt if the user has since signed in", async () => {
    pending();
    mocks.users.add("T1:U1");
    expect(await beginRequest(input, "run-a")).toBe("ready");
    expect(mocks.calls).toEqual([
      { method: "chat.delete", body: { channel: "C1", ts: "200.run-a" } },
    ]);
  });

  it("claims the hook before posting, routes its cancellation, and cleans its directory", async () => {
    expect(await handleRequest(request)).toEqual({ status: "stopped" });
    expect(mocks.getConflict).toHaveBeenCalledTimes(2);
    expect(mocks.calls.map((c) => c.method)).toEqual([
      "chat.postMessage",
      "chat.update",
      "chat.update",
    ]);
    expect(mocks.calls.at(-1)?.body).toMatchObject({ text: "<@U1> cancelled sign-in" });
    expect(mocks.requests.size).toBe(0);
  });

  it("a duplicate hook owner skips all database and Slack effects", async () => {
    mocks.getConflict.mockResolvedValueOnce({ runId: "already-started" });
    expect(await handleRequest(request)).toEqual({ status: "duplicate", runId: "already-started" });
    expect(mocks.calls).toEqual([]);
    expect(mocks.requests.size).toBe(0);
  });
});

describe("sign-in middleware", () => {
  it("unmatched requests pass through without auth side effects", async () => {
    expect(await signInMiddleware(request, { matcher: [{ action_id: "hello.say" }] })).toBe(true);
    expect(mocks.calls).toEqual([]);
    expect(mocks.createHook).not.toHaveBeenCalled();
    expect(mocks.requests.size).toBe(0);
  });

  it("signed-in requests reach the handler without an auth prompt", async () => {
    mocks.users.add("T1:U1");
    expect(await handleRequest(request)).toEqual({ status: "completed" });
    expect(mocks.calls).toEqual([{ method: "dispatch", body: request.body }]);
    expect(mocks.dispatch).toHaveBeenCalledExactlyOnceWith(request);
    expect(mocks.requests.size).toBe(0);
    expect(mocks.createHook).toHaveBeenCalledOnce();
  });

  it.each([request, actionRequest])(
    "deletes the prompt before continuing the original $type handler",
    async (original) => {
      mocks.signals = [{ type: "continue" }];
      mocks.beforeSignal.mockImplementation(() => mocks.users.add("T1:U1"));
      expect(await handleRequest(original)).toEqual({ status: "completed" });
      expect(mocks.dispatch).toHaveBeenCalledExactlyOnceWith(original);
      expect(mocks.calls.map((call) => call.method)).toEqual([
        "chat.postMessage",
        "chat.update",
        "chat.delete",
        "dispatch",
      ]);
      expect(mocks.calls[2].body).toEqual({ channel: "C1", ts: "200.000001" });
      expect(mocks.calls.at(-1)?.body).toEqual(original.body);
      expect(mocks.requests.size).toBe(0);
      expect(mocks.disposeHook).toHaveBeenCalledOnce();
    },
  );

  it("cancel stops business work and disposes only the auth hook", async () => {
    expect(await handleRequest(actionRequest)).toEqual({ status: "stopped" });
    expect(mocks.dispatch).not.toHaveBeenCalled();
    expect(
      mocks.calls.every((call) => !("text" in call.body) || call.body.text !== "Hi, <@U1>!"),
    ).toBe(true);
    expect(mocks.disposeHook).toHaveBeenCalledOnce();
    expect(mocks.requests.size).toBe(0);
  });

  it("missing installations stop without posting", async () => {
    mocks.installations.clear();
    expect(await handleRequest(request)).toEqual({ status: "stopped" });
    expect(mocks.calls).toEqual([]);
    expect(mocks.dispatch).not.toHaveBeenCalled();
  });

  it("duplicate signed-in deliveries skip the handler too", async () => {
    mocks.users.add("T1:U1");
    mocks.getConflict.mockResolvedValueOnce({ runId: "owner" });
    expect(await handleRequest(request)).toEqual({ status: "duplicate", runId: "owner" });
    expect(mocks.calls).toEqual([]);
  });

  it("already-deleted prompts are safe to retry", async () => {
    pending();
    mocks.users.add("T1:U1");
    mocks.slackError = new Error("message_not_found");
    expect(await resolveRequest(input, "run-a", { type: "continue" })).toBe("ready");
  });

  it("other deletion errors prevent the handler from continuing", async () => {
    pending();
    mocks.users.add("T1:U1");
    mocks.slackError = new Error("invalid_auth");
    await expect(resolveRequest(input, "run-a", { type: "continue" })).rejects.toThrow(
      "invalid_auth",
    );
  });
});

describe("proxy matcher", () => {
  it("matches exact event names and action IDs", () => {
    const config = { matcher: [{ event: "app_mention" }, { action_id: "hello.say" }] };
    expect(matchesSignIn(request, config)).toBe(true);
    expect(matchesSignIn(actionRequest, config)).toBe(true);
    expect(matchesSignIn(actionRequest, { matcher: [{ action_id: "hello" }] })).toBe(false);
    expect(matchesSignIn(request, { matcher: [{ event: "message" }] })).toBe(false);
    expect(matchesSignIn(request)).toBe(true);
    expect(matchesSignIn(request, { matcher: [] })).toBe(false);
  });

  it.each([
    "slackcn.sign_in",
    "slackcn.sign_out",
    "slackcn.cancel",
    "slackcn.continue",
    "slackcn.cancel_continue",
  ])("bypasses %s even if explicitly matched", (action_id) => {
    const control: SlackRequest = {
      ...actionRequest,
      type: "action",
      action: { ...actionRequest.action, action_id },
    };
    expect(matchesSignIn(control)).toBe(false);
    expect(matchesSignIn(control, { matcher: [{ action_id }] })).toBe(false);
  });

  it("bypasses uninstall cleanup", () => {
    expect(matchesSignIn({ ...request, type: "event", event: { type: "app_uninstalled" } })).toBe(
      false,
    );
  });

  it("keeps Home available when protecting all requests", () => {
    expect(matchesSignIn({ type: "event", event: { type: "app_home_opened" } })).toBe(false);
  });

  it("deduplicates redelivered clicks but distinguishes new clicks on the same message", () => {
    const id = actionRequestId("C1", input.ts, "U1", actionRequest.action);
    expect(actionRequestId("C1", input.ts, "U1", { ...actionRequest.action })).toBe(id);
    expect(
      actionRequestId("C1", input.ts, "U1", { ...actionRequest.action, action_ts: "300.2" }),
    ).not.toBe(id);
  });
});

describe("uninstall", () => {
  it("blocks registrations before snapshotting and cancels every indexed run without Slack", async () => {
    pending();
    pending("run-b", "100.000002");
    mocks.cancel.mockImplementation(async () => {
      expect(mocks.markUninstalling).toHaveBeenCalledExactlyOnceWith("T1");
    });
    await uninstallInstallation({ teamId: "T1" });
    expect(mocks.getRun.mock.calls).toEqual([["run-a"], ["run-b"]]);
    expect(mocks.cancel).toHaveBeenCalledTimes(2);
    expect(mocks.removeInstallation).toHaveBeenCalledExactlyOnceWith("T1");
    expect(mocks.calls).toEqual([]);
  });

  it("allows completion to win a cancellation race", async () => {
    pending();
    mocks.cancel.mockRejectedValueOnce(new EntityConflictError("Already completed"));
    mocks.getRun.mockReturnValue({ cancel: mocks.cancel, status: Promise.resolve("completed") });
    await uninstallInstallation({ teamId: "T1" });
    expect(mocks.removeInstallation).toHaveBeenCalledExactlyOnceWith("T1");
  });

  it("uses the enterprise installation key for an org uninstall", async () => {
    await uninstallInstallation({ teamId: "T1", enterpriseId: "E1", isEnterpriseInstall: true });
    expect(mocks.markUninstalling).toHaveBeenCalledExactlyOnceWith("E1");
    expect(mocks.removeInstallation).toHaveBeenCalledExactlyOnceWith("E1");
  });
});
