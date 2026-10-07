import type { App } from "@slack/bolt";
import actions from "./actions";
import events from "./events";

const registerListeners = (app: App) => {
  actions.register(app);
  events.register(app);
};

export default registerListeners;
