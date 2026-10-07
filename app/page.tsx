import Link from "next/link";
import { SignInPreview } from "@/components/sign-in-preview";
import registry from "@/registry.json";

export default function Home() {
  return (
    <main id="content" className="shell">
      <section className="hero">
        <p className="eyebrow">A component registry for Slack</p>
        <h1>
          Better bots.
          <br />
          <span>Block by block.</span>
        </h1>
        <p className="lede">
          Thoughtful Block Kit components and TypeScript helpers. Add the source to your app. Make
          it your own.
        </p>
        <div className="hero-actions">
          <Link href="/docs" className="button">
            Get started <span aria-hidden="true">→</span>
          </Link>
          <a href="https://ui.shadcn.com/docs/registry" className="text-link">
            How registries work ↗
          </a>
        </div>
      </section>
      <section className="catalog" aria-labelledby="components-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">The collection</p>
            <h2 id="components-heading">Start with the small things.</h2>
          </div>
          <span className="muted">{registry.items.length} component</span>
        </div>
        <div className="component-feature">
          <div className="component-description">
            <span className="badge">01 / Messages</span>
            <h3>{registry.items[0].title}</h3>
            <p>
              Keep the thread in the loop while the person who asked signs in. A shared status, with
              a button just for them.
            </p>
            <Link href="/docs/components/sign-in-message" className="text-link">
              View component →
            </Link>
          </div>
          <SignInPreview />
        </div>
      </section>
    </main>
  );
}
