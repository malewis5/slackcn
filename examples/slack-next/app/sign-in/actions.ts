"use server";

import { completeSignIn, goBack as cancelAndReturn } from "@/lib/sign-in";
import type { SignInContext } from "@/lib/sign-in-context";

export async function signIn(context: SignInContext) {
  return completeSignIn(context);
}

export async function goBack(context: SignInContext) {
  return cancelAndReturn(context);
}
