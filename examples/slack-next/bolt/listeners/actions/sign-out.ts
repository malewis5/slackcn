import type { AllMiddlewareArgs, BlockAction, SlackActionMiddlewareArgs } from "@slack/bolt";
import { signedInUsers } from "../events/app-mention";

const signOutCallback = async ({
  ack,
  body,
}: AllMiddlewareArgs & SlackActionMiddlewareArgs<BlockAction>) => {
  await ack();
  signedInUsers.delete(body.user.id);
};

export default signOutCallback;
