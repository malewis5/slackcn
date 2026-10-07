import type { Installation, InstallationQuery, InstallationStore } from "@slack/bolt";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { installations, signInPrompts, signedInUsers } from "@/lib/db/schema";

export function installationKey(query: {
  teamId?: string;
  enterpriseId?: string;
  isEnterpriseInstall?: boolean;
}) {
  if (query.isEnterpriseInstall && query.enterpriseId) return query.enterpriseId;
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

async function removeInstallation(id: string) {
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
          installation: row.installation,
        },
      });
  },

  async fetchInstallation(query) {
    const id =
      query.isEnterpriseInstall && query.enterpriseId !== undefined
        ? query.enterpriseId
        : query.teamId;
    if (!id) throw new Error("Failed fetching installation");

    const [row] = await getDb()
      .select()
      .from(installations)
      .where(eq(installations.id, id))
      .limit(1);
    return row?.installation as Installation;
  },

  async deleteInstallation(query) {
    if (query.isEnterpriseInstall && query.enterpriseId !== undefined) {
      await removeInstallation(query.enterpriseId);
      return;
    }
    if (query.teamId !== undefined) {
      await removeInstallation(query.teamId);
      return;
    }
    throw new Error("Failed to delete installation");
  },
};

export async function deleteInstallation(query: InstallationQuery<boolean>) {
  const id = installationKey(query);
  if (!id) return;
  await removeInstallation(id);
}

export async function isSignedIn(installationId: string, userId: string) {
  const [row] = await getDb()
    .select({ userId: signedInUsers.userId })
    .from(signedInUsers)
    .where(
      and(eq(signedInUsers.installationId, installationId), eq(signedInUsers.userId, userId)),
    )
    .limit(1);
  return row !== undefined;
}

export async function signInUser(installationId: string, userId: string) {
  await getDb().insert(signedInUsers).values({ installationId, userId }).onConflictDoNothing();
}

export async function signOutUser(installationId: string, userId: string) {
  await getDb()
    .delete(signedInUsers)
    .where(
      and(eq(signedInUsers.installationId, installationId), eq(signedInUsers.userId, userId)),
    );
}

export async function rememberSignInPrompt(
  installationId: string,
  userId: string,
  prompt: { channel: string; ts: string },
) {
  await getDb()
    .insert(signInPrompts)
    .values({ installationId, userId, channel: prompt.channel, ts: prompt.ts })
    .onConflictDoNothing();
}

export async function forgetSignInPrompt(
  installationId: string,
  userId: string,
  prompt: { channel: string; ts: string },
) {
  await getDb()
    .delete(signInPrompts)
    .where(
      and(
        eq(signInPrompts.installationId, installationId),
        eq(signInPrompts.userId, userId),
        eq(signInPrompts.channel, prompt.channel),
        eq(signInPrompts.ts, prompt.ts),
      ),
    );
}

export async function takeSignInPrompts(installationId: string, userId: string) {
  return getDb()
    .delete(signInPrompts)
    .where(
      and(eq(signInPrompts.installationId, installationId), eq(signInPrompts.userId, userId)),
    )
    .returning({ channel: signInPrompts.channel, ts: signInPrompts.ts });
}
