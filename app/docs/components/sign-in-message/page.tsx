import type { Metadata } from "next";
import { CodeBlock } from "@/components/code-block";
import { SignInPreview } from "@/components/sign-in-preview";
import { getBaseURL } from "@/lib/get-base-url";
import { signInMessage } from "@/registry/slack/sign-in-message";

export const metadata: Metadata = { title: "Sign-in message" };

const usage = `import { signInMessage } from "./slackcn/sign-in-message";

// Userland decides when to send the message and who can act.
const message = await slack.chat.postMessage({
  channel: channelId,
  thread_ts: threadTs,
  ...signInMessage({
    visible_to_user_ids: [requesterId],
    url: "https://your-app.example/sign-in",
  }),
});`;

const actions = `import type { BlockAction } from "@slack/bolt";
import { cancelSignInMessage, signInActionIds } from "./slackcn/sign-in-message";

// Slack sends an interaction for URL buttons too. Acknowledge the click.
app.action(signInActionIds.signIn, async ({ ack }) => {
  await ack();
});

// In your existing Bolt app.
app.action<BlockAction>(signInActionIds.cancel, async ({ ack, body, client }) => {
  await ack();
  if (!body.channel || !body.message) return;

  // Apply your authorization and cancel any underlying work here.
  await cancelSignInMessage(client, {
    channel: body.channel.id,
    ts: body.message.ts,
    thread_ts: body.message.thread_ts,
    user_id: body.user.id,
  });
});`;

const customCancel = `signInMessage({
  visible_to_user_ids: [requesterId],
  url: "https://your-app.example/sign-in",
  action_id: "my-app.cancel",
});

// Register your own handler for "my-app.cancel".`;

export default function SignInMessagePage() {
  return (
    <>
      <p className="eyebrow">Components / Messages</p>
      <h1>Sign-in message</h1>
      <p className="lede">
        A public waiting message. Sign in and Cancel buttons for the users you choose.
      </p>
      <SignInPreview />
      <h2>Installation</h2>
      <CodeBlock label="Terminal">
        {`pnpm dlx shadcn@latest add ${getBaseURL()}/r/sign-in-message.json`}
      </CodeBlock>
      <p>
        This installs <code>slackcn/sign-in-message.ts</code>
        with <code>@slack/types</code>, <code>@slack/web-api</code>, and Node’s type definitions in
        your project.
      </p>
      <h2>Usage</h2>
      <CodeBlock label="Your bot handler">{usage}</CodeBlock>
      <p>
        Sign in opens the supplied <code>url</code> in the browser so the user can complete
        authentication on your website. Cancel remains a Slack action button.
      </p>
      <p>
        Supply one or more Slack IDs in <code>visible_to_user_ids</code>. This applies to both
        buttons. Everyone in the channel can see the waiting message; only the supplied users see
        the buttons. An empty list is rejected.
      </p>
      <p>
        Send the payload with <code>chat.postMessage</code> to keep the message public. With Chat
        SDK, use the Slack adapter’s native <code>webClient.chat.postMessage</code>
        method to preserve the Slack-specific visibility field.
      </p>
      <h2>Handle the actions</h2>
      <CodeBlock label="Example with Slack Bolt">{actions}</CodeBlock>
      <p>
        Register the exported action IDs with your Slack SDK. Slack sends an interaction when the
        sign-in link is clicked, so acknowledge it even though the URL opens directly. A click is
        separate from successful authentication; your web callback handles sign-in completion.
      </p>
      <p>
        The default <code>cancelSignInMessage</code> handler deletes the waiting message, then posts
        “Canceled by @username.” in the same thread, or in the channel if the prompt was a top-level
        message. Slack displays the name of the user who clicked Cancel.
      </p>
      <p>
        This handler updates Slack. Userland authorizes the interaction and cancels any underlying
        task before calling it. Slack API errors propagate to your handler; deletion and posting are
        separate calls, so handle retries in your application.
      </p>
      <p>
        Validate the user in your web sign-in flow and cancel handler. Button visibility controls
        presentation, not authorization.
      </p>
      <h2>Custom cancel action</h2>
      <p>
        Omit <code>action_id</code> to use <code>signInActionIds.cancel</code>, or supply your own
        Cancel button action ID and register its handler. The Sign in link keeps its acknowledgement
        action ID.
      </p>
      <CodeBlock label="Custom action ID">{customCancel}</CodeBlock>
      <h2>Block Kit payload</h2>
      <CodeBlock label="Generated JSON">
        {JSON.stringify(
          signInMessage({ visible_to_user_ids: ["U123"], url: "https://your-app.example/sign-in" }),
          null,
          2,
        )}
      </CodeBlock>
      <p>
        <a href="https://docs.slack.dev/reference/block-kit/block-elements/button-element/">
          Slack button reference ↗
        </a>
        {" · "}
        <a href="/r/sign-in-message.json" target="_blank" rel="noreferrer">
          Registry item JSON ↗
        </a>
      </p>
    </>
  );
}
