import type {
  AllMiddlewareArgs,
  BlockAction,
  SlackActionMiddlewareArgs,
} from "@slack/bolt";
import { forgetSignInPrompt, installationKey, usersFor } from "@/lib/database";
import { cancelSignIn, showSignedInInThreads } from "@/lib/sign-in";
import { publishAppHome } from "../events/app-home-opened";

export const signInCallback = async ({
  ack,
  body,
  client,
  context,
}: AllMiddlewareArgs & SlackActionMiddlewareArgs<BlockAction>) => {
  await ack();
  // Link buttons open the sign-in page. That page records the user.
  if (body.channel?.id && body.message?.ts) return;

  const installationId = installationKey(context);
  if (!installationId) return;

  usersFor(installationId).add(body.user.id);
  await publishAppHome(client, installationId, body.user.id);
  await showSignedInInThreads(
    (message) => client.chat.update(message),
    installationId,
    body.user.id,
  );
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
    if (installationId) {
      usersFor(installationId).delete(body.user.id);
      await publishAppHome(client, installationId, body.user.id);
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

  forgetSignInPrompt(installationId, body.user.id, { channel, ts });
  await publishAppHome(client, installationId, body.user.id);
};
