import { publishAppHome } from "@/lib/app-home";
import { getInstallation, installationKey, signInUser } from "@/lib/database";
import { refreshPendingRequests, requestForSignIn, signalRequest } from "@/lib/requests";
import { appHomeReturnLinks, slackReturnLinks, type SignInContext } from "@/lib/sign-in-context";
import { homeClient } from "@/lib/slack";

async function installationFor(context: SignInContext) {
  const installationId = installationKey(context);
  if (!installationId) throw new Error("Missing workspace.");
  const installation = await getInstallation(installationId);
  if (!installation) throw new Error("Add this app to Slack again, then retry.");
  return { installationId, installation };
}

function returnLinks(context: SignInContext, appId: string | undefined) {
  if ("home" in context) {
    if (!appId) throw new Error("Add this app to Slack again, then retry.");
    return appHomeReturnLinks(context.teamId, appId);
  }
  return slackReturnLinks(context);
}

export async function completeSignIn(context: SignInContext) {
  const { installationId, installation } = await installationFor(context);
  const request = "home" in context ? undefined : await requestForSignIn(context);

  // Fake login for this example. A real app verifies its auth session here first.
  await signInUser(installationId, context.userId);
  await publishAppHome(homeClient(installationId), installationId, context.userId, context);

  // Home sign-in refreshes all requests and resumes none. Thread sign-in resumes one.
  if (request) await signalRequest(request, { type: "continue" });
  await refreshPendingRequests(installationId, context.userId, request?.runId);
  return returnLinks(context, installation.appId);
}

export async function goBack(context: SignInContext) {
  const { installation } = await installationFor(context);
  if (!("home" in context)) {
    const request = await requestForSignIn(context);
    await signalRequest(request, { type: "cancel", reason: "sign-in" });
  }
  return returnLinks(context, installation.appId);
}
