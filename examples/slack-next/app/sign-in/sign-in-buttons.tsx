"use client";

import { useState } from "react";
import type { SignInContext } from "@/lib/sign-in-context";
import { goBack, signIn } from "./actions";

type SlackReturnLinks = { app: string; web: string };

export function SignInButtons({ context }: { context: SignInContext }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  async function run(action: (context: SignInContext) => Promise<SlackReturnLinks>) {
    setPending(true);
    setError(undefined);
    try {
      const links = await action(context);
      window.location.assign(links.app);
      window.setTimeout(() => window.location.assign(links.web), 700);
    } catch (caught) {
      setPending(false);
      setError(caught instanceof Error ? caught.message : "Something went wrong.");
    }
  }

  return (
    <div className="flex gap-3">
      <button
        type="button"
        disabled={pending}
        onClick={() => run(signIn)}
        className="rounded-md bg-[#611f69] px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
      >
        Sign in
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => run(goBack)}
        className="rounded-md border border-current px-4 py-2 text-sm font-bold disabled:opacity-50"
      >
        Go Back
      </button>
      {error ? <p className="text-sm">{error}</p> : null}
    </div>
  );
}
