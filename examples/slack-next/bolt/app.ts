import { App } from "@slack/bolt";
import { VercelReceiver } from "@vercel/slack-bolt";
import { installationStore } from "@/lib/database";
import registerListeners from "./listeners";

const receiver = new VercelReceiver({
  clientId: process.env.SLACK_CLIENT_ID,
  clientSecret: process.env.SLACK_CLIENT_SECRET,
  installationStore,
  scopes: ["chat:write", "chat:write.public", "app_mentions:read"],
  installerOptions: {
    directInstall: true,
    stateVerification: false,
  },
});

const app = new App({
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  clientId: process.env.SLACK_CLIENT_ID,
  clientSecret: process.env.SLACK_CLIENT_SECRET,
  installationStore,
  receiver,
  deferInitialization: true,
});

registerListeners(app);

export { app, receiver };
