import type { AllMiddlewareArgs, BlockAction, SlackActionMiddlewareArgs } from "@slack/bolt";
import { installationKey } from "@/lib/database";
import { handleRequestAction, type RequestSignal } from "@/lib/requests";

type ActionArgs = AllMiddlewareArgs & SlackActionMiddlewareArgs<BlockAction>;

export const signInCallback = async ({ ack }: ActionArgs) => {
  await ack();
};

async function requestAction({ ack, body, context, action }: ActionArgs, signal: RequestSignal) {
  await ack();
  const installationId = installationKey(context);
  const channel = body.channel?.id;
  const ts = body.message?.ts;
  const requestId = "value" in action ? action.value : undefined;
  if (!installationId || !channel || !ts || !requestId) return;

  await handleRequestAction(
    { installationId, userId: body.user.id, channel, ts, requestId },
    signal,
  );
}

export const continueCallback = (args: ActionArgs) => requestAction(args, { type: "continue" });
export const cancelContinueCallback = (args: ActionArgs) =>
  requestAction(args, { type: "cancel", reason: "request" });
export const cancelSignInCallback = (args: ActionArgs) =>
  requestAction(args, { type: "cancel", reason: "sign-in" });
