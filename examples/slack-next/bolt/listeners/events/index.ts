import type { App } from "@slack/bolt";
import { appHomeOpenedCallback } from "./app-home-opened";
import { appMentionCallback } from "./app-mention";
import { appUninstalledCallback } from "./app-uninstalled";

const register = (app: App) => {
  app.event("app_mention", appMentionCallback);
  app.event("app_home_opened", appHomeOpenedCallback);
  app.event("app_uninstalled", appUninstalledCallback);
};

const events = { register };

export default events;
