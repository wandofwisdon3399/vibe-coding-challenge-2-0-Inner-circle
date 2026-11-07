import { useEffect, useMemo, useState } from "react";
import "./PlayerWorkspace.css";
import quoteImage from "./assets/player-quote.jpg";
import {
  useDrawer,
  usePageHistory,
  useScrollToTop,
  pageFromHash,
} from "./useMobileNav.js";

const BASE = "/api";

async function getJson(path) {
  const response = await fetch(`${BASE}${path}`, { credentials: "include" });
  const text = await response.text();

  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error("Unexpected server response. Please try again.");
  }

  if (!response.ok) {
    throw new Error(data.message || "Request failed.");
  }

  return data;
}

const fullName = (p) => `${p.firstName || ""} ${p.lastName || ""}`.trim();

const initials = (p) =>
  `${p.firstName?.[0] || ""}${p.lastName?.[0] || ""}`.toUpperCase() || "P";

const sportsOf = (p) =>
  [...new Set([p.sport, ...(p.sports || [])].filter(Boolean))];

function formatDate(value) {
  if (!value) return "—";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T00:00:00`)
    : new Date(value);

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function monthLabel(key) {
  const [year, month] = key.split("-");
  return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString(
    "en-IN",
    { month: "long", year: "numeric" }
  );
}

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "attendance", label: "Attendance" },
  { id: "matches", label: "Matches" },
];

const PLAYER_TABS = TABS.map((item) => item.id);

export default function PlayerWorkspace({ user, onLogout }) {
  const [tab, setTab] = useState(() => pageFromHash(PLAYER_TABS, "overview"));
  const drawer = useDrawer();

  // Back/Forward buttons move between tabs; every tab starts at the top
  usePageHistory({
    page: tab,
    validPages: PLAYER_TABS,
    onPageChange: setTab,
  });

  useScrollToTop(tab);
  const [player, setPlayer] = useState(null);
  const [attendance, setAttendance] = useState(null);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    try {
      setLoading(true);
      setError("");

      if (!user.player) {
        throw new Error("No player profile is linked to this account. Please contact the academy.");
      }

      const [players, attendanceData, matchData] = await Promise.all([
        getJson("/players"),
        getJson(`/attendance/player/${user.player}`),
        getJson("/matches"),
      ]);

      setPlayer(Array.isArray(players) ? players[0] || null : null);
      setAttendance(attendanceData);
      setMatches(Array.isArray(matchData) ? matchData : []);
    } catch (err) {
      setError(err.message || "Unable to load your information.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const monthly = useMemo(() => {
    const groups = new Map();

    for (const record of attendance?.history || []) {
      const key = String(record.date).slice(0, 7);
      if (!groups.has(key)) {
        groups.set(key, { Present: 0, Late: 0, Absent: 0, Excused: 0 });
      }
      groups.get(key)[record.status] += 1;
    }

    return [...groups.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([key, counts]) => {
        const attended = counts.Present + counts.Late;
        const counted = attended + counts.Absent;

        return {
          key,
          counts,
          percentage: counted ? Math.round((attended / counted) * 1000) / 10 : null,
        };
      });
  }, [attendance]);

  const completed = matches.filter((m) => m.status === "Completed");
  const upcoming = matches
    .filter((m) => m.status === "Upcoming")
    .sort((a, b) => new Date(a.date) - new Date(b.date));
  const myPerformance = (match) => match.participants?.[0]?.performance || "";

  const percentage = attendance?.percentage;

  return (
    <div className="pw-page">
      <div
        className={`pd-backdrop ${drawer.open ? "show" : ""}`}
        onClick={drawer.close}
      />

      <aside
        id="player-drawer"
        className={`pd-drawer ${drawer.open ? "open" : ""}`}
        aria-label="Menu"
      >
        <div className="pd-head">
          <div>
            <strong>SPORTSYNC</strong>
            <span>PLAYER PORTAL</span>
          </div>

          <button
            type="button"
            className="pd-close"
            aria-label="Close menu"
            onClick={drawer.close}
          >
            ×
          </button>
        </div>

        <nav className="pd-nav">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={tab === item.id ? "active" : ""}
              onClick={() => {
                setTab(item.id);
                drawer.close();
              }}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="pd-foot">
          <span>{user.username?.toUpperCase()}</span>
          <button type="button" onClick={onLogout}>
            Logout
          </button>
        </div>
      </aside>

      <header className="pw-header">
        <button
          type="button"
          className="pw-menu-button"
          aria-label="Open menu"
          aria-expanded={drawer.open}
          aria-controls="player-drawer"
          onClick={drawer.toggle}
        >
          <span />
          <span />
          <span />
        </button>

        <div className="pw-brand">
          <div className="pw-brand-icon">S</div>
          <div>
            <strong>SPORTSYNC</strong>
            <span>PLAYER PORTAL</span>
          </div>
        </div>

        <div className="pw-user">
          <span>{user.username?.toUpperCase()}</span>
          <button className="pw-button" onClick={onLogout}>
            Logout
          </button>
        </div>
      </header>

      <main className="pw-main">
        {loading ? (
          <p className="pw-message">Loading your information...</p>
        ) : error ? (
          <div className="pw-message">
            <p>{error}</p>
            <button className="pw-button" onClick={load}>
              Try Again
            </button>
          </div>
        ) : !player ? (
          <p className="pw-message">Your player profile could not be found.</p>
        ) : (
          <>
            <section className="pw-hero">
              {player.photo ? (
                <img className="pw-avatar" src={player.photo} alt={fullName(player)} />
              ) : (
                <div className="pw-avatar">{initials(player)}</div>
              )}

              <div>
                <span className="pw-kicker">WELCOME</span>
                <h1>{fullName(player)}</h1>
                <p>
                  {player.playerId} · {sportsOf(player).join(", ")}
                  {player.position ? ` · ${player.position}` : ""}
                </p>
              </div>
            </section>

            <section className="pw-stats">
              <article>
                <span>Attendance</span>
                <strong>{percentage == null ? "—" : `${percentage}%`}</strong>
                <small>{attendance?.sessionsCounted || 0} sessions counted</small>
              </article>
              <article>
                <span>Matches played</span>
                <strong>{completed.length}</strong>
                <small>Completed</small>
              </article>
              <article>
                <span>Upcoming</span>
                <strong>{upcoming.length}</strong>
                <small>Scheduled matches</small>
              </article>
            </section>

            <nav className="pw-tabs">
              {TABS.map((item) => (
                <button
                  key={item.id}
                  className={tab === item.id ? "active" : ""}
                  onClick={() => setTab(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </nav>

            {tab === "overview" && (
              <div className="pw-overview">
                <div className="pw-overview-main">
                <article className="pw-panel">
                  <h2>My Profile</h2>
                  <dl className="pw-list">
                    <div><dt>Player ID</dt><dd>{player.playerId}</dd></div>
                    <div><dt>Age</dt><dd>{player.age}</dd></div>
                    <div><dt>Sports</dt><dd>{sportsOf(player).join(", ") || "—"}</dd></div>
                    <div><dt>Position</dt><dd>{player.position || "Not specified"}</dd></div>
                    <div><dt>Phone</dt><dd>{player.phone || "Not provided"}</dd></div>
                    <div><dt>Email</dt><dd>{player.email || "Not provided"}</dd></div>
                  </dl>
                </article>

                <article className="pw-panel">
                  <h2>Achievements</h2>
                  {player.achievements?.length ? (
                    <ul className="pw-achievements">
                      {player.achievements.map((a) => (
                        <li key={a._id}>
                          <strong>{a.title}</strong>
                          {a.date && <small>{formatDate(a.date)}</small>}
                          {a.description && <p>{a.description}</p>}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="pw-muted">No achievements recorded yet.</p>
                  )}
                </article>
                </div>

                <figure className="pw-quote">
                  <img
                    src={quoteImage}
                    alt={"\u201CDon\u2019t put a limit on anything. The more you dream, the further you get.\u201D Michael Phelps"}
                  />
                </figure>
              </div>
            )}

            {tab === "attendance" && (
              <>
                <section className="pw-counts">
                  {["Present", "Late", "Absent", "Excused"].map((status) => (
                    <article key={status} className={`pw-count ${status.toLowerCase()}`}>
                      <strong>{attendance?.counts?.[status] || 0}</strong>
                      <span>{status}</span>
                    </article>
                  ))}
                </section>
                <p className="pw-muted pw-note">
                  Excused sessions are not counted against your attendance percentage.
                </p>

                <div className="pw-grid">
                  <article className="pw-panel">
                    <h2>Monthly Summary</h2>
                    {monthly.length ? (
                      <ul className="pw-rows">
                        {monthly.map((m) => (
                          <li key={m.key}>
                            <span>{monthLabel(m.key)}</span>
                            <span className="pw-muted">
                              {m.counts.Present + m.counts.Late} attended · {m.counts.Absent} absent
                            </span>
                            <strong>{m.percentage == null ? "—" : `${m.percentage}%`}</strong>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="pw-muted">No attendance recorded yet.</p>
                    )}
                  </article>

                  <article className="pw-panel">
                    <h2>History</h2>
                    {attendance?.history?.length ? (
                      <ul className="pw-rows">
                        {attendance.history.map((record) => (
                          <li key={record._id}>
                            <span>{formatDate(record.date)}</span>
                            <span className={`pw-status ${record.status.toLowerCase()}`}>
                              {record.status}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="pw-muted">No closed sessions yet.</p>
                    )}
                  </article>
                </div>
              </>
            )}

            {tab === "matches" && (
              <div className="pw-grid">
                <article className="pw-panel">
                  <h2>Upcoming Matches</h2>
                  {upcoming.length ? (
                    <ul className="pw-matches">
                      {upcoming.map((m) => (
                        <li key={m._id}>
                          <strong>{m.title}</strong>
                          <span>{m.sport} · {formatDate(m.date)}</span>
                          <small>
                            {[m.opponent && `vs ${m.opponent}`, m.venue].filter(Boolean).join(" · ")}
                          </small>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="pw-muted">No upcoming matches.</p>
                  )}
                </article>

                <article className="pw-panel">
                  <h2>Match History</h2>
                  {completed.length ? (
                    <ul className="pw-matches">
                      {completed.map((m) => (
                        <li key={m._id}>
                          <strong>{m.title}</strong>
                          <span>{m.sport} · {formatDate(m.date)}</span>
                          <small>
                            {[m.opponent && `vs ${m.opponent}`, m.result && `Result: ${m.result}`]
                              .filter(Boolean)
                              .join(" · ")}
                          </small>
                          {myPerformance(m) && (
                            <em className="pw-performance">
                              Performance: {myPerformance(m)}
                            </em>
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="pw-muted">No completed matches yet.</p>
                  )}
                </article>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
