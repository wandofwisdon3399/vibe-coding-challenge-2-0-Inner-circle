import { useState } from "react";
import "./LoginPage.css";
import "./ChangePasswordPage.css";

const AUTH_URL = "/api/auth";
const MIN_LENGTH = 12;

export default function ChangePasswordPage({ username, onChanged, onLogout }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (newPassword.length < MIN_LENGTH) {
      setError(`New password must be at least ${MIN_LENGTH} characters.`);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("New password and confirmation do not match.");
      return;
    }

    if (newPassword === currentPassword) {
      setError("New password must be different from the temporary password.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${AUTH_URL}/change-password`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const text = await response.text();
      let data = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        throw new Error("Unexpected server response. Restart the backend and try again.");
      }

      if (!response.ok) {
        throw new Error(data.message || "Could not change password.");
      }

      onChanged(data.user);
    } catch (err) {
      setError(err.message || "Unable to connect to the server.");
    } finally {
      setLoading(false);
    }
  }

  const inputType = showPasswords ? "text" : "password";

  return (
    <div className="change-password-page">
      <div className="change-password-card">
        <div className="login-brand-icon">S</div>

        <span className="login-kicker">ACTION REQUIRED</span>
        <h2>Set your new password</h2>
        <p className="login-description">
          Signed in as <strong>{username}</strong>. For security, replace your
          temporary password before continuing.
        </p>

        <form onSubmit={handleSubmit}>
          <label className="login-label">
            Temporary password
            <input
              type={inputType}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </label>

          <label className="login-label">
            New password
            <input
              type={inputType}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder={`At least ${MIN_LENGTH} characters`}
              autoComplete="new-password"
              required
            />
          </label>

          <label className="login-label">
            Confirm new password
            <input
              type={inputType}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              required
            />
          </label>

          <label className="change-password-toggle">
            <input
              type="checkbox"
              checked={showPasswords}
              onChange={(e) => setShowPasswords(e.target.checked)}
            />
            Show passwords
          </label>

          {error && <div className="login-error">{error}</div>}

          <button className="login-submit" type="submit" disabled={loading}>
            {loading ? "Saving..." : "Change Password →"}
          </button>

          <button
            type="button"
            className="change-password-logout"
            onClick={onLogout}
          >
            Log out
          </button>
        </form>
      </div>
    </div>
  );
}
