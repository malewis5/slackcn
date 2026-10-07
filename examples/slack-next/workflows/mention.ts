import { createHook, getWorkflowMetadata } from "workflow";
import type { RequestSignal } from "@/lib/requests";
import type { ThreadSignInContext } from "@/lib/sign-in-context";
import {
  beginRequest,
  finishRequest,
  refreshRequest,
  registerRequest,
  resolveRequest,
} from "./mention-steps";

export async function handleMention(input: ThreadSignInContext) {
  "use workflow";

  // Two mentions in one thread are independent; redelivery of one mention is not.
  // Keep this token reserved for Slack's retries even after the run finishes.
  const hook = createHook<RequestSignal>({
    token: `slackcn:${input.isEnterpriseInstall ? input.enterpriseId : input.teamId}:${input.channel}:${input.ts}`,
    experimental_minRetention: "1d",
  });
  const conflict = await hook.getConflict();
  if (conflict) return { status: "duplicate", runId: conflict.runId };

  const { workflowRunId: runId } = getWorkflowMetadata();
  console.info("Starting Slack request", runId);
  try {
    // Register the hook before any directory entry or button can expose it.
    if (!(await registerRequest(input, runId, hook.token))) return { status: "uninstalled" };
    if (!(await beginRequest(input, runId))) return { status: "completed" };
    if (!(await refreshRequest(input, runId))) return { status: "uninstalled" };

    for await (const signal of hook) {
      if (signal.type === "refresh") {
        if (!(await refreshRequest(input, runId))) return { status: "uninstalled" };
        continue;
      }
      const status = await resolveRequest(input, runId, signal);
      if (status !== "waiting") return { status };
    }
  } finally {
    await finishRequest(runId);
  }
}
