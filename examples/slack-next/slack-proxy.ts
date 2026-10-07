import type { AnyMiddlewareArgs, Middleware } from "@slack/bolt";
import { start } from "workflow/api";
import { matchesSignIn, type SignInConfig } from "@/lib/sign-in-matcher";
import { slackRequest, slackRequestTarget } from "@/lib/slack-request";
import { handleRequest } from "@/workflows/request";

export const config = {
  matcher: [{ event: "app_mention" }, { action_id: "hello.say" }],
} satisfies SignInConfig;

export const slackProxy: Middleware<AnyMiddlewareArgs> = async (args) => {
  // Only internal workflow delivery sets this context property; body fields never do.
  if (args.context.slackcnWorkflowDelivery) return args.next();
  const target = slackRequestTarget(args);
  if (!target || !matchesSignIn(target, config)) return args.next();
  const request = slackRequest(args);

  // Acknowledge before waiting. The internal delivery gets a no-op ack.
  if ("ack" in args && args.ack) await args.ack();
  if (!request)
    throw new Error("Sign-in middleware requires a channel event or message-backed action.");
  await start(handleRequest, [request, config]);
};
