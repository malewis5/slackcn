import {
  cancelContinueActionId,
  cancelSignInActionId,
  continueActionId,
  signInActionId,
  signOutActionId,
} from "./messages";

export type SlackRequestTarget =
  | { type: "event"; event: { type: string } }
  | { type: "action"; action: { action_id: string } };

export type SignInConfig = {
  /** Omitted protects all business requests; an empty list protects none. */
  matcher?: readonly ({ event: string } | { action_id: string })[];
};

export function matchesSignIn(request: SlackRequestTarget, config: SignInConfig = {}) {
  // Auth controls must be able to resolve paused requests while signed out.
  if (
    request.type === "action" &&
    [
      signInActionId,
      signOutActionId,
      cancelSignInActionId,
      continueActionId,
      cancelContinueActionId,
    ].includes(request.action.action_id)
  )
    return false;
  if (
    request.type === "event" &&
    ["app_uninstalled", "app_home_opened"].includes(request.event.type)
  )
    return false;
  if (config.matcher === undefined) return true;
  return config.matcher.some((matcher) =>
    "event" in matcher
      ? request.type === "event" && request.event.type === matcher.event
      : request.type === "action" && request.action.action_id === matcher.action_id,
  );
}
