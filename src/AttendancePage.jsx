import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./AttendancePage.css";

const API = "/api/attendance";
const STATUSES = ["Present", "Late", "Absent", "Excused"];
const NAME_KEY = "sportsync-staff-name";

const fullName = (p) => `${p?.firstName || ""} ${p?.lastName || ""}`.trim();
const initials = (p) => `${p?.firstName?.[0] || ""}${p?.lastName?.[0] || ""}`.toUpperCase() || "PL";
const sportsOf = (p) => (p?.sports?.length ? p.sports : p?.sport ? [p.sport] : []);
const longDate = (d) =>
  new Date(`${d}T12:00:00`).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const shortDate = (d) =>
  new Date(`${d}T12:00:00`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
const timeOf = (value) =>
  value ? new Date(value).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "";

// Talks to the backend. Always returns JSON or throws an error with a readable message.
async function api(path, options) {
  let response;
  try {
    response = await fetch(`${API}${path}`, { credentials: "include", headers: { "Content-Type": "application/json" }, ...options });
  } catch {
    throw new Error("Cannot reach the server. Check that the backend is running (npm run server).");
  }
  const type = response.headers.get("content-type") || "";
  if (!type.includes("application/json")) {
    throw new Error(`The server sent an unexpected reply (HTTP ${response.status}). Restart the backend and try again.`);
  }
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "Something went wrong.");
  return data;
}

// There are no logins yet, so we ask for (and remember) the staff member's name.
function getSavedName() {
  try { return localStorage.getItem(NAME_KEY) || ""; } catch { return ""; }
}
function saveName(name) {
  try { localStorage.setItem(NAME_KEY, name); } catch { /* ignore */ }
}

function Avatar({ player }) {
  return player?.photo
    ? <img className="player-avatar-img" src={player.photo} alt="" />
    : <div className="player-avatar">{initials(player)}</div>;
}

function StatusPill({ status }) {
  return <span className={`status-pill att-pill att-pill-${status.toLowerCase()}`}>{status}</span>;
}

