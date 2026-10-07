import type { Installation, InstallationStore } from "@slack/bolt";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { installations, pendingRequests, signedInUsers } from "@/lib/db/schema";

export function installationKey(query: {
  teamId?: string;
  enterpriseId?: string;
  isEnterpriseInstall?: boolean;
}) {
  if (query.isEnterpriseInstall) return query.enterpriseId;
  return query.teamId;
}

function installationId(installation: Installation) {
  if (installation.isEnterpriseInstall && installation.enterprise !== undefined) {
    return installation.enterprise.id;
  }
  if (!installation.isEnterpriseInstall && installation.team !== undefined) {
    return installation.team.id;
  }
  throw new Error("Failed saving installation data to installationStore");
}

export async function removeInstallation(id: string) {
  await getDb().delete(installations).where(eq(installations.id, id));
}

export const installationStore: InstallationStore = {
  async storeInstallation(installation) {
    const id = installationId(installation);
    const row = {
      id,
      teamId: installation.team?.id ?? null,
      enterpriseId: installation.enterprise?.id ?? null,
      isEnterpriseInstall: installation.isEnterpriseInstall ?? false,
      uninstalling: false,
      installation,
    };
    await getDb()
      .insert(installations)
      .values(row)
      .onConflictDoUpdate({
        target: installations.id,
        set: {
          teamId: row.teamId,
          enterpriseId: row.enterpriseId,
          isEnterpriseInstall: row.isEnterpriseInstall,
          uninstalling: false,
          installation: row.installation,
        },
      });
  },

  async fetchInstallation(query) {
    const id = installationKey(query);
    if (!id) throw new Error("Failed fetching installation");

    const installation = await getInstallation(id);
    if (!installation) throw new Error("Failed fetching installation");
    return installation;
  },

  async deleteInstallation(query) {
    if (!installationKey(query)) throw new Error("Failed to delete installation");
    const { uninstallInstallation } = await import("@/lib/requests");
    await uninstallInstallation(query);
  },
};

export async function getInstallation(id: string) {
  const [row] = await getDb()
    .select()
    .from(installations)
    .where(and(eq(installations.id, id), eq(installations.uninstalling, false)))
    .limit(1);
  return row?.installation;
}

export async function markInstallationUninstalling(id: string) {
  await getDb().update(installations).set({ uninstalling: true }).where(eq(installations.id, id));
}

export async function isSignedIn(installationId: string, userId: string) {
  const [row] = await getDb()
    .select({ userId: signedInUsers.userId })
    .from(signedInUsers)
    .where(and(eq(signedInUsers.installationId, installationId), eq(signedInUsers.userId, userId)))
    .limit(1);
  return row !== undefined;
}

export async function signInUser(installationId: string, userId: string) {
  await getDb().insert(signedInUsers).values({ installationId, userId }).onConflictDoNothing();
}

export async function signOutUser(installationId: string, userId: string) {
  await getDb()
    .delete(signedInUsers)
    .where(and(eq(signedInUsers.installationId, installationId), eq(signedInUsers.userId, userId)));
}

export type PendingRequest = typeof pendingRequests.$inferSelect;

export async function rememberRequest(request: typeof pendingRequests.$inferInsert) {
  return getDb().transaction(async (tx) => {
    // Uninstall waits for registrations already in flight, then blocks new ones.
    const [installation] = await tx
      .select({ id: installations.id })
      .from(installations)
      .where(
        and(eq(installations.id, request.installationId), eq(installations.uninstalling, false)),
      )
      .for("share");
    if (!installation) return false;
    await tx.insert(pendingRequests).values(request).onConflictDoNothing();
    return true;
  });
}

export async function setPromptTimestamp(runId: string, promptTs: string) {
  await getDb().update(pendingRequests).set({ promptTs }).where(eq(pendingRequests.runId, runId));
}

export async function getRequest(runId: string) {
  const [row] = await getDb()
    .select()
    .from(pendingRequests)
    .where(eq(pendingRequests.runId, runId))
    .limit(1);
  return row;
}

export async function listPendingRequests(installationId: string, userId?: string) {
  return getDb()
    .select()
    .from(pendingRequests)
    .where(
      userId
        ? and(
            eq(pendingRequests.installationId, installationId),
            eq(pendingRequests.userId, userId),
          )
        : eq(pendingRequests.installationId, installationId),
    );
}

export async function forgetRequest(runId: string) {
  await getDb().delete(pendingRequests).where(eq(pendingRequests.runId, runId));
}
