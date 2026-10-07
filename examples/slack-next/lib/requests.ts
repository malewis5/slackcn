import { getRun, resumeHook } from "workflow/api";
import { EntityConflictError, HookNotFoundError, WorkflowRunNotFoundError } from "workflow/errors";
import {
  forgetRequest,
  getRequest,
  installationKey,
  listPendingRequests,
  markInstallationUninstalling,
  removeInstallation,
  type PendingRequest,
} from "@/lib/database";
import type { ThreadSignInContext } from "@/lib/sign-in-context";

export type RequestSignal =
  | { type: "refresh" }
  | { type: "continue" }
  | { type: "cancel"; reason: "sign-in" | "request" };

export async function signalRequest(request: PendingRequest, signal: RequestSignal) {
  try {
    await resumeHook<RequestSignal>(request.hookToken, signal);
  } catch (error) {
    // Completion can win a race with a second click or an auth-state refresh.
    if (!HookNotFoundError.is(error)) throw error;
    await forgetRequest(request.runId);
  }
}

export async function refreshPendingRequests(
  installationId: string,
  userId: string,
  exceptRunId?: string,
) {
  const requests = await listPendingRequests(installationId, userId);
  // Dispatch every refresh even if another request's wake fails.
  const results = await Promise.allSettled(
    requests
      .filter((request) => request.runId !== exceptRunId)
      .map((request) => signalRequest(request, { type: "refresh" })),
  );
  const failed = results.find((result) => result.status === "rejected");
  if (failed?.status === "rejected") throw failed.reason;
}

export async function requestForSignIn(context: ThreadSignInContext) {
  if (!context.requestId) throw new Error("This sign-in request is no longer available.");
  const request = await getRequest(context.requestId);
  if (
    !request ||
    request.installationId !== installationKey(context) ||
    request.userId !== context.userId ||
    request.channel !== context.channel ||
    request.ts !== context.ts
  ) {
    throw new Error("This sign-in request is no longer available.");
  }
  return request;
}

export async function handleRequestAction(
  input: { requestId: string; installationId: string; userId: string; channel: string; ts: string },
  signal: RequestSignal,
) {
  const request = await getRequest(input.requestId);
  if (
    !request ||
    request.installationId !== input.installationId ||
    request.userId !== input.userId ||
    request.channel !== input.channel ||
    (request.promptTs && request.promptTs !== input.ts)
  ) {
    return;
  }
  await signalRequest(request, signal);
}

export async function uninstallInstallation(query: {
  teamId?: string;
  enterpriseId?: string;
  isEnterpriseInstall?: boolean;
}) {
  const installationId = installationKey(query);
  if (!installationId) return;
  await markInstallationUninstalling(installationId);
  const requests = await listPendingRequests(installationId);
  // No Slack calls: the app's token can already be revoked at this point.
  const results = await Promise.allSettled(
    requests.map(async (request) => {
      const run = getRun(request.runId);
      try {
        await run.cancel({ cancelReason: "Slack app uninstalled" });
      } catch (error) {
        if (WorkflowRunNotFoundError.is(error)) return;
        if (EntityConflictError.is(error)) {
          const status = await run.status;
          if (status === "completed" || status === "failed" || status === "cancelled") return;
        }
        throw error;
      }
    }),
  );
  const failed = results.find((result) => result.status === "rejected");
  if (failed?.status === "rejected") throw failed.reason;
  await removeInstallation(installationId);
}
