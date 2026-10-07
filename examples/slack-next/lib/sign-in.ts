import type { KnownBlock } from "@slack/types";
import type { InstallationQuery } from "@slack/bolt";
import { getBaseURL } from "slackcn/utils";
import {
  forgetSignInPrompt,
  installationKey,
  installationStore,
  signInUser,
  signOutUser,
  takeSignInPrompts,
} from "@/lib/database";

type WorkspaceSignIn = {
  userId: string;
  teamId: string;
  enterpriseId?: string;
  isEnterpriseInstall: boolean;
};

export type ThreadSignInContext = WorkspaceSignIn & {
  channel: string;
  /** Mention message timestamp. */
  ts: string;
  threadTs?: string;
  /** Waiting message timestamp, so Go Back can update it. */
  promptTs?: string;
};

export type HomeSignInContext = WorkspaceSignIn & {
  home: true;
};

export type SignInContext = ThreadSignInContext | HomeSignInContext;

function param(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function parseSignInContext(
  searchParams: Record<string, string | string[] | undefined>,
): SignInContext | undefined {
  const userId = param(searchParams.user);
  const teamId = param(searchParams.team);
  const channel = param(searchParams.channel);
  const ts = param(searchParams.ts);
  if (!userId || !teamId) return undefined;

  const workspace = {
    userId,
    teamId,
    enterpriseId: param(searchParams.enterprise),
    isEnterpriseInstall: param(searchParams.enterprise_install) === "1",
  };
  if (param(searchParams.home) === "1") return { ...workspace, home: true as const };

  if (!channel || !ts) return undefined;
  return {
    ...workspace,
    channel,
    ts,
    threadTs: param(searchParams.thread_ts),
    promptTs: param(searchParams.prompt_ts),
  };
}

export function signInPageUrl(context: SignInContext) {
  const params = new URLSearchParams({
    user: context.userId,
    team: context.teamId,
  });
  if (context.enterpriseId) params.set("enterprise", context.enterpriseId);
  if (context.isEnterpriseInstall) params.set("enterprise_install", "1");
  if ("home" in context) {
    params.set("home", "1");
    return `${getBaseURL()}/sign-in?${params.toString()}`;
  }

  params.set("channel", context.channel);
  params.set("ts", context.ts);
  if (context.threadTs) params.set("thread_ts", context.threadTs);
  if (context.promptTs) params.set("prompt_ts", context.promptTs);
  return `${getBaseURL()}/sign-in?${params.toString()}`;
}

/** Opens the native Slack client on the mention, in its thread. */
export function slackDeepLink(context: ThreadSignInContext) {
  const params = new URLSearchParams({
    team: context.teamId,
    id: context.channel,
    message: context.ts,
    thread_ts: context.threadTs ?? context.ts,
  });
  return `slack://channel?${params.toString()}`;
}

/** Web permalink for the same message and thread. Slack hands this off to the desktop app. */
export function slackWebLink(context: ThreadSignInContext) {
  const threadTs = context.threadTs ?? context.ts;
  const search = new URLSearchParams({ thread_ts: threadTs, cid: context.channel });
  const message = context.ts.replace(".", "");
  return `https://slack.com/archives/${context.channel}/p${message}?${search.toString()}`;
}

export function slackReturnLinks(context: ThreadSignInContext) {
  return { app: slackDeepLink(context), web: slackWebLink(context) };
}

/** Opens App Home in the desktop app, then in the browser. */
export function appHomeReturnLinks(teamId: string, appId: string) {
  const app = `slack://app?${new URLSearchParams({ team: teamId, id: appId, tab: "home" })}`;
  const web = `https://slack.com/app_redirect?${new URLSearchParams({ app: appId, team: teamId })}`;
  return { app, web };
}

export function signedInMessage(userId: string) {
  const text = `Hi, <@${userId}>!`;
  return {
    text,
    blocks: [{ type: "section", text: { type: "mrkdwn", text } }] satisfies KnownBlock[],
  };
}

export function cancelledSignInMessage(userId: string) {
  const text = `<@${userId}> cancelled sign-in`;
  return {
    text,
    blocks: [{ type: "section", text: { type: "mrkdwn", text } }] satisfies KnownBlock[],
  };
}

export function cancelledRequestMessage(userId: string) {
  const text = `<@${userId}> cancelled the request`;
  return {
    text,
    blocks: [{ type: "section", text: { type: "mrkdwn", text } }] satisfies KnownBlock[],
  };
}

export async function cancelSignIn(
  update: (message: {
    channel: string;
    ts: string;
    text: string;
    blocks: KnownBlock[];
  }) => Promise<unknown>,
  input: { installationId?: string; userId: string; channel: string; ts: string },
) {
  if (input.installationId) await signOutUser(input.installationId, input.userId);
  await update({
    channel: input.channel,
    ts: input.ts,
    ...cancelledSignInMessage(input.userId),
  });
}

async function slackInstallation(context: SignInContext) {
  const installation = await installationStore.fetchInstallation({
    teamId: context.teamId,
    enterpriseId: context.enterpriseId,
    isEnterpriseInstall: context.isEnterpriseInstall,
  } as InstallationQuery<boolean>);
  const token = installation?.bot?.token;
  if (!token) throw new Error("Add this app to Slack again, then retry.");
  return { token, appId: installation.appId };
}

type SlackUpdate = (message: {
  channel: string;
  ts: string;
  text: string;
  blocks: KnownBlock[];
}) => Promise<unknown>;

export async function showSignedInInThreads(
  update: SlackUpdate,
  installationId: string,
  userId: string,
) {
  const message = signedInMessage(userId);
  for (const prompt of await takeSignInPrompts(installationId, userId)) {
    await update({ channel: prompt.channel, ts: prompt.ts, ...message });
  }
}

async function publishHome(token: string, installationId: string, context: SignInContext) {
  const { publishAppHome } = await import("@/bolt/listeners/events/app-home-opened");
  await publishAppHome(
    {
      views: {
        publish: (args) => slackApi(token, "views.publish", args),
      },
    },
    installationId,
    context.userId,
    {
      teamId: context.teamId,
      enterpriseId: context.enterpriseId,
      isEnterpriseInstall: context.isEnterpriseInstall,
    },
  );
}

async function offerContinueInThreads(
  update: SlackUpdate,
  installationId: string,
  userId: string,
) {
  const { continueHereMessage } = await import("@/bolt/listeners/events/app-mention");
  const message = continueHereMessage(userId);
  for (const prompt of await takeSignInPrompts(installationId, userId)) {
    await update({ channel: prompt.channel, ts: prompt.ts, ...message });
  }
}

async function slackApi(token: string, method: string, body: object) {
  const response = await fetch(`https://slack.com/api/${method}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(body),
  });
  const result = (await response.json()) as { ok: boolean; error?: string };
  if (!result.ok) throw new Error(result.error ?? `${method} failed`);
}

function returnLinks(context: SignInContext, appId: string | undefined) {
  if ("home" in context) {
    if (!appId) throw new Error("Add this app to Slack again, then retry.");
    return appHomeReturnLinks(context.teamId, appId);
  }
  return slackReturnLinks(context);
}

export async function completeSignIn(context: SignInContext) {
  const installationId = installationKey(context);
  if (!installationId) throw new Error("Missing workspace.");

  const { token, appId } = await slackInstallation(context);
  await signInUser(installationId, context.userId);
  await publishHome(token, installationId, context);
  const update = (message: Parameters<SlackUpdate>[0]) => slackApi(token, "chat.update", message);
  if ("home" in context) await offerContinueInThreads(update, installationId, context.userId);
  else await showSignedInInThreads(update, installationId, context.userId);

  return returnLinks(context, appId);
}

export async function goBack(context: SignInContext) {
  const installationId = installationKey(context);
  if (!installationId) throw new Error("Missing workspace.");

  const { token, appId } = await slackInstallation(context);
  if ("home" in context) {
    await publishHome(token, installationId, context);
    return returnLinks(context, appId);
  }

  if (context.promptTs) {
    await cancelSignIn((message) => slackApi(token, "chat.update", message), {
      installationId,
      userId: context.userId,
      channel: context.channel,
      ts: context.promptTs,
    });
    await forgetSignInPrompt(installationId, context.userId, {
      channel: context.channel,
      ts: context.promptTs,
    });
  } else {
    await signOutUser(installationId, context.userId);
  }

  await publishHome(token, installationId, context);
  return slackReturnLinks(context);
}
