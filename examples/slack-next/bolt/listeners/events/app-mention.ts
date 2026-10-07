import type { AllMiddlewareArgs, SlackEventMiddlewareArgs } from "@slack/bolt";
import { generateText } from "ai";

export const appMentionCallback = async ({
  event,
  say,
  setStatus,
  context,
}: AllMiddlewareArgs & SlackEventMiddlewareArgs<"app_mention">) => {
  if (!event.user) return;
  setStatus("typing...");
  const userMessage = context.botUserId
    ? event.text.replace(new RegExp(`<@${context.botUserId}(\\|[^>]+)?>\\s*`, "g"), "").trim()
    : event.text.replace(/<@[^>]+>/g, "").replace(/\s+/g, " ").trim();

  const { text } = await generateText({
    model: "anthropic/claude-sonnet-5.5",
    prompt: userMessage,
  });

  await say({
    text,
    thread_ts: event.thread_ts ?? event.ts,
  });
};
