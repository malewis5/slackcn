import type { AllMiddlewareArgs, SlackEventMiddlewareArgs } from "@slack/bolt";
import type { Button, KnownBlock } from "@slack/types";
import { installationKey, rememberSignInPrompt, usersFor } from "@/lib/database";
import { signedInMessage, signInPageUrl, type SignInContext } from "@/lib/sign-in";

export const signOutActionId = "slackcn.sign_out";
export const signInActionId = "slackcn.sign_in";
export const cancelSignInActionId = "slackcn.cancel";

export const appMentionCallback = async ({
  event,
  client,
  context,
}: AllMiddlewareArgs & SlackEventMiddlewareArgs<"app_mention">) => {
  const installationId = installationKey(context);
  if (!event.user || !installationId) return;

  const signedIn = usersFor(installationId).has(event.user);
  const threadTs = event.thread_ts ?? event.ts;

  if (signedIn) {
    await client.chat.postMessage({
      channel: event.channel,
      thread_ts: threadTs,
      ...signedInMessage(event.user),
    });
  } else {
    if (!context.teamId) return;

    const destination: SignInContext = {
      userId: event.user,
      teamId: context.teamId,
      enterpriseId: context.enterpriseId,
      isEnterpriseInstall: context.isEnterpriseInstall ?? false,
      channel: event.channel,
      ts: event.ts,
      threadTs: event.thread_ts,
    };
    const posted = await client.chat.postMessage({
      channel: event.channel,
      thread_ts: threadTs,
      ...signInPrompt(event.user, signInPageUrl(destination)),
    });
    if (!posted.ts) return;

    rememberSignInPrompt(installationId, event.user, {
      channel: event.channel,
      ts: posted.ts,
    });
    await client.chat.update({
      channel: event.channel,
      ts: posted.ts,
      ...signInPrompt(event.user, signInPageUrl({ ...destination, promptTs: posted.ts })),
    });
  }
}

function signInPrompt(userId: string, url: string) {
  const text = `Waiting for <@${userId}> to sign in before continuing.`;
  const signInButton = {
    type: "button",
    text: { type: "plain_text", text: "Sign in", emoji: true },
    action_id: signInActionId,
    url,
    visible_to_user_ids: [userId],
  } satisfies Button & { visible_to_user_ids: string[] };

  const cancelSignInButton = {
    type: "button",
    text: { type: "plain_text", text: "Cancel", emoji: true },
    action_id: cancelSignInActionId,
    visible_to_user_ids: [userId],
  } satisfies Button & { visible_to_user_ids: string[] };

  return {
    text,
    blocks: [
      { type: "section", text: { type: "mrkdwn", text } },
      { type: "actions", elements: [signInButton, cancelSignInButton] },
    ] satisfies KnownBlock[],
  };
};
