import { useState } from "react";
import "./CoachesPage.css";

// Shows newly created login details once. Styles come from CoachesPage.css.
export default function LoginCredentialsPanel({
  heading,
  roleLabel = "user",
  credentials,
  onClose,
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    const text = [
      `Username: ${credentials.username}`,
      `Temporary password: ${credentials.temporaryPassword}`,
    ].join("\n");

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      window.alert("Clipboard access was unavailable. Copy the credentials manually.");
    }
  }

  return (
    <div className="coaches-page" style={{ marginBottom: 20 }}>
      <section className="coach-credentials">
        <div className="credentials-heading">
          <div>
            <span className="credentials-icon">✓</span>
            <h2>{heading}</h2>
          </div>

          <button className="secondary-button compact" onClick={onClose}>
            Close
          </button>
        </div>

        <p>
          Share these login details securely with the {roleLabel}. The
          temporary password will not be shown again after closing.
        </p>

        <div className="credentials-grid">
          <div>
            <span>Username</span>
            <strong>{credentials.username}</strong>
          </div>

          <div>
            <span>Temporary Password</span>
            <strong className="temporary-password">
              {credentials.temporaryPassword}
            </strong>
          </div>
        </div>

        <div className="credentials-footer">
          <span>
            The {roleLabel} must change this password after their first login.
          </span>

          <button className="primary-button" onClick={copy}>
            {copied ? "✓ Copied" : "Copy Login Details"}
          </button>
        </div>
      </section>
    </div>
  );
}
