import { getStepMetadata } from "workflow";
import { app } from "@/bolt/app";
import { getInstallation, installationKey } from "@/lib/database";
import type { SlackRequest } from "@/lib/slack-request";
import { clientMessageId } from "@/lib/slack";

export async function dispatchRequest(request: SlackRequest) {
  "use step";

  const installationId = installationKey(request);
  if (!installationId || !(await getInstallation(installationId))) return;

  // Bolt reloads credentials and creates its normal listener args.
  // We persist the request, never a next() callback or WebClient.
  await app.init();
  await app.processEvent({
    body: request.body,
    ack: async () => {},
    customProperties: {
      slackcnWorkflowDelivery: true,
      slackcnClientMessageId: clientMessageId(getStepMetadata().stepId),
    },
  });
}
