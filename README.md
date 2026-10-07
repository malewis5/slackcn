# slackcn

Block Kit components and server-side TypeScript helpers, distributed as source through a [shadcn registry](https://ui.shadcn.com/docs/registry).

One Next.js app hosts the docs and registry. The private root package manages development tooling and release versions; nothing is published to npm.

## Development

Use Node.js 24 and the pnpm version pinned in `package.json`.

```sh
pnpm install
pnpm dev
```

Open [localhost:3000](http://localhost:3000). `dev` builds the registry once before starting Next.js. After editing registry source or its manifest, run `pnpm registry:build` again to refresh the JSON.

```sh
pnpm check          # lint, formatting, types, tests, registry and production build
pnpm format         # format source and config
pnpm test:watch     # component tests
pnpm build          # registry JSON, then Next.js
pnpm start          # serve the production build
```

## Structure

```text
app/                 Docs site and pages
components/          Website components and illustrative previews
registry/slack/      Distributable TypeScript source and colocated tests
registry.json        Registry item metadata, dependencies and install targets
public/r/            Generated registry JSON (ignored by Git)
.changeset/          Release notes and versioning configuration
.github/workflows/   CI and release PR automation
```

This follows shadcn/ui’s separation of website components and registry source within a single app. There is no separate package build, custom CLI, or monorepo orchestration.

## Install an item

With the local site running, execute this in a separate TypeScript bot project:

```sh
pnpm dlx shadcn@latest add http://localhost:3000/r/sign-in-message.json
```

The CLI copies `slackcn/sign-in-message.ts` and installs `@slack/types`. Items use `registry:item` with explicit file targets, so consumers do not need React, Next.js, or `components.json`.

The initial `sign-in-message` item is a message builder: public waiting text plus a button using `visible_to_user_ids`. The complete authentication flow—persisted pause/resume, verified callbacks, message cleanup, errors and expiry—is still to be implemented. Button visibility is not authorization. Posting the payload and acknowledging the `slackcn.sign_in` action belong to the host bot.

## Add a registry item

1. Put its portable source under `registry/slack/`. Keep website imports out of these files.
2. Add an entry to `registry.json` with type `registry:item`. List every shipped file with an explicit `target` relative to the consumer project. Declare its npm dependencies and any registry dependencies.
3. Add behavior tests alongside the source. Do not list test files in the registry manifest.
4. Add a docs page under `app/docs/components/` and a link in the docs navigation. Update the home catalog as the collection grows.
5. Run `pnpm check` and try installing the generated item into a separate project.
6. Run `pnpm changeset` for user-facing registry changes.

`shadcn build` validates the manifest and embeds source into `public/r/<name>.json`. Generated files are rebuilt in CI and during deployment. Installed source is owned by the consumer; reviewing and applying future updates is explicit.

## Releases and deployment

Changesets versions the private `slackcn` project and writes `CHANGELOG.md`. On pushes to `main`, GitHub Actions runs the checks and creates or updates a release PR. Merging it records the version and release notes. There is no npm publish step or npm token.

Enable **Allow GitHub Actions to create and approve pull requests** in the repository’s Actions settings. Changesets uses the built-in GitHub token by default. If release PRs need to trigger other workflows automatically, supply a GitHub App token or suitable fine-grained token to the action’s `github-token` input; events made by the built-in token do not trigger those workflows.

Deploy this root directory as a Next.js project, for example through Vercel’s Git integration with the private GitHub repository. Use `pnpm install --frozen-lockfile` and `pnpm build`. The docs and `/r/*.json` ship together; production follows `main`, including changes merged before a version PR. Changesets records release history rather than gating deployment.

After deployment, replace the local origin in installation examples and set `registry.json`’s `homepage` to the docs URL. The repository can remain private, but consumers must be able to fetch the deployed registry JSON. Deployment protection also protects registry endpoints; configure access accordingly. Hosting and a production domain are not configured by this scaffold.

The source is currently `UNLICENSED`. Choose a distribution license before opening the registry to outside consumers.
