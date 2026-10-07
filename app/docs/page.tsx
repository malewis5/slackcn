import type { Metadata } from "next";
import Link from "next/link";
import { CodeBlock } from "@/components/code-block";

export const metadata: Metadata = { title: "Introduction" };

export default function Introduction() {
  return (
    <>
      <p className="eyebrow">Documentation</p>
      <h1>Small pieces. Your code.</h1>
      <p className="lede">
        slackcn is a shadcn registry for Slack Block Kit components and server-side TypeScript
        helpers.
      </p>
      <h2>How it works</h2>
      <p>
        The shadcn CLI copies an item’s source files into your project and installs its
        dependencies. You can then read, change, and version that code alongside your bot.
      </p>
      <p>
        Registry items are plain TypeScript. Your bot does not need Next.js, React, Tailwind, or a
        shadcn configuration. This website uses Next.js to host the docs and registry JSON.
      </p>
      <h2>Try the local registry</h2>
      <p>
        Start this repository with <code>pnpm dev</code>. Then run this command in your bot project:
      </p>
      <CodeBlock label="Terminal">
        {"pnpm dlx shadcn@latest add http://localhost:3000/r/sign-in-message.json"}
      </CodeBlock>
      <p>
        Once the site is deployed, replace <code>http://localhost:3000</code> with its origin. The
        CLI needs access to the registry URL.
      </p>
      <h2>Start with a sign-in message</h2>
      <p>
        The first helper builds a visible waiting message with a requester-only sign-in button. Your
        application supplies the authentication URL and handles the workflow.
      </p>
      <Link href="/docs/components/sign-in-message" className="button">
        Sign-in message →
      </Link>
      <h2>Updating components</h2>
      <p>
        Installed files belong to your application. Review upstream changes before replacing a
        customized file; registry updates do not automatically update code you have already
        installed.
      </p>
    </>
  );
}
