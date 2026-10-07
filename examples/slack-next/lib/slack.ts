import { createHash } from "node:crypto";
import type { KnownBlock } from "@slack/types";
import { getInstallation } from "@/lib/database";

export function clientMessageId(key: string) {
  const hash = createHash("sha256").update(key).digest("hex");
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

// Resolve credentials at call time; never put bot tokens in workflow inputs or outputs.
export async function slackApi<T extends object = object>(
  installationId: string,
  method: string,
  body: object,
): Promise<T> {
  const installation = await getInstallation(installationId);
  const token = installation?.bot?.token;
  if (!token) throw new Error("Add this app to Slack again, then retry.");

  const response = await fetch(`https://slack.com/api/${method}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`${method} returned HTTP ${response.status}`);
  const result = (await response.json()) as T & { ok: boolean; error?: string };
  if (!result.ok) throw new Error(result.error ?? `${method} failed`);
  return result;
}

export function homeClient(installationId: string) {
  return {
    views: {
      publish: (args: { user_id: string; view: { type: "home"; blocks: KnownBlock[] } }) =>
        slackApi(installationId, "views.publish", args),
    },
  };
}
