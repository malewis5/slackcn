import type { AllMiddlewareArgs, BlockAction, SlackActionMiddlewareArgs } from "@slack/bolt";
import { installationKey, signOutUser } from "@/lib/database";
import { publishAppHome } from "@/lib/app-home";
import { refreshPendingRequests } from "@/lib/requests";

const signOutCallback = async ({
  ack,
  body,
  client,
  context,
}: AllMiddlewareArgs & SlackActionMiddlewareArgs<BlockAction>) => {
  await ack();
  const installationId = installationKey(context);
  if (!installationId) return;

  await signOutUser(installationId, body.user.id);
  await refreshPendingRequests(installationId, body.user.id);
  if (!context.teamId) return;

  await publishAppHome(client, installationId, body.user.id, {
    teamId: context.teamId,
    enterpriseId: context.enterpriseId,
    isEnterpriseInstall: context.isEnterpriseInstall ?? false,
  });
};

export default signOutCallback;
