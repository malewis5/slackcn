import type { App } from "@slack/bolt";
import {
  signOutActionId,
  cancelSignInActionId,
  signInActionId,
} from "../events/app-mention";
import { signInCallback, cancelSignInCallback } from "./sign-in";
import signOutCallback from "./sign-out";

const register = (app: App) => {
  app.action(signInActionId, signInCallback);
  app.action(cancelSignInActionId, cancelSignInCallback);
  app.action(signOutActionId, signOutCallback);
};

const actions = { register };

export default actions;
