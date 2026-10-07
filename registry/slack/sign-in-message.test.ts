import { describe, expect, it } from "vitest";
import { signInMessage } from "./sign-in-message";

describe("signInMessage", () => {
  it("keeps the pending status public and limits the button to the requester", () => {
    const message = signInMessage({
      userId: "U123",
      signInUrl: "https://example.com/sign-in",
    });

    expect(message.blocks).toEqual([
      {
        type: "section",
        text: { type: "mrkdwn", text: "Waiting for <@U123> to sign in before continuing." },
      },
      {
        type: "actions",
        elements: [
          expect.objectContaining({
            type: "button",
            action_id: "slackcn.sign_in",
            url: "https://example.com/sign-in",
            visible_to_user_ids: ["U123"],
          }),
        ],
      },
    ]);
  });

  it("includes an accessible status fallback without the sign-in URL", () => {
    const message = signInMessage({
      userId: "U456",
      signInUrl: "https://example.com/sign-in?state=opaque",
    });

    expect(message.text).toBe("Waiting for <@U456> to sign in before continuing.");
    expect(message.text).not.toContain("https://");
  });
});
