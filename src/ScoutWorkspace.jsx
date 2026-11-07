import { useEffect, useMemo, useState } from "react";
import "./ScoutWorkspace.css";

const PLAYERS_URL = "/api/players";

async function readJson(response) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    throw new Error("Unexpected server response. Please try again.");
  }
}

const fullName = (p) => `${p.firstName || ""} ${p.lastName || ""}`.trim();

const initials = (p) =>
  `${p.firstName?.[0] || ""}${p.lastName?.[0] || ""}`.toUpperCase() || "P";

const sportsOf = (p) =>
  [...new Set([p.sport, ...(p.sports || [])].filter(Boolean))];

function formatDate(value) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function Avatar({ player, large }) {
  return player.photo ? (
    <img
      className={`sw-avatar ${large ? "large" : ""}`}
      src={player.photo}
      alt={fullName(player)}
    />
  ) : (
    <div className={`sw-avatar ${large ? "large" : ""}`}>{initials(player)}</div>
  );
}

// Read-only workspace for Scout accounts. The backend only ever returns
// players who meet the Ready criteria; nothing here can edit data.
export default function ScoutWorkspace({ user, onLogout }) {
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [sport, setSport] = useState("All");
  const [selected, setSelected] = useState(null);

  async function load() {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(PLAYERS_URL, { credentials: "include" });
      const data = await readJson(response);

      if (!response.ok) {
        throw new Error(data.message || "Unable to load players.");
      }

      setPlayers(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || "Unable to load players.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const sportOptions = useMemo(
    () => [...new Set(players.flatMap(sportsOf))].sort(),
    [players]
  );

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();

    return players.filter((p) => {
      if (sport !== "All" && !sportsOf(p).includes(sport)) return false;

      const text = [fullName(p), p.playerId, p.position, ...sportsOf(p)]
        .join(" ")
        .toLowerCase();

      return text.includes(term);
    });
  }, [players, search, sport]);

  return (
    <div className="sw-page">
      <header className="sw-header">
        <div className="sw-brand">
          <div className="sw-brand-icon">S</div>
          <div>
            <strong>SPORTSYNC</strong>
            <span>SCOUT WORKSPACE</span>
          </div>
        </div>

        <div className="sw-user">
          <span>{user.username}</span>
          <button className="sw-button" onClick={onLogout}>
            Logout
          </button>
        </div>
      </header>

      <main className="sw-main">
        <section className="sw-intro">
          <h1>Ready Players</h1>
          <p>
            Players who meet the academy's trial-readiness criteria. This view
            is read-only.
          </p>
        </section>

        <section className="sw-controls">
          <input
            type="search"
            placeholder="Search name, Player ID, position or sport..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <select value={sport} onChange={(e) => setSport(e.target.value)}>
            <option value="All">All sports</option>
            {sportOptions.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>

          <span className="sw-count">{visible.length} players</span>
        </section>

        {loading ? (
          <p className="sw-message">Loading players...</p>
        ) : error ? (
          <div className="sw-message">
            <p>{error}</p>
            <button className="sw-button" onClick={load}>
              Try Again
            </button>
          </div>
        ) : visible.length === 0 ? (
          <div className="sw-message">
            <h3>No Ready players found</h3>
            <p>
              {players.length === 0
                ? "No players currently meet the readiness criteria. Check back later."
                : "Try changing your search or sport filter."}
            </p>
          </div>
        ) : (
          <div className="sw-grid">
            {visible.map((p) => (
              <button
                key={p._id}
                className="sw-card"
                onClick={() => setSelected(p)}
              >
                <Avatar player={p} />
                <div className="sw-card-info">
                  <h3>{fullName(p)}</h3>
                  <span>{p.playerId}</span>
                  <p>
                    {sportsOf(p).join(" · ")}
                    {p.position ? ` · ${p.position}` : ""}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </main>

      {selected && (
        <div className="sw-overlay" onClick={() => setSelected(null)}>
          <div
            className="sw-modal"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="sw-close"
              onClick={() => setSelected(null)}
              aria-label="Close"
            >
              ×
            </button>

            <div className="sw-modal-head">
              <Avatar player={selected} large />
              <div>
                <h2>{fullName(selected)}</h2>
                <span>{selected.playerId}</span>
              </div>
            </div>

            <dl className="sw-details">
              <div>
                <dt>Age</dt>
                <dd>{selected.age}</dd>
              </div>
              <div>
                <dt>Sports</dt>
                <dd>{sportsOf(selected).join(", ") || "—"}</dd>
              </div>
              <div>
                <dt>Position</dt>
                <dd>{selected.position || "—"}</dd>
              </div>
            </dl>

            <h3 className="sw-subtitle">Achievements</h3>

            {selected.achievements?.length ? (
              <ul className="sw-achievements">
                {selected.achievements.map((a) => (
                  <li key={a._id}>
                    <strong>{a.title}</strong>
                    {a.date && <small>{formatDate(a.date)}</small>}
                    {a.description && <p>{a.description}</p>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="sw-muted">No achievements recorded.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
