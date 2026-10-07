import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  AllMiddlewareArgs,
  AnyMiddlewareArgs,
  BlockAction,
  SlackActionMiddlewareArgs,
} from "@slack/bolt";
import { slackRequest } from "@/lib/slack-request";

const mocks = vi.hoisted(() => ({ start: vi.fn(), handleRequest: vi.fn() }));
vi.mock("workflow/api", () => ({ start: mocks.start }));
vi.mock("@/workflows/request", () => ({ handleRequest: mocks.handleRequest }));

import { config, slackProxy } from "@/slack-proxy";

function actionArgs(action_id = "hello.say") {
  const action = {
    type: "button" as const,
    action_id,
    block_id: "hello-block",
    action_ts: "300.000001",
    value: "original-value",
    text: { type: "plain_text" as const, text: "Say hello" },
  };
  const body: BlockAction = {
    type: "block_actions",
    actions: [action],
    team: { id: "T1", domain: "test" },
    user: { id: "U1", username: "matt" },
    channel: { id: "C1", name: "general" },
    message: { type: "message", ts: "200.000001", thread_ts: "100.000001" },
    state: {
      values: {
        choice: {
          select: {
            type: "static_select",
            selected_option: { text: { type: "plain_text", text: "First" }, value: "first" },
          },
        },
      },
    },
    token: "expired-token",
    response_url: "https://example.invalid/expired",
    trigger_id: "expired-trigger",
    bot_access_token: "expired-function-token",
    api_app_id: "A1",
    container: { type: "message", channel_id: "C1", message_ts: "200.000001" },
  };
  return {
    body,
    action,
    payload: action,
    context: { teamId: "T1", isEnterpriseInstall: false },
    ack: vi.fn(async () => {}),
    next: vi.fn(async () => {}),
    client: {},
    logger: {},
  } as unknown as AllMiddlewareArgs & SlackActionMiddlewareArgs<BlockAction>;
}

beforeEach(() => {
  mocks.start.mockReset();
  mocks.start.mockResolvedValue({ runId: "run-a" });
});

describe("global Slack proxy", () => {
  it("acks a matched action before starting its workflow and defers all listeners", async () => {
    const args = actionArgs();
    const order: string[] = [];
    vi.mocked(args.ack).mockImplementation(async () => {
      order.push("ack");
    });
    mocks.start.mockImplementation(async () => {
      order.push("workflow");
    });

    await slackProxy(args);

    expect(order).toEqual(["ack", "workflow"]);
    expect(args.next).not.toHaveBeenCalled();
    expect(mocks.start).toHaveBeenCalledExactlyOnceWith(mocks.handleRequest, [
      expect.objectContaining({
        type: "action",
        userId: "U1",
        channel: "C1",
        ts: "200.000001",
        threadTs: "100.000001",
        action: args.action,
        body: expect.objectContaining({ state: args.body.state }),
      }),
      config,
    ]);
  });

  it.each([
    "unmatched.action",
    "slackcn.sign_in",
    "slackcn.sign_out",
    "slackcn.continue",
    "slackcn.cancel",
    "slackcn.cancel_continue",
  ])("%s reaches its existing listener directly", async (action_id) => {
    const args = actionArgs(action_id);
    await slackProxy(args);
    expect(args.next).toHaveBeenCalledOnce();
    expect(args.ack).not.toHaveBeenCalled();
    expect(mocks.start).not.toHaveBeenCalled();
  });

  it("internal workflow delivery reaches existing listeners without starting another run", async () => {
    const args = actionArgs();
    args.context.slackcnWorkflowDelivery = true;
    await slackProxy(args);
    expect(args.next).toHaveBeenCalledOnce();
    expect(mocks.start).not.toHaveBeenCalled();
  });

  it("a payload field cannot masquerade as internal workflow delivery", async () => {
    const args = actionArgs();
    Object.assign(args.body, { slackcnWorkflowDelivery: true });
    await slackProxy(args);
    expect(args.next).not.toHaveBeenCalled();
    expect(mocks.start).toHaveBeenCalledOnce();
  });

  it("a protected action without message context cannot bypass sign-in", async () => {
    const args = actionArgs();
    delete args.body.message;
    delete args.body.channel;
    await expect(slackProxy(args)).rejects.toThrow(
      "requires a channel event or message-backed action",
    );
    expect(args.ack).toHaveBeenCalledOnce();
    expect(args.next).not.toHaveBeenCalled();
    expect(mocks.start).not.toHaveBeenCalled();
  });
});

describe("request normalization", () => {
  it("preserves action/state/message data while removing expiring credentials from the durable copy", () => {
    const args = actionArgs();
    const request = slackRequest(args)!;
    expect(request.body).toMatchObject({
      actions: args.body.actions,
      state: args.body.state,
      message: args.body.message,
    });
    for (const key of ["token", "response_url", "bot_access_token", "trigger_id"]) {
      expect(request.body).not.toHaveProperty(key);
      expect(args.body).toHaveProperty(key);
    }
    expect(request).not.toHaveProperty("client");
    expect(request).not.toHaveProperty("ack");
  });

  it("preserves the original event and uses the event ID for redelivery", () => {
    const event = {
      type: "app_mention",
      user: "U1",
      channel: "C1",
      ts: "100.1",
      thread_ts: "90.1",
      text: "hello",
    };
    const request = slackRequest({
      body: { type: "event_callback", team_id: "T1", event_id: "Ev1", event },
      event,
      payload: event,
      context: { teamId: "T1", isEnterpriseInstall: false },
    } as unknown as AllMiddlewareArgs & AnyMiddlewareArgs)!;
    expect(request).toMatchObject({
      type: "event",
      id: "Ev1",
      event,
      userId: "U1",
      channel: "C1",
      ts: "100.1",
      threadTs: "90.1",
    });
    expect(request.body.event).toBe(event);
  });
});
