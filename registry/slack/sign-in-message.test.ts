import { describe, expect, it, vi } from "vitest";
import { cancelSignInMessage, signInActionIds, signInMessage } from "./sign-in-message";

describe("signInMessage", () => {
  it("keeps the waiting status public with an accessible fallback", () => {
    const message = signInMessage({
      visible_to_user_ids: ["U123"],
      url: "https://example.com/sign-in",
    });

    expect(message.text).toBe("Waiting for <@U123> to sign in before continuing.");
    expect(message.blocks[0]).toEqual({
      type: "section",
      text: { type: "mrkdwn", text: message.text },
    });
  });

  it.each([["U123"], ["U123", "U456"]])(
    "restricts the sign-in link and cancel action to the supplied users: %j",
    (...visible_to_user_ids) => {
      const url = "https://example.com/sign-in?state=opaque";
      const message = signInMessage({ visible_to_user_ids, url });

      expect(message.blocks[1]).toEqual({
        type: "actions",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "Sign in", emoji: true },
            action_id: signInActionIds.signIn,
            url,
            style: "primary",
            visible_to_user_ids,
          },
          {
            type: "button",
            text: { type: "plain_text", text: "Cancel", emoji: true },
            action_id: signInActionIds.cancel,
            visible_to_user_ids,
          },
        ],
      });
      expect(signInActionIds.signIn).not.toBe(signInActionIds.cancel);
    },
  );

  it("rejects an empty list of allowed users", () => {
    expect(() =>
      signInMessage({ visible_to_user_ids: [], url: "https://example.com/sign-in" }),
    ).toThrow("at least one user ID");
  });

  it("allows a custom cancel action while keeping the sign-in link and visibility", () => {
    const message = signInMessage({
      visible_to_user_ids: ["U123"],
      url: "https://example.com/sign-in",
      action_id: "my-app.cancel",
    });

    expect(message.blocks[1]).toMatchObject({
      elements: [
        { action_id: signInActionIds.signIn, url: "https://example.com/sign-in" },
        { action_id: "my-app.cancel", visible_to_user_ids: ["U123"] },
      ],
    });
  });
});

describe("cancelSignInMessage", () => {
  it("waits for deletion before announcing the actor in the original thread", async () => {
    const deletion = Promise.withResolvers<{ ok: true }>();
    const posted = { ok: true, ts: "3.000", channel: "C123" };
    const client = {
      chat: {
        delete: vi.fn(() => deletion.promise),
        postMessage: vi.fn(async () => posted),
      },
    };

    const result = cancelSignInMessage(client, {
      channel: "C123",
      ts: "2.000",
      thread_ts: "1.000",
      user_id: "U456",
    });

    expect(client.chat.delete).toHaveBeenCalledExactlyOnceWith({ channel: "C123", ts: "2.000" });
    expect(client.chat.postMessage).not.toHaveBeenCalled();
    deletion.resolve({ ok: true });

    await expect(result).resolves.toEqual(posted);
    expect(client.chat.postMessage).toHaveBeenCalledExactlyOnceWith({
      channel: "C123",
      thread_ts: "1.000",
      text: "Canceled by <@U456>.",
    });
  });

  it.each([undefined, "2.000"])(
    "posts in the channel when the deleted prompt is a root message (thread_ts: %s)",
    async (thread_ts) => {
      const client = {
        chat: {
          delete: vi.fn(async () => ({ ok: true })),
          postMessage: vi.fn(async () => ({ ok: true })),
        },
      };

      await cancelSignInMessage(client, {
        channel: "C123",
        ts: "2.000",
        thread_ts,
        user_id: "U123",
      });

      expect(client.chat.postMessage).toHaveBeenCalledExactlyOnceWith({
        channel: "C123",
        text: "Canceled by <@U123>.",
      });
    },
  );

  it("does not announce cancellation if deletion fails", async () => {
    const error = new Error("cant_delete_message");
    const client = {
      chat: {
        delete: vi.fn().mockRejectedValue(error),
        postMessage: vi.fn(async () => ({ ok: true })),
      },
    };

    await expect(
      cancelSignInMessage(client, { channel: "C123", ts: "2.000", user_id: "U123" }),
    ).rejects.toBe(error);
    expect(client.chat.postMessage).not.toHaveBeenCalled();
  });

  it("propagates a failed confirmation to the caller", async () => {
    const error = new Error("channel_not_found");
    const client = {
      chat: {
        delete: vi.fn(async () => ({ ok: true })),
        postMessage: vi.fn().mockRejectedValue(error),
      },
    };

    await expect(
      cancelSignInMessage(client, { channel: "C123", ts: "2.000", user_id: "U123" }),
    ).rejects.toBe(error);
    expect(client.chat.delete).toHaveBeenCalledTimes(1);
  });
});
