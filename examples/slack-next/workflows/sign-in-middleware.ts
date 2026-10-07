import { createHook, getWorkflowMetadata } from "workflow";
import type { RequestSignal } from "@/lib/requests";
import { matchesSignIn, type SignInConfig } from "@/lib/sign-in-matcher";
import type { SlackRequest } from "@/lib/slack-request";
import {
  beginRequest,
  finishRequest,
  getSignInStatus,
  refreshRequest,
  registerRequest,
  resolveRequest,
} from "./sign-in-steps";

/** Await this before business work. False means this request must stop. */
export async function signInMiddleware(request: SlackRequest, config: SignInConfig = {}) {
  "use workflow";

  if (!matchesSignIn(request, config)) return true;
  const auth = await getSignInStatus(request);
  if (auth !== "waiting") return auth === "ready";

  const { workflowRunId: runId } = getWorkflowMetadata();
  using hook = createHook<RequestSignal>({ token: `slackcn:sign-in:${runId}` });
  // Finish registration before a directory row or a button exposes the token.
  await hook.getConflict();
  try {
    if (!(await registerRequest(request, runId, hook.token))) return false;
    const status = await beginRequest(request, runId);
    if (status !== "waiting") return status === "ready";
    if (!(await refreshRequest(request, runId))) return false;

    for await (const signal of hook) {
      if (signal.type === "refresh") {
        if (!(await refreshRequest(request, runId))) return false;
        continue;
      }
      const resolved = await resolveRequest(request, runId, signal);
      if (resolved !== "waiting") return resolved === "ready";
    }
    return false;
  } finally {
    await finishRequest(runId);
  }
}
