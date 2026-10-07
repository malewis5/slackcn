import type { KnownBlock } from "@slack/types";
import type { InstallationQuery } from "@slack/bolt";
import { getBaseURL } from "slackcn/utils";
import {
  forgetSignInPrompt,
  installationKey,
  installationStore,
  takeSignInPrompts,
  usersFor,
} from "@/lib/database";

export type SignInContext = {
  userId: string;
  teamId: string;
  enterpriseId?: string;
  isEnterpriseInstall: boolean;
  channel: string;
  /** Mention message timestamp. */
  ts: string;
  threadTs?: string;
  /** Waiting message timestamp, so Go Back can update it. */
  promptTs?: string;
};

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
  if (!userId || !teamId || !channel || !ts) return undefined;

  return {
    userId,
    teamId,
    enterpriseId: param(searchParams.enterprise),
    isEnterpriseInstall: param(searchParams.enterprise_install) === "1",
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
    channel: context.channel,
    ts: context.ts,
  });
  if (context.enterpriseId) params.set("enterprise", context.enterpriseId);
  if (context.isEnterpriseInstall) params.set("enterprise_install", "1");
  if (context.threadTs) params.set("thread_ts", context.threadTs);
  if (context.promptTs) params.set("prompt_ts", context.promptTs);
  return `${getBaseURL()}/sign-in?${params.toString()}`;
}

/** Opens the native Slack client on the mention, in its thread. */
export function slackDeepLink(context: SignInContext) {
  const params = new URLSearchParams({
    team: context.teamId,
    id: context.channel,
    message: context.ts,
    thread_ts: context.threadTs ?? context.ts,
  });
  return `slack://channel?${params.toString()}`;
}

/** Web permalink for the same message and thread. Slack hands this off to the desktop app. */
export function slackWebLink(context: SignInContext) {
  const threadTs = context.threadTs ?? context.ts;
  const search = new URLSearchParams({ thread_ts: threadTs, cid: context.channel });
  const message = context.ts.replace(".", "");
  return `https://slack.com/archives/${context.channel}/p${message}?${search.toString()}`;
}

export function slackReturnLinks(context: SignInContext) {
  return { app: slackDeepLink(context), web: slackWebLink(context) };
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

export async function cancelSignIn(
  update: (message: {
    channel: string;
    ts: string;
    text: string;
    blocks: KnownBlock[];
  }) => Promise<unknown>,
  input: { installationId?: string; userId: string; channel: string; ts: string },
) {
  if (input.installationId) usersFor(input.installationId).delete(input.userId);
  await update({
    channel: input.channel,
    ts: input.ts,
    ...cancelledSignInMessage(input.userId),
  });
}

async function botToken(context: SignInContext) {
  const installation = await installationStore.fetchInstallation({
    teamId: context.teamId,
    enterpriseId: context.enterpriseId,
    isEnterpriseInstall: context.isEnterpriseInstall,
  } as InstallationQuery<boolean>);
  const token = installation?.bot?.token;
  if (!token) throw new Error("Add this app to Slack again, then retry.");
  return token;
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
  for (const prompt of takeSignInPrompts(installationId, userId)) {
    await update({ channel: prompt.channel, ts: prompt.ts, ...message });
  }
}

async function publishHome(token: string, installationId: string, userId: string) {
  const { publishAppHome } = await import("@/bolt/listeners/events/app-home-opened");
  await publishAppHome(
    {
      views: {
        publish: (args) => slackApi(token, "views.publish", args),
      },
    },
    installationId,
    userId,
  );
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

export async function completeSignIn(context: SignInContext) {
  const installationId = installationKey(context);
  if (!installationId) throw new Error("Missing workspace.");
  usersFor(installationId).add(context.userId);

  const token = await botToken(context);
  await publishHome(token, installationId, context.userId);
  await showSignedInInThreads(
    (message) => slackApi(token, "chat.update", message),
    installationId,
    context.userId,
  );

  return slackReturnLinks(context);
}

export async function goBack(context: SignInContext) {
  const installationId = installationKey(context);
  if (!installationId) throw new Error("Missing workspace.");

  const token = await botToken(context);
  if (context.promptTs) {
    await cancelSignIn((message) => slackApi(token, "chat.update", message), {
      installationId,
      userId: context.userId,
      channel: context.channel,
      ts: context.promptTs,
    });
    forgetSignInPrompt(installationId, context.userId, {
      channel: context.channel,
      ts: context.promptTs,
    });
  } else {
    usersFor(installationId).delete(context.userId);
  }

  await publishHome(token, installationId, context.userId);
  return slackReturnLinks(context);
}
