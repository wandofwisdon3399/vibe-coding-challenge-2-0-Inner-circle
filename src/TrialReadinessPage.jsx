import { useEffect, useMemo, useState } from "react";
import "./TrialReadinessPage.css";

const READINESS_URL = "/api/readiness";

async function readJson(response) {
  const text = await response.text();

  try {
    return text ? JSON.parse(text) : {};
  } catch {
    throw new Error("Unexpected server response. Please try again.");
  }
}

async function request(url) {
  const response = await fetch(url, { credentials: "include" });
  const data = await readJson(response);

  if (!response.ok) {
    throw new Error(data.message || "Request failed.");
  }

  return data;
}

const fullName = (p) => `${p.firstName || ""} ${p.lastName || ""}`.trim();

const initials = (p) =>
  `${p.firstName?.[0] || ""}${p.lastName?.[0] || ""}`.toUpperCase() || "P";

function formatDate(value) {
  if (!value) return "";

  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatMonth(value) {
  const [year, month] = String(value).split("-").map(Number);

  if (!year || !month) return value;

  return new Date(year, month - 1, 1).toLocaleDateString("en-IN", {
    month: "short",
    year: "numeric",
  });
}

function Avatar({ player, large = false }) {
  return player.photo ? (
    <img
      className={`tr-avatar ${large ? "large" : ""}`}
      src={player.photo}
      alt={fullName(player)}
    />
  ) : (
    <div className={`tr-avatar ${large ? "large" : ""}`}>
      {initials(player)}
    </div>
  );
}

function Badge({ ready }) {
  return (
    <span className={`tr-badge ${ready ? "ready" : "not-ready"}`}>
      {ready ? "Ready" : "Not Ready"}
    </span>
  );
}

function ProgressBar({ value, met }) {
  return (
    <div className="tr-bar">
      <span
        className={met ? "met" : ""}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

function PlayerDetail({ playerSummary, onClose }) {
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    request(`${READINESS_URL}/${playerSummary._id}`)
      .then((data) => {
        if (!cancelled) setDetail(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });

    return () => {
      cancelled = true;
    };
  }, [playerSummary._id]);

  // Show the summary immediately; the detail fills in when loaded.
  const player = detail || playerSummary;
  const { metrics } = player;

  return (
    <div className="tr-overlay" onClick={onClose}>
      <div
        className="tr-modal"
        role="dialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
      >
        <button className="tr-close" onClick={onClose} aria-label="Close">
          ×
        </button>

        <div className="tr-modal-head">
          <Avatar player={player} large />

          <div>
            <h2>{fullName(player)}</h2>
            <p>
              {player.playerId} · {player.sports.join(", ")}
              {player.position ? ` · ${player.position}` : ""}
              {player.age ? ` · Age ${player.age}` : ""}
            </p>
          </div>

          <Badge ready={player.ready} />
        </div>

        <section className="tr-section">
          <h3>Readiness criteria</h3>

          <div className="tr-criteria">
            {player.criteria.map((criterion) => (
              <div className="tr-criterion" key={criterion.key}>
                <div className="tr-criterion-top">
                  <strong>{criterion.label}</strong>
                  <span className={criterion.met ? "ok" : "bad"}>
                    {criterion.met ? "Met" : "Not met"}
                  </span>
                </div>

                <ProgressBar value={criterion.progress} met={criterion.met} />

                <div className="tr-criterion-foot">
                  <span>Current: {criterion.actual}</span>
                  <span>Required: {criterion.required}</span>
                </div>
              </div>
            ))}
          </div>

          {player.ready ? (
            <p className="tr-note good">
              This player meets both readiness criteria and is visible to
              Scouts.
            </p>
          ) : (
            <ul className="tr-reasons">
              {player.reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          )}
        </section>

        <section className="tr-section">
          <h3>Attendance breakdown</h3>

          <div className="tr-facts">
            <div>
              <b>{metrics.present}</b>
              <span>Present</span>
            </div>
            <div>
              <b>{metrics.late}</b>
              <span>Late</span>
            </div>
            <div>
              <b>{metrics.absent}</b>
              <span>Absent</span>
            </div>
            <div>
              <b>{metrics.excused}</b>
              <span>Excused</span>
            </div>
            <div>
              <b>{metrics.recordedSessions}</b>
              <span>Sessions</span>
            </div>
          </div>
        </section>

        <section className="tr-section">
          <h3>Performance</h3>

          {metrics.avgPerformance === null ? (
            <p className="tr-muted">
              No rated match performances yet. Performance is shown for
              information and does not change readiness.
            </p>
          ) : (
            <p className="tr-muted">
              Average rating:{" "}
              <strong className="tr-strong">{metrics.performanceLabel}</strong>{" "}
              ({metrics.avgPerformance} out of 4) across{" "}
              {metrics.ratedMatches} rated{" "}
              {metrics.ratedMatches === 1 ? "match" : "matches"}. Shown for
              information; it does not change readiness.
            </p>
          )}
        </section>

        {error && <p className="tr-error">{error}</p>}

        {!detail && !error && (
          <p className="tr-muted">Loading full evaluation...</p>
        )}

        {detail && (
          <>
            <section className="tr-section">
              <h3>Monthly attendance</h3>

              {detail.monthlyAttendance.length === 0 ? (
                <p className="tr-muted">No closed-session attendance yet.</p>
              ) : (
                <div className="tr-months">
                  {detail.monthlyAttendance.map((row) => (
                    <div className="tr-month" key={row.month}>
                      <span>{formatMonth(row.month)}</span>
                      <ProgressBar
                        value={row.percentage ?? 0}
                        met={
                          row.percentage !== null &&
                          row.percentage >= detail.rules.minAttendancePct
                        }
                      />
                      <b>
                        {row.percentage === null
                          ? "—"
                          : `${row.percentage}%`}
                      </b>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="tr-section">
              <h3>Completed matches</h3>

              {detail.matches.length === 0 ? (
                <p className="tr-muted">No completed matches yet.</p>
              ) : (
                <div className="tr-table-wrap">
                  <table className="tr-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Match</th>
                        <th>Result</th>
                        <th>Performance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.matches.map((match) => (
                        <tr key={match._id}>
                          <td>{formatDate(match.date)}</td>
                          <td>
                            {match.title}
                            <small>
                              {match.sport}
                              {match.opponent ? ` vs ${match.opponent}` : ""}
                            </small>
                          </td>
                          <td>{match.result || "—"}</td>
                          <td>{match.performance || "Not rated"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="tr-section">
              <h3>Recent sessions</h3>

              {detail.recentAttendance.length === 0 ? (
                <p className="tr-muted">No closed sessions recorded.</p>
              ) : (
                <div className="tr-chips">
                  {detail.recentAttendance.map((item) => (
                    <span
                      key={item.date}
                      className={`tr-chip ${item.status.toLowerCase()}`}
                      title={`${item.date}: ${item.status}`}
                    >
                      {formatDate(item.date)} · {item.status}
                    </span>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}

// Trial Readiness for Admin and Coach. The backend decides who can see which
// players; Coaches only ever receive players in their assigned sports.
export default function TrialReadinessPage({ role = "admin" }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [view, setView] = useState("players");
  const [tab, setTab] = useState("all");
  const [sport, setSport] = useState("All");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("status");
  const [selected, setSelected] = useState(null);

  async function load() {
    try {
      setLoading(true);
      setError("");
      setData(await request(READINESS_URL));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const players = useMemo(() => data?.players || [], [data]);

  const sports = useMemo(
    () => [...new Set(players.flatMap((p) => p.sports))].sort(),
    [players]
  );

  const sportSummary = useMemo(
    () =>
      sports.map((name) => {
        const inSport = players.filter((p) => p.sports.includes(name));
        const ready = inSport.filter((p) => p.ready).length;

        return {
          name,
          total: inSport.length,
          ready,
          notReady: inSport.length - ready,
        };
      }),
    [players, sports]
  );

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();

    const list = players.filter((p) => {
      if (tab === "ready" && !p.ready) return false;
      if (tab === "notready" && p.ready) return false;
      if (sport !== "All" && !p.sports.includes(sport)) return false;

      if (!term) return true;

      return [fullName(p), p.playerId, p.position, ...p.sports]
        .join(" ")
        .toLowerCase()
        .includes(term);
    });

    const byName = (a, b) => fullName(a).localeCompare(fullName(b));

    const sorters = {
      status: (a, b) =>
        Number(b.ready) - Number(a.ready) ||
        b.criteriaMet - a.criteriaMet ||
        byName(a, b),
      attendance: (a, b) =>
        (b.metrics.attendancePct ?? -1) - (a.metrics.attendancePct ?? -1) ||
        byName(a, b),
      matches: (a, b) =>
        b.metrics.completedMatches - a.metrics.completedMatches ||
        byName(a, b),
      name: byName,
    };

    return [...list].sort(sorters[sort]);
  }, [players, tab, sport, search, sort]);

  const readyCount = players.filter((p) => p.ready).length;
  const rules = data?.rules;

  function openSport(name) {
    setSport(name);
    setTab("all");
    setView("players");
  }

  return (
    <div className="tr-page">
      <section className="welcome-row">
        <div>
          <div className="eyebrow">
            <span className="live-dot" /> PLAYER DEVELOPMENT
          </div>
          <h1>Trial Readiness</h1>
          <p>
            {role === "coach"
              ? "Readiness of players in your assigned sports."
              : "Which players are ready for scouting, and what the others still need."}
          </p>
        </div>

        <button className="tr-refresh" onClick={load} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </section>

      {error && (
        <div className="tr-error-box">
          <span>{error}</span>
          <button onClick={load}>Try again</button>
        </div>
      )}

      {!error && loading && !data && (
        <div className="tr-empty">Evaluating players...</div>
      )}

      {data && (
        <>
          <div className="tr-stats">
            <div className="panel tr-stat">
              <span>Players evaluated</span>
              <b>{players.length}</b>
              <small>Active players only</small>
            </div>

            <div className="panel tr-stat">
              <span>Ready</span>
              <b className="good">{readyCount}</b>
              <small>Visible to Scouts</small>
            </div>

            <div className="panel tr-stat">
              <span>Not ready</span>
              <b className="warn">{players.length - readyCount}</b>
              <small>Still working towards it</small>
            </div>

            <div className="panel tr-stat">
              <span>Closed sessions</span>
              <b>{data.academyClosedSessions}</b>
              <small>Academy-wide</small>
            </div>
          </div>

          <div className="panel tr-rules">
            <strong>A player is Ready when both are true:</strong>
            <span>
              Attendance at least {rules.minAttendancePct}% (Excused days are
              ignored)
            </span>
            <span>
              At least {rules.minCompletedMatches} completed matches
            </span>
          </div>

          <div className="tr-toolbar">
            <div className="tr-tabs">
              <button
                className={view === "players" ? "active" : ""}
                onClick={() => setView("players")}
              >
                Players
              </button>
              <button
                className={view === "sports" ? "active" : ""}
                onClick={() => setView("sports")}
              >
                By sport
              </button>
            </div>

            {view === "players" && (
              <>
                <div className="tr-tabs">
                  {[
                    ["all", `All (${players.length})`],
                    ["ready", `Ready (${readyCount})`],
                    [
                      "notready",
                      `Not Ready (${players.length - readyCount})`,
                    ],
                  ].map(([id, label]) => (
                    <button
                      key={id}
                      className={tab === id ? "active" : ""}
                      onClick={() => setTab(id)}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <input
                  className="tr-search"
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search name, ID, position or sport..."
                />

                <select
                  value={sport}
                  onChange={(event) => setSport(event.target.value)}
                  aria-label="Filter by sport"
                >
                  <option value="All">All sports</option>
                  {sports.map((name) => (
                    <option key={name}>{name}</option>
                  ))}
                </select>

                <select
                  value={sort}
                  onChange={(event) => setSort(event.target.value)}
                  aria-label="Sort players"
                >
                  <option value="status">Sort: Readiness</option>
                  <option value="attendance">Sort: Attendance</option>
                  <option value="matches">Sort: Matches</option>
                  <option value="name">Sort: Name</option>
                </select>
              </>
            )}
          </div>

          {view === "sports" ? (
            sportSummary.length === 0 ? (
              <div className="tr-empty">No players to show yet.</div>
            ) : (
              <div className="tr-sport-grid">
                {sportSummary.map((item) => (
                  <button
                    key={item.name}
                    className="panel tr-sport"
                    onClick={() => openSport(item.name)}
                  >
                    <div className="tr-sport-top">
                      <h3>{item.name}</h3>
                      <span>{item.total} players</span>
                    </div>

                    <ProgressBar
                      value={item.total ? (item.ready / item.total) * 100 : 0}
                      met
                    />

                    <div className="tr-sport-foot">
                      <span className="good">{item.ready} Ready</span>
                      <span>{item.notReady} Not Ready</span>
                    </div>
                  </button>
                ))}
              </div>
            )
          ) : visible.length === 0 ? (
            <div className="tr-empty">
              {players.length === 0
                ? "No active players to evaluate yet."
                : "No players match these filters."}
            </div>
          ) : (
            <div className="tr-list">
              {visible.map((p) => (
                <button
                  key={p._id}
                  className="panel tr-row"
                  onClick={() => setSelected(p)}
                >
                  <Avatar player={p} />

                  <div className="tr-who">
                    <strong>{fullName(p)}</strong>
                    <span>
                      {p.playerId} · {p.sports.join(", ")}
                    </span>
                  </div>

                  <div className="tr-metrics">
                    {p.criteria.map((criterion) => (
                      <div
                        key={criterion.key}
                        className={criterion.met ? "met" : "unmet"}
                      >
                        <b>{criterion.actual}</b>
                        <span>{criterion.label}</span>
                      </div>
                    ))}
                  </div>

                  <div className="tr-status">
                    <Badge ready={p.ready} />
                    <small>{p.criteriaMet} of {p.criteria.length} met</small>
                  </div>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {selected && (
        <PlayerDetail
          playerSummary={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
