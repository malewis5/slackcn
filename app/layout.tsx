import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "slackcn — Building blocks for better bots", template: "%s · slackcn" },
  description: "Block Kit components and TypeScript helpers you can copy, customize, and own.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#content">
          Skip to content
        </a>
        <header className="site-header">
          <div className="shell header-inner">
            <Link href="/" className="brand">
              <span aria-hidden="true">▦</span> slackcn
            </Link>
            <nav aria-label="Main navigation">
              <Link href="/docs">Docs</Link>
              <Link href="/docs/components/sign-in-message">Components</Link>
              <a href="https://github.com/malewis5/slackcn">GitHub ↗</a>
            </nav>
          </div>
        </header>
        {children}
        <footer className="shell site-footer">
          <span>slackcn · Built for the conversation.</span>
          <a href="https://ui.shadcn.com/docs/registry">Distributed with shadcn ↗</a>
        </footer>
      </body>
    </html>
  );
}
