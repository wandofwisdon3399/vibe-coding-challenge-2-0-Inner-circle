import { useMemo } from "react";
import "./DashboardWidgets.css";

// ---- helpers shared with App.jsx -------------------------------------------

export const todayIST = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

const dayOf = (match) => (match.date ? String(match.date).slice(0, 10) : "");

// Matches that are still "Upcoming" and not in the past, soonest first.
export function getUpcomingMatches(matches) {
  const today = todayIST();
  return matches
    .filter((m) => m.status === "Upcoming" && dayOf(m) >= today)
    .sort((a, b) => dayOf(a).localeCompare(dayOf(b)));
}

// Matches whose date has passed but no result has been recorded.
export function getOverdueMatches(matches) {
  const today = todayIST();
  return matches.filter((m) => m.status === "Upcoming" && dayOf(m) && dayOf(m) < today);
}

function daysUntil(day) {
  return Math.round((Date.parse(`${day}T00:00:00Z`) - Date.parse(`${todayIST()}T00:00:00Z`)) / 86400000);
}

function whenLabel(day) {
  const n = daysUntil(day);
  if (n === 0) return "Today";
  if (n === 1) return "Tomorrow";
  return `In ${n} days`;
}

function timeAgo(iso) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} day${days > 1 ? "s" : ""} ago`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

const fullName = (p) => `${p.firstName || ""} ${p.lastName || ""}`.trim();

// ---- Today's attendance ----------------------------------------------------

export function AttendanceSnapshot({ summary, error, onOpen }) {
  const today = summary?.today;
  const active = summary?.activePlayers ?? 0;
  const counts = today?.counts;
  const attended = counts ? counts.Present + counts.Late : 0;
  const isOpen = today?.status === "Open";
  const notMarked = today && isOpen ? Math.max(0, active - (counts.Present + counts.Late + counts.Absent + counts.Excused)) : 0;
  const percentOfActive = active ? Math.min(100, Math.round((attended / active) * 100)) : 0;

  // Last 7 closed sessions, oldest first, for the little bar chart.
  const bars = (summary?.recent || []).filter((s) => s.status === "Closed" && s.rate != null).slice().reverse();

  return (
    <section className="panel dw-card">
      <div className="section-heading">
        <div><h2>Today's Attendance</h2><p>{summary ? "Academy-wide session" : "Loading..."}</p></div>
        {today && <span className={`status-pill ${isOpen ? "status-active" : "status-inactive"}`}>{isOpen ? "OPEN" : "CLOSED"}</span>}
      </div>

      {error && <p className="form-error">{error}</p>}

      {summary && !today && (
        <div className="dw-empty">
          <p>No session has been started today. {active} active player(s) are expected.</p>
          <button className="primary-button compact" onClick={onOpen}>▶ Start today's session</button>
        </div>
      )}

      {today && (
        <>
          <div className="dw-attendance-main">
            <div className="dw-big"><b>{attended}</b><span>of {active} present</span></div>
            <div className="dw-bar" aria-label={`${percentOfActive}% of active players present`}><i style={{ width: `${percentOfActive}%` }} /></div>
          </div>
          <div className="dw-mini-counts">
            <span><b className="dw-green">{counts.Present}</b> Present</span>
            <span><b className="dw-amber">{counts.Late}</b> Late</span>
            <span><b className="dw-red">{counts.Absent}</b> Absent</span>
            <span><b className="dw-purple">{counts.Excused}</b> Excused</span>
            {isOpen && <span><b>{notMarked}</b> Not yet marked</span>}
          </div>
        </>
      )}

      {bars.length > 0 && (
        <div className="dw-trend">
          <small>Recent closed sessions (attendance %)</small>
          <div className="dw-trend-bars">
            {bars.map((s) => (
              <div className="dw-trend-col" key={s._id} title={`${s.date}: ${s.rate}%`}>
                <span>{Math.round(s.rate)}</span>
                <i style={{ height: `${Math.max(6, s.rate)}%` }} />
                <em>{Number(s.date.slice(8))}</em>
              </div>
            ))}
          </div>
        </div>
      )}

      <button className="text-button" onClick={onOpen}>Open attendance ↗</button>
    </section>
  );
}

// ---- Upcoming matches --------------------------------------------------------

export function UpcomingMatches({ matches, onOpen }) {
  const upcoming = getUpcomingMatches(matches);
  const overdue = getOverdueMatches(matches);

  return (
    <section className="panel dw-card">
      <div className="section-heading">
        <div><h2>Upcoming Matches</h2><p>{upcoming.length ? `${upcoming.length} scheduled` : "Nothing scheduled"}</p></div>
        <button className="text-button" onClick={onOpen}>All matches ↗</button>
      </div>

      {upcoming.length === 0 ? (
        <div className="dw-empty">
          <p>No upcoming matches. Schedule one from the Matches page.</p>
          <button className="secondary-button compact" onClick={onOpen}>＋ Schedule match</button>
        </div>
      ) : (
        <div className="dw-match-list">
          {upcoming.slice(0, 5).map((m) => {
            const day = dayOf(m);
            const when = whenLabel(day);
            return (
              <div className="dw-match" key={m._id}>
                <div className="dw-date">
                  <b>{Number(day.slice(8))}</b>
                  <span>{new Date(`${day}T12:00:00`).toLocaleDateString("en-IN", { month: "short" })}</span>
                </div>
                <div className="dw-match-info">
                  <strong>{m.title}</strong>
                  <span>{m.sport}{m.opponent ? ` · vs ${m.opponent}` : ""}{m.venue ? ` · ${m.venue}` : ""}</span>
                </div>
                <span className={`dw-when ${when === "Today" ? "today" : ""}`}>{when}</span>
              </div>
            );
          })}
        </div>
      )}

      {overdue.length > 0 && (
        <button className="dw-overdue" onClick={onOpen}>
          ⚠ {overdue.length} past match{overdue.length > 1 ? "es" : ""} still waiting for a result
        </button>
      )}
    </section>
  );
}

// ---- Recent activity -----------------------------------------------------------

export function ActivityFeed({ players, matches, sessions }) {
  const items = useMemo(() => {
    const list = [];
    for (const p of players) {
      if (p.createdAt) list.push({ at: p.createdAt, icon: "👤", text: `${fullName(p)} registered${p.playerId ? ` (${p.playerId})` : ""}` });
      for (const a of p.achievements || []) {
        if (a.createdAt) list.push({ at: a.createdAt, icon: "🏆", text: `${fullName(p)}: ${a.title}` });
      }
    }
    for (const m of matches) {
      if (m.createdAt) list.push({ at: m.createdAt, icon: "⚑", text: `Match scheduled: ${m.title} (${m.sport})` });
      const edited = m.updatedAt && m.createdAt && new Date(m.updatedAt) - new Date(m.createdAt) > 2000;
      if (m.status === "Completed" && edited) {
        list.push({ at: m.updatedAt, icon: "✔", text: `Result recorded: ${m.title}${m.result ? ` — ${m.result}` : ""}` });
      }
    }
    for (const s of sessions || []) {
      if (s.startedAt) list.push({ at: s.startedAt, icon: "▶", text: `Attendance session started${s.startedBy ? ` by ${s.startedBy}` : ""}` });
      if (s.status === "Closed" && s.closedAt) {
        const present = (s.counts?.Present || 0) + (s.counts?.Late || 0);
        list.push({ at: s.closedAt, icon: "🔒", text: `Attendance closed${s.closedBy ? ` by ${s.closedBy}` : ""} · ${present} present` });
      }
    }
    return list.sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 8);
  }, [players, matches, sessions]);

  return (
    <section className="panel dw-card">
      <div className="section-heading">
        <div><h2>Recent Activity</h2><p>Latest updates across the academy</p></div>
      </div>
      {items.length === 0 ? (
        <div className="dw-empty"><p>Activity will appear here as you use SPORTSYNC.</p></div>
      ) : (
        <div className="dw-feed">
          {items.map((item, i) => (
            <div className="dw-feed-row" key={`${item.at}-${i}`}>
              <span className="dw-feed-icon">{item.icon}</span>
              <span className="dw-feed-text">{item.text}</span>
              <small>{timeAgo(item.at)}</small>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
