import type { AllMiddlewareArgs, SlackEventMiddlewareArgs } from "@slack/bolt";
import { deleteInstallation } from "@/lib/database";

export const appUninstalledCallback = async ({
  context,
}: AllMiddlewareArgs & SlackEventMiddlewareArgs<"app_uninstalled">) => {
  await deleteInstallation({
    teamId: context.teamId,
    enterpriseId: context.enterpriseId,
    isEnterpriseInstall: context.isEnterpriseInstall ?? false,
  });
};
