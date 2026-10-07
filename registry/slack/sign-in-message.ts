import type { Button, KnownBlock } from "@slack/types";

export interface SignInMessageOptions {
  userId: string;
  signInUrl: string;
}

/** Builds message content for chat.postMessage. Posting and auth are handled by your app. */
export function signInMessage({ userId, signInUrl }: SignInMessageOptions) {
  const text = `Waiting for <@${userId}> to sign in before continuing.`;
  const button = {
    type: "button",
    text: { type: "plain_text", text: "Sign in", emoji: true },
    action_id: "slackcn.sign_in",
    url: signInUrl,
    style: "primary",
    // Slack supports this on buttons; @slack/types does not yet declare it.
    visible_to_user_ids: [userId],
  } satisfies Button & { visible_to_user_ids: string[] };

  return {
    text,
    blocks: [
      { type: "section", text: { type: "mrkdwn", text } },
      { type: "actions", elements: [button] },
    ],
  } satisfies { text: string; blocks: KnownBlock[] };
}
