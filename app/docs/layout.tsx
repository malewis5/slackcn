import Link from "next/link";

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="shell docs-layout">
      <aside className="docs-sidebar">
        <nav aria-label="Documentation">
          <p className="eyebrow">Getting started</p>
          <Link href="/docs">Introduction</Link>
          <p className="eyebrow">Components</p>
          <Link href="/docs/components/sign-in-message">Sign-in message</Link>
        </nav>
      </aside>
      <main id="content" className="docs-content">
        {children}
      </main>
    </div>
  );
}
