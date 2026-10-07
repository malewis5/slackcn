import type { AllMiddlewareArgs, SlackEventMiddlewareArgs } from "@slack/bolt";
import type { Button, KnownBlock } from "@slack/types";

export const signedInUsers = new Set<string>();
export const signOutActionId = "slackcn.sign_out";
export const signInActionId = "slackcn.sign_in";
export const cancelSignInActionId = "slackcn.cancel";

export const appMentionCallback = async ({
  event,
  client,
}: AllMiddlewareArgs & SlackEventMiddlewareArgs<"app_mention">) => {
  if (!event.user) return;

  const signedIn = signedInUsers.has(event.user);

  if (signedIn) {
    const text = `Hi, <@${event.user}>!`;

    await client.chat.postMessage({
      channel: event.channel,
      thread_ts: event.ts,
      text,
      blocks: [
        { type: "section", text: { type: "mrkdwn", text } },
      ] satisfies KnownBlock[],
    });
  } else {
    const text = `Waiting for <@${event.user}> to sign in before continuing.`;
    const signInButton = {
      type: "button",
      text: { type: "plain_text", text: "Sign in", emoji: true },
      action_id: signInActionId,
      visible_to_user_ids: [event.user],
    } satisfies Button & { visible_to_user_ids: string[] };

    const cancelSignInButton = {
      type: "button",
      text: { type: "plain_text", text: "Cancel", emoji: true },
      action_id: cancelSignInActionId,
      visible_to_user_ids: [event.user],
    } satisfies Button & { visible_to_user_ids: string[] };

    await client.chat.postMessage({
      channel: event.channel,
      thread_ts: event.ts,
      text,
      blocks: [
        { type: "section", text: { type: "mrkdwn", text } },
        { type: "actions", elements: [signInButton, cancelSignInButton] },
      ] satisfies KnownBlock[],
    });
  }
};
