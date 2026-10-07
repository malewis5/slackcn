import type { Button, KnownBlock } from "@slack/types";
import type { WebClient } from "@slack/web-api";

export interface SignInMessageOptions {
  visible_to_user_ids: string[];
  url: string;
  /** Cancel button action ID. Uses the default cancel action when omitted. */
  action_id?: string;
}

export const signInActionIds = {
  signIn: "slackcn.sign_in",
  cancel: "slackcn.cancel",
} as const;

/** Builds message content for chat.postMessage. Register action handlers in your app. */
export function signInMessage({
  visible_to_user_ids,
  url,
  action_id = signInActionIds.cancel,
}: SignInMessageOptions) {
  if (visible_to_user_ids.length === 0) {
    throw new Error("signInMessage requires at least one user ID.");
  }

  const users = visible_to_user_ids.map((id) => `<@${id}>`).join(" or ");
  const text = `Waiting for ${users} to sign in before continuing.`;
  // Slack supports visibility on buttons; @slack/types does not yet declare it.
  const buttons = [
    {
      type: "button",
      text: { type: "plain_text", text: "Sign in", emoji: true },
      action_id: signInActionIds.signIn,
      url,
      style: "primary",
      visible_to_user_ids,
    },
    {
      type: "button",
      text: { type: "plain_text", text: "Cancel", emoji: true },
      action_id,
      visible_to_user_ids,
    },
  ] satisfies (Button & { visible_to_user_ids: string[] })[];

  return {
    text,
    blocks: [
      { type: "section", text: { type: "mrkdwn", text } },
      { type: "actions", elements: buttons },
    ],
  } satisfies { text: string; blocks: KnownBlock[] };
}

export interface CancelSignInMessageOptions {
  channel: string;
  ts: string;
  thread_ts?: string;
  /** The user who clicked Cancel. */
  user_id: string;
}

/** Deletes the waiting message and announces cancellation. Cancel underlying work in userland. */
export async function cancelSignInMessage(
  client: { chat: Pick<WebClient["chat"], "delete" | "postMessage"> },
  { channel, ts, thread_ts, user_id }: CancelSignInMessageOptions,
) {
  await client.chat.delete({ channel, ts });

  return client.chat.postMessage({
    channel,
    // A root message can include its own thread_ts. Do not reply to the deleted message.
    ...(thread_ts && thread_ts !== ts ? { thread_ts } : {}),
    text: `Canceled by <@${user_id}>.`,
  });
}
