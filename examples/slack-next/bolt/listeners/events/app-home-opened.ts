import type { AllMiddlewareArgs, SlackEventMiddlewareArgs } from "@slack/bolt";
import type { KnownBlock } from "@slack/types";
import { installationKey, isSignedIn } from "@/lib/database";
import { signInPageUrl } from "@/lib/sign-in";
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
  workspace: {
    teamId: string;
    enterpriseId?: string;
    isEnterpriseInstall: boolean;
  },
) {
  const blocks: KnownBlock[] = (await isSignedIn(installationId, userId))
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
              url: signInPageUrl({
                userId,
                home: true,
                ...workspace,
              }),
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
  if (event.tab !== "home" || !installationId || !context.teamId) return;

  await publishAppHome(client, installationId, event.user, {
    teamId: context.teamId,
    enterpriseId: context.enterpriseId,
    isEnterpriseInstall: context.isEnterpriseInstall ?? false,
  });
};
