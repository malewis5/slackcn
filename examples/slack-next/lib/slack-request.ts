import type { AllMiddlewareArgs, AnyMiddlewareArgs, BlockElementAction } from "@slack/bolt";
import type { SlackEvent } from "@slack/types";
import type { ThreadSignInContext } from "./sign-in-context";
import type { SlackRequestTarget } from "./sign-in-matcher";

/** Only JSON data crosses into a workflow, never a Bolt client or callback. */
export type SlackRequest = ThreadSignInContext & { id: string; body: Record<string, unknown> } & (
    | { type: "event"; event: SlackEvent }
    | { type: "action"; action: BlockElementAction }
  );

export function actionRequestId(
  channel: string,
  ts: string,
  userId: string,
  action: BlockElementAction,
) {
  // Redelivery of a click is the same request; another click is a new request.
  return `action:${channel}:${ts}:${userId}:${action.action_id}:${action.action_ts}`;
}

export function slackRequestTarget(
  args: AllMiddlewareArgs & AnyMiddlewareArgs,
): SlackRequestTarget | undefined {
  if ("event" in args) return { type: "event", event: args.event };
  if (args.body.type === "block_actions" && "actions" in args.body) {
    const action = args.body.actions[0];
    if (action) return { type: "action", action };
  }
}

/** Normalize once, before any application listener runs. */
export function slackRequest(
  args: AllMiddlewareArgs & AnyMiddlewareArgs,
): SlackRequest | undefined {
  const { context } = args;
  if (!context.teamId || (context.isEnterpriseInstall && !context.enterpriseId)) return;
  const workspace = {
    teamId: context.teamId,
    enterpriseId: context.enterpriseId,
    isEnterpriseInstall: context.isEnterpriseInstall,
  };
  const body: Record<string, unknown> = { ...args.body };
  // Expiring credentials and response URLs cannot be used after a durable wait.
  for (const key of ["token", "response_url", "response_urls", "bot_access_token", "trigger_id"]) {
    delete body[key];
  }

  if ("event" in args) {
    const { event } = args;
    if (
      !("channel" in event) ||
      typeof event.channel !== "string" ||
      !("user" in event) ||
      typeof event.user !== "string" ||
      !("ts" in event) ||
      typeof event.ts !== "string"
    )
      return;
    return {
      ...workspace,
      type: "event",
      id: args.body.event_id ?? `event:${event.type}:${event.channel}:${event.ts}`,
      event,
      body,
      userId: event.user,
      channel: event.channel,
      ts: event.ts,
      threadTs:
        "thread_ts" in event && typeof event.thread_ts === "string" ? event.thread_ts : undefined,
    };
  }

  if (args.body.type === "block_actions" && "action" in args && "actions" in args.body) {
    const action = args.body.actions[0];
    const channel = args.body.channel?.id;
    const ts = args.body.message?.ts;
    if (!action || !channel || !ts) return;
    return {
      ...workspace,
      type: "action",
      id: actionRequestId(channel, ts, args.body.user.id, action),
      action,
      body,
      userId: args.body.user.id,
      channel,
      ts,
      threadTs: args.body.message?.thread_ts,
    };
  }
}
