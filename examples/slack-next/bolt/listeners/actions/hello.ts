import type { AllMiddlewareArgs, BlockAction, SlackActionMiddlewareArgs } from "@slack/bolt";
import { helloMessage } from "@/lib/hello";

export const helloCallback = async ({
  ack,
  body,
  say,
  context,
}: AllMiddlewareArgs & SlackActionMiddlewareArgs<BlockAction>) => {
  await ack();
  const message = {
    ...helloMessage(body.user.id),
    thread_ts: body.message?.thread_ts ?? body.message?.ts,
    client_msg_id: context.slackcnClientMessageId,
  };
  await say(message);
};
