import type { AllMiddlewareArgs, BlockAction, SlackActionMiddlewareArgs } from "@slack/bolt";
import { installationKey, usersFor } from "@/lib/database";
import { publishAppHome } from "../events/app-home-opened";

const signOutCallback = async ({
  ack,
  body,
  client,
  context,
}: AllMiddlewareArgs & SlackActionMiddlewareArgs<BlockAction>) => {
  await ack();
  const installationId = installationKey(context);
  if (!installationId) return;

  usersFor(installationId).delete(body.user.id);
  await publishAppHome(client, installationId, body.user.id);
};

export default signOutCallback;
