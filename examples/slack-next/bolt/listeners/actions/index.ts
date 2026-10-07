import type { App } from "@slack/bolt";
import {
  signOutActionId,
  cancelContinueActionId,
  cancelSignInActionId,
  continueActionId,
  signInActionId,
} from "../events/app-mention";
import { signInCallback, cancelContinueCallback, cancelSignInCallback, continueCallback } from "./sign-in";
import signOutCallback from "./sign-out";

const register = (app: App) => {
  app.action(signInActionId, signInCallback);
  app.action(cancelSignInActionId, cancelSignInCallback);
  app.action(continueActionId, continueCallback);
  app.action(cancelContinueActionId, cancelContinueCallback);
  app.action(signOutActionId, signOutCallback);
};

const actions = { register };

export default actions;
