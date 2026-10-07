import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Installation } from "@slack/bolt";
import type { PendingRequest } from "@/lib/database";
import type { ThreadSignInContext } from "@/lib/sign-in-context";

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
}));

vi.mock("workflow/api", () => ({ resumeHook: mocks.resumeHook, getRun: mocks.getRun }));
vi.mock("workflow", () => ({
  createHook: mocks.createHook,
  getWorkflowMetadata: () => ({ workflowRunId: "run-a" }),
}));
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
vi.mock("@/lib/slack", () => ({
  slackApi: async (_id: string, method: string, body: object) => {
    mocks.calls.push({ method, body });
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
import { beginRequest, resolveRequest } from "@/workflows/mention-steps";
import { handleMention } from "@/workflows/mention";

const input: ThreadSignInContext = {
  userId: "U1",
  teamId: "T1",
  isEnterpriseInstall: false,
  channel: "C1",
  ts: "100.000001",
};
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
  mocks.getRun.mockReturnValue({ cancel: mocks.cancel, status: Promise.resolve("running") });
  mocks.getConflict.mockResolvedValue(null);
  mocks.createHook.mockImplementation(({ token }: { token: string }) => ({
    token,
    getConflict: mocks.getConflict,
    async *[Symbol.asyncIterator]() {
      yield { type: "cancel", reason: "sign-in" };
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

  it("posting retries update an existing prompt instead of leaving Sign In visible", async () => {
    pending();
    mocks.users.add("T1:U1");
    expect(await beginRequest(input, "run-a")).toBe(false);
    expect(mocks.calls).toEqual([
      { method: "chat.update", body: expect.objectContaining({ text: "Hi, <@U1>!" }) },
    ]);
  });

  it("claims the hook before posting, routes its cancellation, and cleans its directory", async () => {
    expect(await handleMention(input)).toEqual({ status: "cancelled" });
    expect(mocks.getConflict).toHaveBeenCalledOnce();
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
    expect(await handleMention(input)).toEqual({ status: "duplicate", runId: "already-started" });
    expect(mocks.calls).toEqual([]);
    expect(mocks.requests.size).toBe(0);
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
