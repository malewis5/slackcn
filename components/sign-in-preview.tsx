export function SignInPreview() {
  return (
    <figure className="preview">
      <div className="slack-message">
        <span className="bot-avatar" aria-hidden="true">
          ▦
        </span>
        <div>
          <div className="message-heading">
            <strong>Your bot</strong>
            <span className="app-label">APP</span>
            <span className="message-time">10:24 AM</span>
          </div>
          <p>
            Waiting for <span className="mention">@alex</span> to sign in before continuing.
          </p>
          <span className="preview-action">Sign in</span>
        </div>
      </div>
      <figcaption>Illustrative preview · Only Alex sees the sign-in button.</figcaption>
    </figure>
  );
}
