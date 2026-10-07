import { MemoryInstallationStore, type InstallationQuery } from "@slack/bolt";

// Next bundles the webhook and the sign-in page separately. Keep one store per process.
type SignInPrompt = { channel: string; ts: string };

const shared = globalThis as typeof globalThis & {
  slackcn?: {
    signedInUsers: Map<string, Set<string>>;
    installationStore: MemoryInstallationStore;
    pendingPrompts: Map<string, Map<string, SignInPrompt[]>>;
  };
};

shared.slackcn ??= {
  signedInUsers: new Map(),
  installationStore: new MemoryInstallationStore(),
  pendingPrompts: new Map(),
};
shared.slackcn.pendingPrompts ??= new Map();

export const signedInUsers = shared.slackcn.signedInUsers;
export const installationStore = shared.slackcn.installationStore;
const pendingPrompts = shared.slackcn.pendingPrompts;

function promptsFor(installationId: string, userId: string) {
  return pendingPrompts.get(installationId)?.get(userId) ?? [];
}

function setPrompts(installationId: string, userId: string, prompts: SignInPrompt[]) {
  const users = pendingPrompts.get(installationId) ?? new Map<string, SignInPrompt[]>();
  if (prompts.length === 0) users.delete(userId);
  else users.set(userId, prompts);
  if (users.size === 0) pendingPrompts.delete(installationId);
  else pendingPrompts.set(installationId, users);
}

export function rememberSignInPrompt(
  installationId: string,
  userId: string,
  prompt: SignInPrompt,
) {
  const prompts = promptsFor(installationId, userId);
  if (!prompts.some((item) => item.channel === prompt.channel && item.ts === prompt.ts)) {
    prompts.push(prompt);
  }
  setPrompts(installationId, userId, prompts);
}

export function forgetSignInPrompt(
  installationId: string,
  userId: string,
  prompt: { channel: string; ts: string },
) {
  setPrompts(
    installationId,
    userId,
    promptsFor(installationId, userId).filter(
      (item) => item.channel !== prompt.channel || item.ts !== prompt.ts,
    ),
  );
}

export function takeSignInPrompts(installationId: string, userId: string) {
  const prompts = promptsFor(installationId, userId);
  setPrompts(installationId, userId, []);
  return prompts;
}

export function installationKey(query: {
  teamId?: string;
  enterpriseId?: string;
  isEnterpriseInstall?: boolean;
}) {
  if (query.isEnterpriseInstall && query.enterpriseId) return query.enterpriseId;
  return query.teamId;
}

export function usersFor(installationId: string) {
  const users = signedInUsers.get(installationId) ?? new Set<string>();
  signedInUsers.set(installationId, users);
  return users;
}

export async function deleteInstallation(query: InstallationQuery<boolean>) {
  const installationId = installationKey(query);
  if (!installationId) return;

  await installationStore.deleteInstallation(query);
  signedInUsers.delete(installationId);
  pendingPrompts.delete(installationId);
}
