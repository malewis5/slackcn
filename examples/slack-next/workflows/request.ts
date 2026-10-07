import { createHook } from "workflow";
import type { SlackRequest } from "@/lib/slack-request";
import type { SignInConfig } from "@/lib/sign-in-matcher";
import { dispatchRequest } from "./dispatch";
import { signInMiddleware } from "./sign-in-middleware";

export async function handleRequest(request: SlackRequest, config: SignInConfig = {}) {
  "use workflow";

  // Deduplication belongs to the whole request, including signed-in requests.
  // Keep the token reserved after completion to absorb Slack redeliveries.
  const delivery = createHook({
    token: `slackcn:request:${request.isEnterpriseInstall ? request.enterpriseId : request.teamId}:${request.id}`,
    experimental_minRetention: "1d",
  });
  const conflict = await delivery.getConflict();
  if (conflict) return { status: "duplicate", runId: conflict.runId };

  console.info("Handling Slack request", request.id);
  if (!(await signInMiddleware(request, config))) return { status: "stopped" };
  await dispatchRequest(request);
  return { status: "completed" };
}
