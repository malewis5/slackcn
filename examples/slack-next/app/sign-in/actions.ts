"use server";

import { completeSignIn, goBack as cancelAndReturn, type SignInContext } from "@/lib/sign-in";

export async function signIn(context: SignInContext) {
  return completeSignIn(context);
}

export async function goBack(context: SignInContext) {
  return cancelAndReturn(context);
}
