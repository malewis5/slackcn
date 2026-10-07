import type { KnownBlock } from "@slack/types";

export function helloMessage(userId: string) {
  const text = `Hi, <@${userId}>!`;
  return {
    text,
    blocks: [
      { type: "section", text: { type: "mrkdwn", text } },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "Say hello" },
            action_id: "hello.say",
            value: "hello",
          },
        ],
      },
    ] satisfies KnownBlock[],
  };
}
