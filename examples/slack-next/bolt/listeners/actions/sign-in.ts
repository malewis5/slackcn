import type {
  AllMiddlewareArgs,
  BlockAction,
  SlackActionMiddlewareArgs,
} from "@slack/bolt";
import { installationKey, usersFor } from "@/lib/database";
import { publishAppHome } from "../events/app-home-opened";

export const signInCallback = async ({
  ack,
  body,
  client,
  context,
}: AllMiddlewareArgs & SlackActionMiddlewareArgs<BlockAction>) => {
  await ack();
  const installationId = installationKey(context);
  if (!installationId) return;

  usersFor(installationId).add(body.user.id);
  await publishAppHome(client, installationId, body.user.id);

  const channel = body.channel?.id;
  const ts = body.message?.ts;
  if (!channel || !ts) return;

  await client.chat.delete({ channel, ts });
};

export const cancelSignInCallback = async ({
  ack,
  body,
  client,
  context,
}: AllMiddlewareArgs & SlackActionMiddlewareArgs<BlockAction>) => {
  await ack();
  const installationId = installationKey(context);
  if (installationId) usersFor(installationId).delete(body.user.id);

  const channel = body.channel?.id;
  const ts = body.message?.ts;
  if (!channel || !ts) return;

  const text = `<@${body.user.id}> cancelled sign-in`;
  await client.chat.update({
    channel,
    ts,
    text,
    blocks: [{ type: "section", text: { type: "mrkdwn", text } }],
  });
};