// canManage = Admin: only Admin may start, close or reopen sessions.
function DailyAttendance({ canManage = true }) {
  const [today, setToday] = useState(null);      // { date, session, counts, activePlayers }
  const [sessions, setSessions] = useState([]);  // recent sessions
  const [detail, setDetail] = useState(null);    // the session being shown, with its records
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [dialog, setDialog] = useState(null);    // "start" | "close" | "reopen" | null
  const [dialogName, setDialogName] = useState("");
  const [dialogReason, setDialogReason] = useState("");
  const [dialogError, setDialogError] = useState("");
  const inputRef = useRef(null);
  const toastTimer = useRef(null);

  const refreshDetail = useCallback(async (id) => {
    const data = await api(`/sessions/${id}`);
    setDetail(data);
    return data;
  }, []);

  const refreshTop = useCallback(async () => {
    const [todayInfo, list] = await Promise.all([api("/sessions/today"), api("/sessions")]);
    setToday(todayInfo);
    setSessions(list);
    return todayInfo;
  }, []);

  const loadEverything = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const todayInfo = await refreshTop();
      if (todayInfo.session) await refreshDetail(todayInfo.session._id);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [refreshTop, refreshDetail]);

  useEffect(() => {
    loadEverything();
    return () => clearTimeout(toastTimer.current);
  }, [loadEverything]);

  function showToast(text) {
    setToast(text);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  }

  // Runs an action with the "busy" lock and shows any error.
  async function run(action) {
    setBusy(true);
    setError("");
    try { await action(); } catch (e) { setError(e.message); } finally { setBusy(false); }
  }

  const isOpen = detail?.session.status === "Open";
  const sessionId = detail?.session._id;

  // Live search while typing (waits a moment so it doesn't fire on every key).
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2 || !sessionId || !isOpen) {
      setResults([]);
      setSearching(false);
      return undefined;
    }
    let cancelled = false;
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const data = await api(`/search?q=${encodeURIComponent(q)}&session=${sessionId}`);
        if (!cancelled) setResults(data);
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [query, sessionId, isOpen]);

  // Start / close / reopen all use a small form on the page (browser popups can get blocked).
  function openDialog(type) {
    setDialogName(getSavedName());
    setDialogReason("");
    setDialogError("");
    setDialog(type);
  }
  const startSession = () => openDialog("start");
  const closeSession = () => openDialog("close");
  const reopenSession = () => openDialog("reopen");

  function submitDialog(event) {
    event.preventDefault();
    const name = dialogName.trim();
    const reason = dialogReason.trim();
    if (!name) { setDialogError("Please enter your name."); return; }
    if (dialog === "reopen" && reason.length < 3) { setDialogError("Please give a reason for reopening."); return; }
    saveName(name);
    const type = dialog;
    setDialog(null);
    run(async () => {
      if (type === "start") {
        const session = await api("/sessions/start", { method: "POST", body: JSON.stringify({ startedBy: name }) });
        await refreshTop();
        await refreshDetail(session._id);
        showToast("Today's session has started.");
        setTimeout(() => inputRef.current?.focus(), 60);
      } else if (type === "close") {
        const out = await api(`/sessions/${sessionId}/close`, { method: "POST", body: JSON.stringify({ closedBy: name }) });
        await refreshTop();
        await refreshDetail(sessionId);
        showToast(`Session closed. ${out.autoAbsent} player(s) marked Absent automatically.`);
      } else {
        await api(`/sessions/${sessionId}/reopen`, { method: "POST", body: JSON.stringify({ reason, by: name }) });
        await refreshTop();
        await refreshDetail(sessionId);
        showToast("Session reopened.");
      }
    });
  }

  function openSession(id) {
    setQuery("");
    run(() => refreshDetail(id));
  }

  function checkIn(player, status = "Present") {
    run(async () => {
      const out = await api(`/sessions/${sessionId}/checkin`, {
        method: "POST",
        body: JSON.stringify({ playerId: player._id, status }),
      });
      await refreshDetail(sessionId);
      if (out.previousStatus === status) showToast(`${fullName(player)} was already marked ${status}.`);
      else if (out.previousStatus) showToast(`${fullName(player)} changed from ${out.previousStatus} to ${status}.`);
      else showToast(`${fullName(player)} marked ${status}.`);
      setQuery("");
      setResults([]);
      inputRef.current?.focus();
    });
  }

  function changeStatus(record, status) {
    run(async () => {
      await api(`/sessions/${sessionId}/records/${record.player._id}`, { method: "PATCH", body: JSON.stringify({ status }) });
      await refreshDetail(sessionId);
    });
  }

  function removeRecord(record) {
    run(async () => {
      await api(`/sessions/${sessionId}/records/${record.player._id}`, { method: "DELETE" });
      await refreshDetail(sessionId);
      showToast(`${fullName(record.player)} removed.`);
    });
  }

  function onSearchKey(event) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    // Pressing Enter with exactly one match marks that player Present.
    if (results.length === 1 && !results[0].attendanceStatus) checkIn(results[0]);
  }

  const records = useMemo(() => detail?.records || [], [detail]);
  const notMarked = detail && isOpen ? Math.max(0, detail.activePlayers - records.length) : 0;
  const sportTotals = useMemo(() => {
    const totals = {};
    for (const record of records) {
      if (record.status !== "Present" && record.status !== "Late") continue;
      const list = record.sports?.length ? record.sports : sportsOf(record.player);
      for (const sport of list) totals[sport] = (totals[sport] || 0) + 1;
    }
    return Object.entries(totals).sort((a, b) => b[1] - a[1]);
  }, [records]);

  const startButton = (
    <button className="primary-button" onClick={startSession} disabled={busy}>▶ Start Today's Session</button>
  );
  const session = detail?.session;
  const viewingOther = session && today?.session && session._id !== today.session._id;

  return (
    <>
      <section className="welcome-row">
        <div>
          <div className="eyebrow"><span className="live-dot" /> ACADEMY OPERATIONS</div>
          <h1>Attendance</h1>
          <p>One session per day for the whole academy. Check players in by name, phone number or Player ID.</p>
        </div>
        {canManage && !loading && !today?.session && !error && startButton}
        {viewingOther && <button className="secondary-button" onClick={() => openSession(today.session._id)}>← Back to today</button>}
      </section>

      {error && (
        <p className="form-error">
          {error}{" "}
          {!today && <button className="text-button" onClick={loadEverything}>Try again</button>}
        </p>
      )}
      {loading && <p className="att-muted">Loading attendance...</p>}

      {!loading && today && !today.session && !detail && (
        <section className="panel page-panel">
          <div className="empty-state">
            <h2>No session started today</h2>
            {canManage ? (
              <>
                <p>Start today's session, then check players in as they arrive. {today.activePlayers} active player(s) are expected.</p>
                {startButton}
              </>
            ) : (
              <p>The Admin has not started today's session yet. Check back shortly, then check your players in as they arrive.</p>
            )}
          </div>
        </section>
      )}

      {detail && (
        <div className="att-stack">
          <section className="panel att-status">
            <div className="att-status-head">
              <div>
                <h2>{longDate(session.date)}</h2>
                <p className="att-muted">
                  {isOpen
                    ? `Started by ${session.startedBy || "-"} at ${timeOf(session.startedAt)}`
                    : `Closed by ${session.closedBy} at ${timeOf(session.closedAt)}`}
                </p>
              </div>
              <span className={`status-pill ${isOpen ? "status-active" : "status-inactive"}`}>{isOpen ? "OPEN" : "CLOSED"}</span>
            </div>

            <div className="att-counts">
              <div className="att-count att-c-present"><b>{detail.counts.Present}</b><span>Present</span></div>
              <div className="att-count att-c-late"><b>{detail.counts.Late}</b><span>Late</span></div>
              <div className="att-count att-c-absent"><b>{detail.counts.Absent}</b><span>Absent</span></div>
              <div className="att-count att-c-excused"><b>{detail.counts.Excused}</b><span>Excused</span></div>
              {isOpen && <div className="att-count"><b>{notMarked}</b><span>Not yet marked</span></div>}
            </div>

            {sportTotals.length > 0 && (
              <div className="att-sports">
                <span>Attended by sport:</span>
                {sportTotals.map(([sport, count]) => <em key={sport}>{sport} · {count}</em>)}
              </div>
            )}

            {session.reopenHistory?.length > 0 && (
              <p className="att-muted att-reopen-note">
                Reopened {session.reopenHistory.length} time(s). Last reason: "{session.reopenHistory[session.reopenHistory.length - 1].reason}"
              </p>
            )}

            {canManage && (
              <div className="att-actions">
                {isOpen
                  ? <button className="primary-button" onClick={closeSession} disabled={busy}>Close Session</button>
                  : <button className="secondary-button" onClick={reopenSession} disabled={busy}>Reopen Session (admin)</button>}
              </div>
            )}
          </section>

          {isOpen && (
            <section className="panel att-checkin">
              <div className="section-heading">
                <div>
                  <h2>Check in a player</h2>
                  <p>Type a name, phone number or Player ID (for example SA-0001)</p>
                </div>
              </div>
              <input
                ref={inputRef}
                className="att-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onSearchKey}
                placeholder="Start typing..."
                autoComplete="off"
                autoFocus
              />
              {searching && <p className="att-muted">Searching...</p>}
              {!searching && query.trim().length >= 2 && results.length === 0 && (
                <p className="att-muted">No active player matches "{query.trim()}".</p>
              )}
              {results.length > 0 && (
                <div className="att-results">
                  {results.map((p) => (
                    <div className="att-result" key={p._id}>
                      <Avatar player={p} />
                      <div className="att-result-info">
                        <strong>{fullName(p)}</strong>
                        <span>{p.playerId || "No ID"} · {sportsOf(p).join(", ")}{p.phone ? ` · ${p.phone}` : ""}</span>
                      </div>
                      {p.attendanceStatus ? (
                        <span className="att-already">Already <StatusPill status={p.attendanceStatus} /></span>
                      ) : (
                        <div className="att-result-actions">
                          <button className="primary-button compact" onClick={() => checkIn(p, "Present")} disabled={busy}>Present</button>
                          <button className="secondary-button compact" onClick={() => checkIn(p, "Late")} disabled={busy}>Late</button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          <section className="panel page-panel">
            <div className="section-heading">
              <div>
                <h2>Marked players</h2>
                <p>{records.length} recorded{isOpen && notMarked > 0 ? ` · ${notMarked} not yet marked` : ""}</p>
              </div>
              <button className="text-button" onClick={() => run(() => refreshDetail(sessionId))}>↻ Refresh</button>
            </div>
            {records.length === 0 ? (
              <div className="empty-state"><p>{isOpen ? "Nobody has been checked in yet." : "No records in this session."}</p></div>
            ) : (
              <div className="att-table">
                {records.filter((r) => r.player).map((r) => (
                  <div className="att-row" key={r._id}>
                    <Avatar player={r.player} />
                    <div className="att-row-info">
                      <strong>{fullName(r.player)}</strong>
                      <span>{r.player.playerId || ""} · {(r.sports?.length ? r.sports : sportsOf(r.player)).join(", ")}{r.auto ? " · auto-marked" : ""}</span>
                    </div>
                    <small className="att-time">{timeOf(r.markedAt)}</small>
                    {isOpen ? (
                      <>
                        <select className="att-status-select" value={r.status} onChange={(e) => changeStatus(r, e.target.value)} disabled={busy}>
                          {STATUSES.map((s) => <option key={s}>{s}</option>)}
                        </select>
                        <button className="danger-button compact" onClick={() => removeRecord(r)} disabled={busy}>Remove</button>
                      </>
                    ) : (
                      <StatusPill status={r.status} />
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {!loading && sessions.length > 0 && (
        <section className="panel page-panel att-past-panel">
          <div className="section-heading">
            <div><h2>Past sessions</h2><p>Open one to view it (admins can reopen it)</p></div>
          </div>
          <div className="att-past">
            {sessions.map((s) => (
              <button key={s._id} className={`att-past-row ${sessionId === s._id ? "active" : ""}`} onClick={() => openSession(s._id)}>
                <strong>{shortDate(s.date)}</strong>
                <span className={`status-pill ${s.status === "Open" ? "status-active" : "status-inactive"}`}>{s.status.toUpperCase()}</span>
                <small>{s.status === "Closed" ? `Closed by ${s.closedBy}` : "In progress"}</small>
              </button>
            ))}
          </div>
        </section>
      )}

      {dialog && (
        <div className="att-modal-backdrop" onClick={() => setDialog(null)}>
          <form className="att-modal" onSubmit={submitDialog} onClick={(e) => e.stopPropagation()}>
            <h2>{dialog === "start" ? "Start today's session" : dialog === "close" ? "Close this session" : "Reopen this session"}</h2>
            <p className="att-muted">
              {dialog === "start" && "Enter your name so we know who started it."}
              {dialog === "close" && (notMarked > 0
                ? `${notMarked} active player(s) have not been marked. They will be recorded as Absent. The session will be locked.`
                : "Everyone has been marked. The session will be locked.")}
              {dialog === "reopen" && "Reopening is for fixing mistakes. Automatic Absent marks are removed so late players can still be checked in."}
            </p>
            <label>
              {dialog === "close" ? "Name of the coach or admin closing it" : "Your name (coach or admin)"}
              <input value={dialogName} onChange={(e) => setDialogName(e.target.value)} maxLength="120" autoFocus />
            </label>
            {dialog === "reopen" && (
              <label>
                Reason for reopening
                <textarea rows="2" value={dialogReason} onChange={(e) => setDialogReason(e.target.value)} maxLength="300" />
              </label>
            )}
            {dialogError && <p className="form-error">{dialogError}</p>}
            <div className="att-modal-actions">
              <button className="primary-button" disabled={busy}>
                {dialog === "start" ? "Start Session" : dialog === "close" ? "Close Session" : "Reopen Session"}
              </button>
              <button type="button" className="secondary-button" onClick={() => setDialog(null)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {toast && <div className="att-toast" role="status">{toast}</div>}
    </>
  );
}

// ---------------------------------------------------------------------------
// Attendance summary shown on each player's profile.
// ---------------------------------------------------------------------------
export function PlayerAttendanceCard({ playerId }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError("");
    setShowAll(false);
    api(`/player/${playerId}`)
      .then((result) => { if (!cancelled) setData(result); })
      .catch((e) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [playerId]);

  const pct = data?.percentage;
  const tone = pct == null ? "none" : pct >= 75 ? "good" : pct >= 50 ? "mid" : "low";
  const history = data ? (showAll ? data.history : data.history.slice(0, 10)) : [];

  return (
    <article className="panel att-profile-card">
      <h2>Attendance</h2>
      {error && <p className="form-error">{error}</p>}
      {!data && !error && <p className="att-muted">Loading attendance...</p>}
      {data && (
        <>
          <div className="att-profile-top">
            <div className={`att-percent att-percent-${tone}`}>
              <b>{pct == null ? "—" : `${pct}%`}</b>
              <span>{pct == null ? "No data yet" : `${data.sessionsCounted} session(s) counted`}</span>
            </div>
            <div className="att-counts att-counts-compact">
              <div className="att-count att-c-present"><b>{data.counts.Present}</b><span>Present</span></div>
              <div className="att-count att-c-late"><b>{data.counts.Late}</b><span>Late</span></div>
              <div className="att-count att-c-absent"><b>{data.counts.Absent}</b><span>Absent</span></div>
              <div className="att-count att-c-excused"><b>{data.counts.Excused}</b><span>Excused</span></div>
            </div>
          </div>
          {history.length > 0 ? (
            <div className="att-history">
              {history.map((h) => (
                <div className="att-history-row" key={h._id}>
                  <span>{shortDate(h.date)}</span>
                  <StatusPill status={h.status} />
                  {h.auto && <small>auto-marked</small>}
                </div>
              ))}
            </div>
          ) : (
            <p className="att-muted">No closed sessions recorded for this player yet.</p>
          )}
          {data.history.length > 10 && (
            <button className="text-button" onClick={() => setShowAll((v) => !v)}>
              {showAll ? "Show less" : `Show all ${data.history.length}`}
            </button>
          )}
          <p className="att-muted">
            Attendance % = (Present + Late) ÷ (Present + Late + Absent). Excused days are not counted. Only closed sessions count.
          </p>
        </>
      )}
    </article>
  );
}

// ---------------------------------------------------------------------------
// Monthly report: one row per player, one column per session day.
// ---------------------------------------------------------------------------
const currentMonth = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" })
    .format(new Date())
    .slice(0, 7);

function shiftMonth(month, delta) {
  const [year, mon] = month.split("-").map(Number);
  const d = new Date(Date.UTC(year, mon - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function MonthlyReport() {
  const [month, setMonth] = useState(currentMonth());
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    api(`/monthly?month=${month}`)
      .then((result) => { if (!cancelled) setData(result); })
      .catch((e) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [month]);

  const monthLabel = new Date(`${month}-01T12:00:00`).toLocaleDateString("en-IN", { month: "long", year: "numeric" });

  function downloadCsv() {
    const header = ["Player ID", "Name", "Sports", ...data.sessions.map((s) => s.date), "Present", "Late", "Absent", "Excused", "Attendance %"];
    const lines = [
      header,
      ...data.players.map((row) => [
        row.player.playerId || "",
        fullName(row.player),
        sportsOf(row.player).join(" / "),
        ...data.sessions.map((s) => row.days[s.date] || ""),
        row.counts.Present, row.counts.Late, row.counts.Absent, row.counts.Excused,
        row.percentage ?? "",
      ]),
    ];
    const csv = lines.map((line) => line.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `attendance-${month}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <section className="welcome-row">
        <div>
          <div className="eyebrow"><span className="live-dot" /> ACADEMY OPERATIONS</div>
          <h1>Monthly report</h1>
          <p>Attendance for every player, day by day. Only closed sessions count towards the percentage.</p>
        </div>
      </section>

      <section className="panel page-panel">
        <div className="att-month-controls">
          <button className="secondary-button compact" onClick={() => setMonth(shiftMonth(month, -1))}>‹ Previous</button>
          <strong>{monthLabel}</strong>
          <button className="secondary-button compact" onClick={() => setMonth(shiftMonth(month, 1))}>Next ›</button>
          <input type="month" className="att-month-input" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} />
          <button className="primary-button compact" onClick={downloadCsv} disabled={!data || data.players.length === 0}>⬇ Download CSV</button>
        </div>

        {error && <p className="form-error">{error}</p>}
        {loading && <p className="att-muted">Loading report...</p>}

        {!loading && data && data.sessions.length === 0 && (
          <div className="empty-state"><h3>No sessions in {monthLabel}</h3><p>Sessions you start will appear here.</p></div>
        )}

        {!loading && data && data.sessions.length > 0 && (
          <>
            <div className="att-month-wrap">
              <table className="att-month">
                <thead>
                  <tr>
                    <th className="att-sticky">Player</th>
                    {data.sessions.map((s) => (
                      <th key={s._id} title={`${shortDate(s.date)}${s.status === "Open" ? " (still open)" : ""}`} className={s.status === "Open" ? "att-open-col" : ""}>
                        {Number(s.date.slice(8))}
                      </th>
                    ))}
                    <th>Att.</th>
                    <th>Abs.</th>
                    <th>%</th>
                  </tr>
                </thead>
                <tbody>
                  {data.players.map((row) => (
                    <tr key={row.player._id}>
                      <td className="att-sticky">
                        <strong>{fullName(row.player)}</strong>
                        <small>{row.player.playerId || ""} · {sportsOf(row.player).join(", ")}</small>
                      </td>
                      {data.sessions.map((s) => {
                        const status = row.days[s.date];
                        return (
                          <td key={s._id} className={`att-cell ${status ? `att-cell-${status.toLowerCase()}` : "att-cell-none"}`} title={status || "No record"}>
                            {status ? status[0] : "·"}
                          </td>
                        );
                      })}
                      <td>{row.counts.Present + row.counts.Late}</td>
                      <td>{row.counts.Absent}</td>
                      <td><b>{row.percentage == null ? "—" : `${row.percentage}%`}</b></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="att-muted">P = Present · L = Late · A = Absent · E = Excused · · = no record. Shaded column = session still open.</p>
          </>
        )}
      </section>
    </>
  );
}

// ---------------------------------------------------------------------------
// The Attendance page: two tabs.
// ---------------------------------------------------------------------------
export default function AttendancePage({ role = "admin" }) {
  const [view, setView] = useState("daily");
  return (
    <>
      <div className="att-tabs">
        <button className={`att-tab ${view === "daily" ? "active" : ""}`} onClick={() => setView("daily")}>Today &amp; sessions</button>
        <button className={`att-tab ${view === "monthly" ? "active" : ""}`} onClick={() => setView("monthly")}>Monthly report</button>
      </div>
      {view === "daily" ? <DailyAttendance canManage={role === "admin"} /> : <MonthlyReport />}
    </>
  );
}
