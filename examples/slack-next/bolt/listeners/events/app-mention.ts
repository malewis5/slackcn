import type { AllMiddlewareArgs, SlackEventMiddlewareArgs } from "@slack/bolt";
import { start } from "workflow/api";
import { installationKey } from "@/lib/database";
import { handleMention } from "@/workflows/mention";

export const appMentionCallback = async ({
  event,
  context,
}: AllMiddlewareArgs & SlackEventMiddlewareArgs<"app_mention">) => {
  if (!event.user || !installationKey(context) || !context.teamId) return;

  await start(handleMention, [
    {
      userId: event.user,
      teamId: context.teamId,
      enterpriseId: context.enterpriseId,
      isEnterpriseInstall: context.isEnterpriseInstall ?? false,
      channel: event.channel,
      ts: event.ts,
      threadTs: event.thread_ts,
    },
  ]);
};
