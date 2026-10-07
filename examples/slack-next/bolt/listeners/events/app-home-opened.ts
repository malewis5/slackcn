import type { AllMiddlewareArgs, SlackEventMiddlewareArgs } from "@slack/bolt";
import type { KnownBlock } from "@slack/types";
import type { WebClient } from "@slack/web-api";
import { signedInUsers, signInActionId, signOutActionId } from "./app-mention";

export async function publishAppHome(client: WebClient, userId: string) {
  const blocks: KnownBlock[] = signedInUsers.has(userId)
    ? [
        {
          type: "actions",
          elements: [
            {
              type: "button",
              text: { type: "plain_text", text: "Sign out", emoji: true },
              action_id: signOutActionId,
            },
          ],
        },
      ]
    : [
        {
          type: "actions",
          elements: [
            {
              type: "button",
              text: { type: "plain_text", text: "Sign in", emoji: true },
              action_id: signInActionId,
            },
          ],
        },
      ];

  await client.views.publish({
    user_id: userId,
    view: { type: "home", blocks },
  });
}

export const appHomeOpenedCallback = async ({
  client,
  event,
}: AllMiddlewareArgs & SlackEventMiddlewareArgs<"app_home_opened">) => {
  if (event.tab !== "home") return;

  await publishAppHome(client, event.user);
};
