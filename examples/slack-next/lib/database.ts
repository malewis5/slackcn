import { MemoryInstallationStore, type InstallationQuery } from "@slack/bolt";

export const signedInUsers = new Map<string, Set<string>>();
export const installationStore = new MemoryInstallationStore();

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
}
