import type { App } from "@slack/bolt";
import {
  signOutActionId,
  cancelContinueActionId,
  cancelSignInActionId,
  continueActionId,
  signInActionId,
} from "@/lib/messages";
import {
  signInCallback,
  cancelContinueCallback,
  cancelSignInCallback,
  continueCallback,
} from "./sign-in";
import signOutCallback from "./sign-out";
import { helloCallback } from "./hello";

const register = (app: App) => {
  app.action(signInActionId, signInCallback);
  app.action(cancelSignInActionId, cancelSignInCallback);
  app.action(continueActionId, continueCallback);
  app.action(cancelContinueActionId, cancelContinueCallback);
  app.action(signOutActionId, signOutCallback);
  app.action("hello.say", helloCallback);
};

const actions = { register };

export default actions;
