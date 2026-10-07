import { getBaseURL } from "slackcn/utils";

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
  /** The pending workflow opened by this mention. */
  requestId?: string;
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
    requestId: param(searchParams.request),
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
  if (context.requestId) params.set("request", context.requestId);
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
