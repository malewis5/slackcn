import { parseSignInContext } from "@/lib/sign-in-context";
import { SignInButtons } from "./sign-in-buttons";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = parseSignInContext(await searchParams);
  if (!context) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <p>This sign-in link is incomplete.</p>
      </main>
    );
  }

  return (
    <main className="flex flex-1 items-center justify-center">
      <SignInButtons context={context} />
    </main>
  );
}
