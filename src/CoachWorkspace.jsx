import { useCallback, useEffect, useMemo, useState } from "react";
import "./CoachesPage.css";
import "./CoachWorkspace.css";
import AttendancePage from "./AttendancePage.jsx";
import MatchesPage from "./MatchesPage.jsx";
import TrialReadinessPage from "./TrialReadinessPage.jsx";
import {
  useDrawer,
  usePageHistory,
  useScrollToTop,
  pageFromHash,
} from "./useMobileNav.js";

const BASE = "/api";

async function request(path, options = {}) {
  const response = await fetch(`${BASE}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error("Unexpected server response. Please try again.");
  }

  if (!response.ok) throw new Error(data.message || "Request failed.");
  return data;
}

const NAV = [
  { id: "overview", label: "Overview", icon: "▦" },
  { id: "players", label: "My Players", icon: "♙" },
  { id: "matches", label: "Matches", icon: "⚑" },
  { id: "attendance", label: "Attendance", icon: "☑" },
  { id: "trials", label: "Trial Readiness", icon: "◎" },
];

const COACH_PAGES = NAV.map((item) => item.id);

const fullName = (p) => `${p.firstName || ""} ${p.lastName || ""}`.trim();
const initials = (p) =>
  `${p.firstName?.[0] || ""}${p.lastName?.[0] || ""}`.toUpperCase() || "P";
const sportsOf = (p) =>
  [...new Set([p.sport, ...(p.sports || [])].filter(Boolean))];

function formatDate(value) {
  if (!value) return "—";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T12:00:00`)
    : new Date(value);

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function PageHeading({ eyebrow, title, description }) {
  return (
    <section className="welcome-row">
      <div>
        <div className="eyebrow">
          <span className="live-dot" /> {eyebrow}
        </div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
    </section>
  );
}

function Avatar({ player }) {
  return player.photo ? (
    <img src={player.photo} alt={fullName(player)} />
  ) : (
    <span>{initials(player)}</span>
  );
}

// ---------------------------------------------------------------------------
// One player: contact details, position editing and attendance summary.
// Coaches can change a player's position only; everything else is read-only.
// ---------------------------------------------------------------------------
function PlayerDetail({ player, onBack, onUpdated }) {
  const [position, setPosition] = useState(player.position || "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [attendance, setAttendance] = useState(null);
  const [attendanceError, setAttendanceError] = useState("");

  useEffect(() => {
    let cancelled = false;

    request(`/attendance/player/${player._id}`)
      .then((data) => !cancelled && setAttendance(data))
      .catch((err) => !cancelled && setAttendanceError(err.message));

    return () => {
      cancelled = true;
    };
  }, [player._id]);

  async function savePosition(event) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");

    try {
      const updated = await request(`/players/${player._id}`, {
        method: "PATCH",
        body: JSON.stringify({ position: position.trim() }),
      });

      onUpdated(updated);
      setMessage("Position updated.");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="coaches-page cw-detail">
      <button className="secondary-button compact" onClick={onBack}>
        ← Back to players
      </button>

      <section className="panel cw-hero">
        <div className="coach-avatar">
          <Avatar player={player} />
        </div>

        <div>
          <h1>{fullName(player)}</h1>
          <p className="cw-muted">
            {player.playerId} · {sportsOf(player).join(", ")} · Age {player.age}
          </p>
        </div>
      </section>

      <div className="cw-grid">
        <section className="panel">
          <h2>Player Details</h2>
          <dl className="cw-list">
            <div><dt>Phone</dt><dd>{player.phone || "Not provided"}</dd></div>
            <div><dt>Email</dt><dd>{player.email || "Not provided"}</dd></div>
            <div><dt>Sports</dt><dd>{sportsOf(player).join(", ") || "—"}</dd></div>
            <div><dt>Age</dt><dd>{player.age}</dd></div>
          </dl>

          <form className="cw-position" onSubmit={savePosition}>
            <label>
              Playing position
              <input
                value={position}
                onChange={(e) => setPosition(e.target.value)}
                placeholder="e.g. Midfielder"
                maxLength={80}
              />
            </label>

            <button className="primary-button" disabled={saving}>
              {saving ? "Saving..." : "Save Position"}
            </button>
          </form>

          {message && <p className="cw-success">{message}</p>}
          {error && <p className="form-error">{error}</p>}
        </section>

        <section className="panel">
          <h2>Attendance</h2>

          {attendanceError ? (
            <p className="form-error">{attendanceError}</p>
          ) : !attendance ? (
            <p className="cw-muted">Loading attendance...</p>
          ) : (
            <>
              <p className="cw-big">
                {attendance.percentage == null ? "—" : `${attendance.percentage}%`}
              </p>
              <p className="cw-muted">
                {attendance.sessionsCounted} session(s) counted · Excused sessions are not counted
              </p>

              <div className="cw-counts">
                {["Present", "Late", "Absent", "Excused"].map((status) => (
                  <div key={status}>
                    <strong>{attendance.counts[status] || 0}</strong>
                    <span>{status}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>

        <section className="panel">
          <h2>Achievements</h2>

          {player.achievements?.length ? (
            <ul className="cw-items">
              {player.achievements.map((a) => (
                <li key={a._id}>
                  <strong>{a.title}</strong>
                  {a.date && <small>{formatDate(a.date)}</small>}
                  {a.description && <p>{a.description}</p>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="cw-muted">No achievements recorded.</p>
          )}
        </section>
      </div>
    </div>
  );
}

export default function CoachWorkspace({ user, onLogout }) {
  const sports = useMemo(() => user.assignedSports || [], [user.assignedSports]);

  const [page, setPage] = useState(() =>
    pageFromHash(COACH_PAGES, "overview")
  );
  const drawer = useDrawer();
  const [players, setPlayers] = useState([]);
  const [matches, setMatches] = useState([]);
  const [today, setToday] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState("");
  const [sportFilter, setSportFilter] = useState("All");

  const loadMatches = useCallback(async () => {
    const data = await request("/matches");
    setMatches(Array.isArray(data) ? data : []);
  }, []);

  const loadAll = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const [playerData, , todayData] = await Promise.all([
        request("/players"),
        loadMatches(),
        request("/attendance/sessions/today").catch(() => null),
      ]);

      setPlayers(Array.isArray(playerData) ? playerData : []);
      setToday(todayData);
    } catch (err) {
      setError(err.message || "Unable to load your workspace.");
    } finally {
      setLoading(false);
    }
  }, [loadMatches]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const upcoming = useMemo(
    () =>
      matches
        .filter((m) => m.status === "Upcoming")
        .sort((a, b) => new Date(a.date) - new Date(b.date)),
    [matches]
  );

  const recent = useMemo(
    () =>
      matches
        .filter((m) => m.status === "Completed")
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 5),
    [matches]
  );

  const visiblePlayers = useMemo(() => {
    const term = search.trim().toLowerCase();

    return players.filter((p) => {
      if (sportFilter !== "All" && !sportsOf(p).includes(sportFilter)) {
        return false;
      }

      const text = [fullName(p), p.playerId, p.phone, p.position, ...sportsOf(p)]
        .join(" ")
        .toLowerCase();

      return text.includes(term);
    });
  }, [players, search, sportFilter]);

  function updatePlayer(updated) {
    setPlayers((current) =>
      current.map((p) => (p._id === updated._id ? updated : p))
    );
    setSelected(updated);
  }

  function navigate(id) {
    setPage(id);
    setSelected(null);
  }

  // Back/Forward buttons move between pages; every new page starts at the top
  usePageHistory({
    page,
    validPages: COACH_PAGES,
    onPageChange: navigate,
  });

  useScrollToTop(`${page}:${selected?._id || ""}`);

  const sessionLabel = !today
    ? "—"
    : !today.session
    ? "Not started"
    : today.session.status === "Open"
    ? "Open"
    : "Closed";

  const attended = today?.counts
    ? (today.counts.Present || 0) + (today.counts.Late || 0)
    : 0;

  const title = NAV.find((item) => item.id === page)?.label || "Overview";

  function renderOverview() {
    return (
      <div className="coaches-page">
        <PageHeading
          eyebrow="COACH WORKSPACE"
          title={`Welcome, ${user.username}`}
          description="Your players, fixtures and attendance for your assigned sports."
        />

        <p className="cw-sports">
          Assigned sports:{" "}
          {sports.length ? (
            sports.map((sport) => <em key={sport}>{sport}</em>)
          ) : (
            <span className="cw-muted">None assigned yet — contact the Admin.</span>
          )}
        </p>

        <section className="coach-stats cw-stats-4">
          <article className="stat-card">
            <span className="stat-label">My Players</span>
            <strong className="stat-value">{players.length}</strong>
            <span className="stat-change">Active in your sports</span>
          </article>

          <article className="stat-card">
            <span className="stat-label">Upcoming Matches</span>
            <strong className="stat-value">{upcoming.length}</strong>
            <span className="stat-change">Scheduled fixtures</span>
          </article>

          <article className="stat-card">
            <span className="stat-label">Today's Session</span>
            <strong className="stat-value">{sessionLabel}</strong>
            <span className="stat-change">
              {today?.session
                ? `${attended} of ${today.activePlayers ?? players.length} attended`
                : "Waiting for Admin to start"}
            </span>
          </article>

          <article className="stat-card">
            <span className="stat-label">Completed Matches</span>
            <strong className="stat-value">
              {matches.filter((m) => m.status === "Completed").length}
            </strong>
            <span className="stat-change">Results recorded</span>
          </article>
        </section>

        <div className="cw-grid">
          <section className="panel">
            <div className="section-heading">
              <h2>Upcoming Matches</h2>
              <button className="text-button" onClick={() => navigate("matches")}>
                View all
              </button>
            </div>

            {upcoming.length ? (
              <ul className="cw-items">
                {upcoming.slice(0, 5).map((m) => (
                  <li key={m._id}>
                    <strong>{m.title}</strong>
                    <small>
                      {m.sport} · {formatDate(m.date)}
                      {m.opponent ? ` · vs ${m.opponent}` : ""}
                    </small>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="cw-muted">No upcoming matches. Schedule one from Matches.</p>
            )}
          </section>

          <section className="panel">
            <h2>Recent Results</h2>

            {recent.length ? (
              <ul className="cw-items">
                {recent.map((m) => (
                  <li key={m._id}>
                    <strong>{m.title}</strong>
                    <small>
                      {m.sport} · {formatDate(m.date)}
                      {m.result ? ` · ${m.result}` : ""}
                    </small>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="cw-muted">No completed matches yet.</p>
            )}
          </section>
        </div>
      </div>
    );
  }

  function renderPlayers() {
    if (selected) {
      return (
        <PlayerDetail
          key={selected._id}
          player={selected}
          onBack={() => setSelected(null)}
          onUpdated={updatePlayer}
        />
      );
    }

    return (
      <div className="coaches-page">
        <PageHeading
          eyebrow="MY PLAYERS"
          title="Players"
          description="Active players in your assigned sports."
        />

        <section className="panel coach-directory">
          <div className="section-heading">
            <div>
              <h2>Player Directory</h2>
              <p>Open a player to see attendance and update their position.</p>
            </div>
            <span>{visiblePlayers.length} Records</span>
          </div>

          <div className="coach-directory-controls">
            <input
              type="search"
              placeholder="Search name, Player ID, phone or position..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            <select
              value={sportFilter}
              onChange={(e) => setSportFilter(e.target.value)}
            >
              <option value="All">All my sports</option>
              {sports.map((sport) => (
                <option key={sport} value={sport}>
                  {sport}
                </option>
              ))}
            </select>
          </div>

          {visiblePlayers.length === 0 ? (
            <div className="coach-empty-message">
              <h3>No players found</h3>
              <p>
                {players.length === 0
                  ? "No active players are registered in your sports yet."
                  : "Try changing your search or sport filter."}
              </p>
            </div>
          ) : (
            <div className="coach-list">
              {visiblePlayers.map((p) => (
                <article className="coach-row" key={p._id}>
                  <div className="coach-avatar">
                    <Avatar player={p} />
                  </div>

                  <div className="coach-main-info">
                    <div className="coach-name-line">
                      <h3>{fullName(p)}</h3>
                    </div>
                    <p>{p.playerId}</p>
                    <div className="coach-meta">
                      <span>{sportsOf(p).join(" · ")}</span>
                      <span>{p.position || "Position not set"}</span>
                      <span>Age {p.age}</span>
                    </div>
                  </div>

                  <div className="coach-row-actions">
                    <button
                      className="secondary-button compact"
                      onClick={() => setSelected(p)}
                    >
                      View
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    );
  }

  function renderPage() {
    if (loading) return <p className="cw-muted cw-loading">Loading your workspace...</p>;

    if (error) {
      return (
        <div className="cw-loading">
          <p className="form-error">{error}</p>
          <button className="secondary-button" onClick={loadAll}>
            Try Again
          </button>
        </div>
      );
    }

    if (page === "players") return renderPlayers();

    if (page === "matches") {
      return (
        <MatchesPage
          matches={matches}
          loading={loading}
          error=""
          players={players}
          reload={loadMatches}
          intent={null}
          allowedSports={sports}
        />
      );
    }

    if (page === "attendance") return <AttendancePage role="coach" />;

    if (page === "trials") return <TrialReadinessPage role="coach" />;

    return renderOverview();
  }

  return (
    <div className="app-shell">
      <div
        className={`sidebar-backdrop ${drawer.open ? "show" : ""}`}
        onClick={drawer.close}
      />

      <aside
        id="app-sidebar"
        className={`sidebar ${drawer.open ? "open" : ""}`}
      >
        <button
          type="button"
          className="drawer-close"
          aria-label="Close menu"
          onClick={drawer.close}
        >
          ×
        </button>

        <div className="brand">
          <div className="brand-icon">S</div>

          <div className="brand-copy">
            <h2>SPORTSYNC</h2>
            <span>COACH WORKSPACE</span>
          </div>
        </div>

        <div className="menu-label">WORKSPACE</div>

        <nav className="navigation">
          {NAV.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`nav-item ${page === item.id ? "active" : ""}`}
              onClick={() => {
                navigate(item.id);
                drawer.close();
              }}
            >
              <span>{item.icon}</span>
              <b>{item.label}</b>

              {item.id === "players" && (
                <span className="nav-count">{players.length}</span>
              )}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="profile">
            <div className="avatar">
              {user.username?.slice(0, 2).toUpperCase() || "CO"}
            </div>

            <div className="profile-info">
              <strong>{user.username}</strong>
              <span>COACH</span>
            </div>
          </div>

          <button
            type="button"
            className="drawer-logout"
            onClick={onLogout}
          >
            Logout
          </button>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <button
            type="button"
            className="menu-button"
            aria-label="Open menu"
            aria-expanded={drawer.open}
            aria-controls="app-sidebar"
            onClick={drawer.toggle}
          >
            <span />
            <span />
            <span />
          </button>
          <div className="breadcrumb">
            <span>Workspace</span>
            <i>/</i>
            <strong>{selected ? fullName(selected) : title}</strong>
          </div>

          <div className="topbar-actions">
            <div className="today-label">
              ◷{" "}
              {new Date().toLocaleDateString("en-IN", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </div>

            <button className="secondary-button compact" onClick={onLogout}>
              Logout
            </button>
          </div>
        </header>

        <div className="page-content">
          {renderPage()}

          <footer className="footer">
            © 2026 SportSync Academy
            <span>
              Built for better performance. <b>✦</b>
            </span>
          </footer>
        </div>
      </main>
    </div>
  );
}
