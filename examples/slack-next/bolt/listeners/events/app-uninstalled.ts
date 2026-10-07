import type { AllMiddlewareArgs, SlackEventMiddlewareArgs } from "@slack/bolt";
import { uninstallInstallation } from "@/lib/requests";

export const appUninstalledCallback = async ({
  context,
}: AllMiddlewareArgs & SlackEventMiddlewareArgs<"app_uninstalled">) => {
  await uninstallInstallation({
    teamId: context.teamId,
    enterpriseId: context.enterpriseId,
    isEnterpriseInstall: context.isEnterpriseInstall ?? false,
  });
};
