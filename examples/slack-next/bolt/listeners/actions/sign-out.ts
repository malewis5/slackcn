import type { AllMiddlewareArgs, BlockAction, SlackActionMiddlewareArgs } from "@slack/bolt";
import { signedInUsers } from "../events/app-mention";
import { publishAppHome } from "../events/app-home-opened";

const signOutCallback = async ({
  ack,
  body,
  client,
}: AllMiddlewareArgs & SlackActionMiddlewareArgs<BlockAction>) => {
  await ack();
  signedInUsers.delete(body.user.id);
  await publishAppHome(client, body.user.id);
};

export default signOutCallback;
