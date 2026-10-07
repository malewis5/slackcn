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

## Lifecycle

Every mention starts `workflows/mention.ts`. A deterministic hook identifies the original mention, so repeated Slack deliveries do not post another prompt. The hook stays reserved for one day after its creation (or for the entire run if it pauses longer). Requests do not expire.

| Action                       | Result                                                                                                        |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Mention while signed in      | Reply `Hi, <@user>!` and finish.                                                                              |
| Mention while signed out     | Post Sign In / Cancel and pause. Buttons are visible only to that user.                                       |
| Sign in from a thread        | Sign in, publish Home, resume that request, and offer Continue / Cancel on the user's other pending requests. |
| Sign in from Home            | Sign in, publish Home, offer Continue / Cancel on all pending requests, and resume none.                      |
| Continue                     | Recheck sign-in and resume only that request. A stale click after sign-out shows Sign In again.               |
| Cancel or thread web Go Back | Replace that prompt with `<@user> cancelled sign-in` and finish that request.                                 |
| Cancel on Continue           | Replace that prompt with `<@user> cancelled the request` and finish it. The user stays signed in.             |
| Home web Go Back             | Return to Home without changing sign-in or requests.                                                          |
| Sign out                     | Publish signed-out Home and switch pending requests to Sign In / Cancel. Keep them paused.                    |
| Uninstall                    | Cancel runs for that installation and delete its users and directory rows, without calling Slack.             |

Two mentions in the same thread remain two independent requests. `pending_requests` is only the lookup by installation and user; the workflow owns the original mention, signals, and execution. Terminal runs delete their directory entry. Workspace installs use the team ID, and organization installs use the enterprise ID.

`workflows/mention-steps.ts` contains the Slack and database effects. Replace the `Hi` continuation there with actual work. Auth refresh signals read the latest database state rather than trusting a signed-in boolean sent earlier. Hook registration finishes before a prompt is posted, so an immediate click can be delivered safely.

The sign-in page is intentionally fake: it marks the user from its URL as signed in. Replace that with verified app authentication before using it outside local testing. Slack interactions validate the acting user, installation, and request before signalling a workflow. Tokens are loaded inside server code and are never serialized into workflow arguments.

The workflow migration replaces the previous `sign_in_prompts` directory. Existing installations and signed-in users are preserved; old prompts have no workflow to resume, so create fresh mentions after migrating.

## Checks

From this directory, run `pnpm lint`, `pnpm exec tsc --noEmit`, and `pnpm build`. From the repository root, run the lifecycle tests:

```sh
pnpm exec vitest run --config examples/slack-next/tests/vitest.config.mts
```

Use `pnpm exec workflow inspect runs` or `pnpm exec workflow web` from this directory to inspect local runs. Local durability is stored on disk under `.workflow-data`; keep that directory between restarts. Vercel provides the managed runtime when deployed.
