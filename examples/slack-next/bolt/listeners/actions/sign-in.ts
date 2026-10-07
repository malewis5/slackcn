import type {
  AllMiddlewareArgs,
  BlockAction,
  SlackActionMiddlewareArgs,
} from "@slack/bolt";
import { forgetSignInPrompt, installationKey, signOutUser } from "@/lib/database";
import { cancelSignIn, cancelledRequestMessage, signedInMessage } from "@/lib/sign-in";
import { publishAppHome } from "../events/app-home-opened";

export const signInCallback = async ({
  ack,
}: AllMiddlewareArgs & SlackActionMiddlewareArgs<BlockAction>) => {
  await ack();
};

export const continueCallback = async ({
  ack,
  body,
  client,
}: AllMiddlewareArgs & SlackActionMiddlewareArgs<BlockAction>) => {
  await ack();
  const channel = body.channel?.id;
  const ts = body.message?.ts;
  if (!channel || !ts) return;

  await client.chat.update({ channel, ts, ...signedInMessage(body.user.id) });
};

export const cancelContinueCallback = async ({
  ack,
  body,
  client,
  context,
}: AllMiddlewareArgs & SlackActionMiddlewareArgs<BlockAction>) => {
  await ack();
  const channel = body.channel?.id;
  const ts = body.message?.ts;
  if (!channel || !ts) return;

  await client.chat.update({ channel, ts, ...cancelledRequestMessage(body.user.id) });
  const installationId = installationKey(context);
  if (!installationId) return;

  await forgetSignInPrompt(installationId, body.user.id, { channel, ts });
};

export const cancelSignInCallback = async ({
  ack,
  body,
  client,
  context,
}: AllMiddlewareArgs & SlackActionMiddlewareArgs<BlockAction>) => {
  await ack();
  const channel = body.channel?.id;
  const ts = body.message?.ts;
  const installationId = installationKey(context);
  if (!channel || !ts) {
    if (installationId && context.teamId) {
      await signOutUser(installationId, body.user.id);
      await publishAppHome(client, installationId, body.user.id, {
        teamId: context.teamId,
        enterpriseId: context.enterpriseId,
        isEnterpriseInstall: context.isEnterpriseInstall ?? false,
      });
    }
    return;
  }

  await cancelSignIn((message) => client.chat.update(message), {
    installationId,
    userId: body.user.id,
    channel,
    ts,
  });
  if (!installationId) return;

  await forgetSignInPrompt(installationId, body.user.id, { channel, ts });
  if (!context.teamId) return;

  await publishAppHome(client, installationId, body.user.id, {
    teamId: context.teamId,
    enterpriseId: context.enterpriseId,
    isEnterpriseInstall: context.isEnterpriseInstall ?? false,
  });
};
