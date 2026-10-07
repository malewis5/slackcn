import { NextResponse } from "next/server";
import { getBaseURL } from "slackcn/utils";
import { receiver } from "@/bolt/app";

export async function GET(request: Request) {
  const cancelled = new URL(request.url).searchParams.get("error") === "access_denied";
  if (cancelled) return NextResponse.redirect(new URL("/", getBaseURL()));
  return receiver.handleCallback(request);
}
