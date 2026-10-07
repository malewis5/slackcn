import {
  forgetRequest,
  getInstallation,
  getRequest,
  installationKey,
  isSignedIn,
  rememberRequest,
  setPromptTimestamp,
} from "@/lib/database";
import {
  cancelledRequestMessage,
  cancelledSignInMessage,
  continueHereMessage,
  signInPrompt,
} from "@/lib/messages";
import type { RequestSignal } from "@/lib/requests";
import { signInPageUrl, type ThreadSignInContext } from "@/lib/sign-in-context";
import { clientMessageId, slackApi } from "@/lib/slack";

export async function getSignInStatus(input: ThreadSignInContext) {
  "use step";
  const installationId = installationKey(input);
  if (!installationId || !(await getInstallation(installationId))) return "uninstalled" as const;
  return (await isSignedIn(installationId, input.userId))
    ? ("ready" as const)
    : ("waiting" as const);
}

export async function registerRequest(
  input: ThreadSignInContext,
  runId: string,
  hookToken: string,
) {
  "use step";
  const installationId = installationKey(input);
  if (!installationId) return false;
  return rememberRequest({
    runId,
    hookToken,
    installationId,
    userId: input.userId,
    channel: input.channel,
    ts: input.ts,
  });
}

export async function beginRequest(input: ThreadSignInContext, runId: string) {
  "use step";
  const request = await getRequest(runId);
  if (!request || !(await getInstallation(request.installationId))) return "uninstalled" as const;
  const signedIn = await isSignedIn(request.installationId, input.userId);
  if (signedIn) {
    if (request.promptTs) await deletePrompt(request);
    return "ready" as const;
  }
  // A retry after posting uses the same Slack message, rather than posting another.
  if (!request.promptTs) {
    const result = await slackApi<{ ts: string }>(request.installationId, "chat.postMessage", {
      channel: input.channel,
      thread_ts: input.threadTs ?? input.ts,
      client_msg_id: clientMessageId(`${runId}:sign-in`),
      ...signInPrompt(input.userId, signInPageUrl({ ...input, requestId: runId }), runId),
    });
    if (!result.ts) throw new Error("Slack did not return a message timestamp.");
    await setPromptTimestamp(runId, result.ts);
  }
  return "waiting" as const;
}

async function deletePrompt(request: {
  installationId: string;
  channel: string;
  promptTs: string | null;
}) {
  if (!request.promptTs) return;
  try {
    await slackApi(request.installationId, "chat.delete", {
      channel: request.channel,
      ts: request.promptTs,
    });
  } catch (error) {
    // A retry can follow a successful delete whose response was lost.
    if (!(error instanceof Error) || error.message !== "message_not_found") throw error;
  }
}

async function renderPending(input: ThreadSignInContext, runId: string) {
  const request = await getRequest(runId);
  if (!request?.promptTs || !(await getInstallation(request.installationId))) return false;
  // Derive the message from current auth state, not a possibly stale signal payload.
  const signedIn = await isSignedIn(request.installationId, input.userId);
  await slackApi(request.installationId, "chat.update", {
    channel: request.channel,
    ts: request.promptTs,
    ...(signedIn
      ? continueHereMessage(input.userId, runId)
      : signInPrompt(input.userId, signInPageUrl({ ...input, requestId: runId }), runId)),
  });
  return true;
}

export async function refreshRequest(input: ThreadSignInContext, runId: string) {
  "use step";
  return renderPending(input, runId);
}

export async function resolveRequest(
  input: ThreadSignInContext,
  runId: string,
  signal: Exclude<RequestSignal, { type: "refresh" }>,
) {
  "use step";
  const request = await getRequest(runId);
  if (!request?.promptTs || !(await getInstallation(request.installationId))) {
    return "uninstalled" as const;
  }
  if (signal.type === "continue" && !(await isSignedIn(request.installationId, input.userId))) {
    // A stale Continue click after sign-out must not run the user's task.
    await renderPending(input, runId);
    return "waiting" as const;
  }
  if (signal.type === "continue") {
    await deletePrompt(request);
    return "ready" as const;
  }
  const message =
    signal.reason === "sign-in"
      ? cancelledSignInMessage(input.userId)
      : cancelledRequestMessage(input.userId);
  await slackApi(request.installationId, "chat.update", {
    channel: request.channel,
    ts: request.promptTs,
    ...message,
  });
  return "cancelled" as const;
}

export async function finishRequest(runId: string) {
  "use step";
  await forgetRequest(runId);
}
