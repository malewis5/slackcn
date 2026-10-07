import type { Metadata } from "next";
import { CodeBlock } from "@/components/code-block";
import { SignInPreview } from "@/components/sign-in-preview";
import { signInMessage } from "@/registry/slack/sign-in-message";

export const metadata: Metadata = { title: "Sign-in message" };

const usage = `import { signInMessage } from "./slackcn/sign-in-message";

// Use your existing Slack WebClient and verified event context.
const message = await slack.chat.postMessage({
  channel: channelId,
  thread_ts: threadTs,
  ...signInMessage({
    userId: requesterId,
    signInUrl: "https://your-app.example/sign-in",
  }),
});

// Retain message.channel and message.ts for later update/deletion.`;

export default function SignInMessagePage() {
  return (
    <>
      <p className="eyebrow">Components / Messages</p>
      <h1>Sign-in message</h1>
      <p className="lede">
        A public status for the thread. A sign-in button for the person who needs it.
      </p>
      <SignInPreview />
      <h2>Installation</h2>
      <CodeBlock label="Terminal">
        {"pnpm dlx shadcn@latest add http://localhost:3000/r/sign-in-message.json"}
      </CodeBlock>
      <p>
        Use the running registry’s origin. This installs <code>slackcn/sign-in-message.ts</code>
        and <code>@slack/types</code> in your project.
      </p>
      <h2>Usage</h2>
      <CodeBlock label="Your bot handler">{usage}</CodeBlock>
      <p>
        Send this with <code>chat.postMessage</code> to keep the status visible to everyone in the
        thread. The{" "}
        <a href="https://docs.slack.dev/reference/block-kit/block-elements/button-element/">
          button’s <code>visible_to_user_ids</code> field
        </a>{" "}
        limits who sees the button.
      </p>
      <p>
        Slack still sends an interaction payload for URL buttons. Acknowledge the
        <code> slackcn.sign_in </code> action in your interaction handler.
      </p>
      <h2>What this helper covers</h2>
      <p>
        This item only builds the message payload. It does not authenticate users, pause or resume a
        bot, remove messages, or manage errors. Those are the next part of the sign-in flow.
      </p>
      <p>
        Button visibility is a presentation setting. Your authentication callback must still verify
        the user and bind the sign-in attempt to the requester. Use an expiring, single-use state
        value for that attempt.
      </p>
      <p>
        With Chat SDK, post this payload through the Slack adapter’s native
        <code> webClient.chat.postMessage </code> method to preserve the Slack-specific field.
      </p>
      <h2>Block Kit payload</h2>
      <CodeBlock label="Generated JSON">
        {JSON.stringify(
          signInMessage({
            userId: "U123",
            signInUrl: "https://your-app.example/sign-in",
          }),
          null,
          2,
        )}
      </CodeBlock>
      <p>
        <a href="/r/sign-in-message.json" target="_blank" rel="noreferrer">
          View registry item JSON ↗
        </a>
      </p>
    </>
  );
}
