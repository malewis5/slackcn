# Slack sign-in example

A small Next.js backend and fake web sign-in page using Slack Bolt, Postgres, and Vercel Workflow. This example owns the app wiring; the registry's Block Kit builders remain independent of Workflow.

## Run locally

Use Node.js 24 and pnpm. From this directory:

```sh
pnpm install
pnpm db:migrate
pnpm dev
```

Set these values in `.env.local`:

```dotenv
DATABASE_URL=postgresql://localhost:5432/slackcn
SLACK_CLIENT_ID=
SLACK_CLIENT_SECRET=
SLACK_SIGNING_SECRET=
```

Expose the Next.js server through your usual tunnel. Set Slack's event request URL and interactivity URL to `/api/webhooks/slack`, and its OAuth redirect URL to `/api/slack/oauth-redirect` on that host. Enable `app_mention`, `app_home_opened`, and `app_uninstalled` bot events and the Home tab. The install route requests `chat:write`, `chat:write.public`, and `app_mentions:read`. Add the app through the site's **Add to Slack** button.

The sign-in links use `getBaseURL()`: localhost in development, the deployment URL in Vercel previews, and the production URL in production. When testing through a tunnel, forward the same local server so browser callbacks and Workflow share one runtime.

## Sign-in middleware

`slack-proxy.ts` selects the events and actions that require sign-in:

```ts
export const config = {
  matcher: [{ event: "app_mention" }, { action_id: "hello.say" }],
};
```

Matchers use exact event names and Block Kit `action_id` values. Omit `matcher` to protect all business requests, or use `matcher: []` to protect none. Sign In, Sign Out, Continue, Cancel, and uninstall controls bypass the gate and keep their own listeners.

Register the global middleware before your existing listeners in `bolt/app.ts`:

```ts
app.use(slackProxy);
registerListeners(app);
```

The middleware runs before application listeners. Unmatched requests call `next()` normally. Matched requests are acknowledged and handed to `workflows/request.ts`, which deduplicates the delivery and awaits `signInMiddleware(request, config)`. Signed-in users proceed without a prompt. Signed-out users wait for sign-in; success deletes the prompt and delivers the saved body to the existing Bolt listeners. Cancellation stops that delivery.

Keep business logic in `bolt/listeners`. To protect another message action, register its normal `app.action()` listener and add its `action_id` to the matcher. Listeners do not normalize requests, start workflows, or handle sign-in. `workflows/dispatch.ts` uses `app.processEvent()` to rebuild Bolt's normal `event`, `action`, `say`, and `client` arguments with current installation credentials. Its internal context marker bypasses the gate during this delivery; a field in Slack's payload cannot set that marker.

Only request data crosses the workflow boundary, never a client or `next()` callback. Deferred deliveries run in a Workflow step, so listener failures can retry. The example uses `context.slackcnClientMessageId` when posting to avoid repeating its response on a retry; your own handlers should make their effects idempotent too. Expiring `trigger_id` values, response URLs, and token fields are stripped. Use the current `client` or `say` for work after sign-in, rather than an expired `respond()` or modal trigger.

This example gates channel events with `user`, `channel`, and `ts`, and message-backed Block Kit actions. A matched request without that context fails before its listener runs. Home and uninstall retain their own listeners.

The hello example replies with **Say hello**. Sign out from Home, then click that button to test an action pausing for sign-in and resuming the same handler. Two clicks on a message are independent requests; redelivery of the same click has the same `action_ts` and is deduplicated.

## Lifecycle

Every matched business request starts `workflows/request.ts`. A deterministic delivery hook identifies the original event or action, so repeated Slack deliveries do not repeat auth prompts or business work, even for signed-in users. This hook stays reserved for one day after its creation (or for the entire run if it pauses longer). The middleware creates a separate sign-in hook only when it needs to wait and disposes it when the gate returns. Requests do not expire.

| Action                           | Result                                                                                                                                     |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Matched request while signed in  | Run its handler immediately, without an auth prompt.                                                                                       |
| Matched request while signed out | Post Sign In / Cancel and pause. Buttons are visible only to that user.                                                                    |
| Sign in from a thread            | Sign in, publish Home, delete that request's prompt, resume its handler, and offer Continue / Cancel on the user's other pending requests. |
| Sign in from Home                | Sign in, publish Home, offer Continue / Cancel on all pending requests, and resume none.                                                   |
| Continue                         | Recheck sign-in, delete the prompt, and resume only that request's handler. A stale click after sign-out shows Sign In again.              |
| Cancel or thread web Go Back     | Replace that prompt with `<@user> cancelled sign-in` and finish that request.                                                              |
| Cancel on Continue               | Replace that prompt with `<@user> cancelled the request` and finish it. The user stays signed in.                                          |
| Home web Go Back                 | Return to Home without changing sign-in or requests.                                                                                       |
| Sign out                         | Publish signed-out Home and switch pending requests to Sign In / Cancel. Keep them paused.                                                 |
| Uninstall                        | Cancel runs for that installation and delete its users and directory rows, without calling Slack.                                          |

Two mentions in the same thread remain two independent requests. `pending_requests` is only the lookup by installation and user; the workflow owns the original event or action, signals, and execution. The middleware deletes its directory entry before the business handler runs. Workspace installs use the team ID, and organization installs use the enterprise ID.

`workflows/sign-in-steps.ts` contains only the authentication effects. Auth refresh signals read the latest database state rather than trusting a signed-in boolean sent earlier. Hook registration finishes before a prompt is posted, so an immediate click can be delivered safely. The example response lives in the ordinary mention and hello listeners; replace or extend them without changing the sign-in gate.

The sign-in page is intentionally fake: it marks the user from its URL as signed in. Replace that with verified app authentication before using it outside local testing. Slack interactions validate the acting user, installation, and request before signalling a workflow. Tokens are loaded inside server code and are never serialized into workflow arguments.

The workflow migration replaces the previous `sign_in_prompts` directory. Existing installations and signed-in users are preserved; old prompts have no workflow to resume, so create fresh mentions after migrating.

For local testing after this refactor, create fresh mentions: already-paused runs reference the previous workflow and step names.

## Checks

From this directory, run `pnpm lint`, `pnpm exec tsc --noEmit`, and `pnpm build`. From the repository root, run the lifecycle tests:

```sh
pnpm exec vitest run --config examples/slack-next/tests/vitest.config.mts
```

Use `pnpm exec workflow inspect runs` or `pnpm exec workflow web` from this directory to inspect local runs. Local durability is stored on disk under `.workflow-data`; keep that directory between restarts. Vercel provides the managed runtime when deployed.
