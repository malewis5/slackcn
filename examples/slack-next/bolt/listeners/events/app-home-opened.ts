import type { AllMiddlewareArgs, SlackEventMiddlewareArgs } from "@slack/bolt";
import type { KnownBlock } from "@slack/types";
import { installationKey, usersFor } from "@/lib/database";
import { signInActionId, signOutActionId } from "./app-mention";

export async function publishAppHome(
  client: {
    views: {
      publish: (args: {
        user_id: string;
        view: { type: "home"; blocks: KnownBlock[] };
      }) => Promise<unknown>;
    };
  },
  installationId: string,
  userId: string,
) {
  const blocks: KnownBlock[] = usersFor(installationId).has(userId)
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
  context,
}: AllMiddlewareArgs & SlackEventMiddlewareArgs<"app_home_opened">) => {
  const installationId = installationKey(context);
  if (event.tab !== "home" || !installationId) return;

  await publishAppHome(client, installationId, event.user);
};
