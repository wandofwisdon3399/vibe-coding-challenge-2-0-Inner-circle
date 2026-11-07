import { useEffect, useState } from "react";
import LoginCredentialsPanel from "./LoginCredentialsPanel.jsx";

const API_URL = "/api/players";

async function readJson(response) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    throw new Error("Unexpected server response. Restart the backend and try again.");
  }
}

function formatDateTime(value) {
  if (!value) return "Never";
  return new Date(value).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Admin-only: shows a player's login account and creates one if missing.
export default function PlayerAccountPanel({ player }) {
  const [account, setAccount] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [credentials, setCredentials] = useState(null);

  async function load() {
    try {
      setError("");
      const response = await fetch(`${API_URL}/${player._id}/account`, {
        credentials: "include",
      });
      const data = await readJson(response);
      if (!response.ok) throw new Error(data.message || "Could not load the account.");
      setAccount(data);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player._id, player.status]);

  async function createAccount() {
    setBusy(true);
    setError("");

    try {
      const response = await fetch(`${API_URL}/${player._id}/account`, {
        method: "POST",
        credentials: "include",
      });
      const data = await readJson(response);
      if (!response.ok) throw new Error(data.message || "Could not create the account.");

      if (data.credentials) setCredentials(data.credentials);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {credentials && (
        <LoginCredentialsPanel
          heading="Player login created successfully"
          roleLabel="player"
          credentials={credentials}
          onClose={() => setCredentials(null)}
        />
      )}

      <article className="panel" style={{ marginBottom: 20 }}>
        <h2>Login Account</h2>

        {error && <p className="form-error">{error}</p>}

        {!account && !error && <p className="muted-text">Loading account...</p>}

        {account && !account.exists && (
          <>
            <p className="muted-text">
              This player has no login yet. The username will be{" "}
              <strong>{account.username || "their Player ID"}</strong>.
            </p>
            <button
              className="primary-button"
              onClick={createAccount}
              disabled={busy}
            >
              {busy ? "Creating..." : "Create Login Account"}
            </button>
          </>
        )}

        {account?.exists && (
          <dl className="info-list">
            <div><dt>Username</dt><dd>{account.username}</dd></div>
            <div>
              <dt>Access</dt>
              <dd>{account.isActive ? "Enabled" : "Disabled (player inactive)"}</dd>
            </div>
            <div>
              <dt>Password</dt>
              <dd>
                {account.mustChangePassword
                  ? "Temporary — not changed yet"
                  : "Set by the player"}
              </dd>
            </div>
            <div><dt>Last login</dt><dd>{formatDateTime(account.lastLogin)}</dd></div>
          </dl>
        )}
      </article>
    </>
  );
}
