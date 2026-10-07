import type {
  AllMiddlewareArgs,
  BlockAction,
  SlackActionMiddlewareArgs,
} from "@slack/bolt";
import { signedInUsers } from "../events/app-mention";
import { publishAppHome } from "../events/app-home-opened";

export const signInCallback = async ({
  ack,
  body,
  client,
}: AllMiddlewareArgs & SlackActionMiddlewareArgs<BlockAction>) => {
  await ack();
  signedInUsers.add(body.user.id);
  await publishAppHome(client, body.user.id);

  const channel = body.channel?.id;
  const ts = body.message?.ts;
  if (!channel || !ts) return;

  await client.chat.delete({ channel, ts });
};

export const cancelSignInCallback = async ({
  ack,
  body,
  client,
}: AllMiddlewareArgs & SlackActionMiddlewareArgs<BlockAction>) => {
  await ack();
  signedInUsers.delete(body.user.id);

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
