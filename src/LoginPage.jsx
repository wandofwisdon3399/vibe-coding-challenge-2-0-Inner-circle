import { useState } from "react";
import "./LoginPage.css";
import heroImage from "./assets/login-hero.jpg";

const AUTH_URL = "/api/auth";

export default function LoginPage({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showLostHint, setShowLostHint] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();

    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${AUTH_URL}/login`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: username.trim(),
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Login failed.");
      }

      onLogin(data.user);
    } catch (err) {
      setError(err.message || "Unable to connect to the server.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="lp-page">
      <aside className="lp-visual">
        <img className="lp-photo" src={heroImage} alt="" />
        <div className="lp-shade" />

        <div className="lp-visual-footer">
          <div className="lp-logo">
            <span className="lp-logo-mark">S</span>
            <strong>SportSync</strong>
          </div>
          <span className="lp-copy">© 2026 SportSync Academy</span>
        </div>
      </aside>

      <main className="lp-form-side">
        <header className="lp-top">
          <strong>SportSync Academy</strong>
          <span>Academy Management Platform</span>
        </header>

        <div className="lp-form-wrap">
          <h1>
            Welcome, login to
            <br />
            your account.
          </h1>

          <form onSubmit={handleSubmit} className="lp-form">
            <label htmlFor="lp-username">Username, email or Player ID</label>
            <input
              id="lp-username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="name@domain.com or SA-0001"
              autoComplete="username"
              required
            />

            <label htmlFor="lp-password">Password</label>
            <div className="lp-password">
              <input
                id="lp-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                className="lp-toggle"
                onClick={() => setShowPassword((value) => !value)}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>

            {error && (
              <div className="lp-error" role="alert">
                {error}
              </div>
            )}

            <div className="lp-actions">
              <button className="lp-submit" type="submit" disabled={loading}>
                {loading ? "Signing in..." : "Sign In Here"}
              </button>

              <button
                type="button"
                className="lp-lost"
                onClick={() => setShowLostHint((value) => !value)}
              >
                Lost your password?
              </button>
            </div>

            {showLostHint && (
              <p className="lp-hint">
                Online password reset is not available yet. Please ask your
                academy admin to help you get back in.
              </p>
            )}
          </form>
        </div>

        <footer className="lp-bottom">
          <span>Secure access to your academy workspace</span>
        </footer>
      </main>
    </div>
  );
}
