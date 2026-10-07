import type { AllMiddlewareArgs, SlackEventMiddlewareArgs } from "@slack/bolt";
import { helloMessage } from "@/lib/hello";

export const appMentionCallback = async ({
  event,
  say,
  context,
}: AllMiddlewareArgs & SlackEventMiddlewareArgs<"app_mention">) => {
  if (!event.user) return;
  const message = {
    ...helloMessage(event.user),
    thread_ts: event.thread_ts ?? event.ts,
    client_msg_id: context.slackcnClientMessageId,
  };
  await say(message);
};
