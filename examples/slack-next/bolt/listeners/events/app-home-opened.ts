import type { AllMiddlewareArgs, SlackEventMiddlewareArgs } from "@slack/bolt";
import { installationKey } from "@/lib/database";
import { publishAppHome } from "@/lib/app-home";

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
