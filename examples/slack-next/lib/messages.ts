import type { Button, KnownBlock } from "@slack/types";

export const signOutActionId = "slackcn.sign_out";
export const signInActionId = "slackcn.sign_in";
export const cancelSignInActionId = "slackcn.cancel";
export const continueActionId = "slackcn.continue";
export const cancelContinueActionId = "slackcn.cancel_continue";

export function cancelledSignInMessage(userId: string) {
  const text = `<@${userId}> cancelled sign-in`;
  return {
    text,
    blocks: [{ type: "section", text: { type: "mrkdwn", text } }] satisfies KnownBlock[],
  };
}

export function cancelledRequestMessage(userId: string) {
  const text = `<@${userId}> cancelled the request`;
  return {
    text,
    blocks: [{ type: "section", text: { type: "mrkdwn", text } }] satisfies KnownBlock[],
  };
}

export function continueHereMessage(userId: string, requestId: string) {
  const text = `Waiting for <@${userId}> to continue.`;
  const continueButton = {
    type: "button",
    text: { type: "plain_text", text: "Continue", emoji: true },
    action_id: continueActionId,
    value: requestId,
    visible_to_user_ids: [userId],
  } satisfies Button & { visible_to_user_ids: string[] };
  const cancelButton = {
    type: "button",
    text: { type: "plain_text", text: "Cancel", emoji: true },
    action_id: cancelContinueActionId,
    value: requestId,
    visible_to_user_ids: [userId],
  } satisfies Button & { visible_to_user_ids: string[] };

  return {
    text,
    blocks: [
      { type: "section", text: { type: "mrkdwn", text } },
      { type: "actions", elements: [continueButton, cancelButton] },
    ] satisfies KnownBlock[],
  };
}

export function signInPrompt(userId: string, url: string, requestId: string) {
  const text = `Waiting for <@${userId}> to sign in before continuing.`;
  const signInButton = {
    type: "button",
    text: { type: "plain_text", text: "Sign in", emoji: true },
    action_id: signInActionId,
    value: requestId,
    url,
    visible_to_user_ids: [userId],
  } satisfies Button & { visible_to_user_ids: string[] };

  const cancelSignInButton = {
    type: "button",
    text: { type: "plain_text", text: "Cancel", emoji: true },
    action_id: cancelSignInActionId,
    value: requestId,
    visible_to_user_ids: [userId],
  } satisfies Button & { visible_to_user_ids: string[] };

  return {
    text,
    blocks: [
      { type: "section", text: { type: "mrkdwn", text } },
      { type: "actions", elements: [signInButton, cancelSignInButton] },
    ] satisfies KnownBlock[],
  };
}
