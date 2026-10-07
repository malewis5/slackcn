import type { KnownBlock } from "@slack/types";
import { isSignedIn } from "@/lib/database";
import { signInPageUrl } from "@/lib/sign-in-context";
import { signInActionId, signOutActionId } from "@/lib/messages";

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
