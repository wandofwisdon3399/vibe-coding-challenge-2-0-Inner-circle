import { useEffect, useMemo, useRef, useState } from "react";
import CalendarDatePicker from "./CalendarDatePicker.jsx";
import "./MatchesPage.css";

const API = "/api/matches";
const SPORTS = ["Football", "Cricket", "Basketball", "Badminton", "Tennis", "Volleyball", "Other"];
const PERFORMANCE = ["Excellent", "Good", "Average", "Needs Improvement"];

const fullName = (p) => `${p?.firstName || ""} ${p?.lastName || ""}`.trim();
const initials = (p) => `${p?.firstName?.[0] || ""}${p?.lastName?.[0] || ""}`.toUpperCase() || "PL";
const sportsOf = (p) => (p?.sports?.length ? p.sports : p?.sport ? [p.sport] : []);
const isActive = (p) => (p?.status || "Active") === "Active";
const dayOf = (m) => (m?.date ? String(m.date).slice(0, 10) : "");
const slug = (text) => text.toLowerCase().replace(/\s+/g, "-");
const prettyDate = (day) =>
  day ? new Date(`${day}T12:00:00`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" }) : "Date TBC";

async function api(path, options) {
  let response;
  try {
    response = await fetch(`${API}${path}`, { credentials: "include", headers: { "Content-Type": "application/json" }, ...options });
  } catch {
    throw new Error("Cannot reach the server. Check that the backend is running (npm run server).");
  }
  if (!(response.headers.get("content-type") || "").includes("application/json")) {
    throw new Error(`The server sent an unexpected reply (HTTP ${response.status}). Restart the backend and try again.`);
  }
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "Something went wrong.");
  return data;
}

function Avatar({ player }) {
  return player?.photo
    ? <img className="player-avatar-img" src={player.photo} alt="" />
    : <div className="player-avatar">{initials(player)}</div>;
}

function PerformancePill({ value }) {
  return value
    ? <span className={`mt-perf mt-perf-${slug(value)}`}>{value}</span>
    : <span className="mt-perf mt-perf-none">Not rated</span>;
}

function StatusPill({ status }) {
  return <span className={`status-pill ${status === "Completed" ? "status-active" : status === "Cancelled" ? "status-inactive" : ""}`}>{status}</span>;
}

// ---------------------------------------------------------------------------
// Create / edit a match, including choosing the players who will take part.
// ---------------------------------------------------------------------------
function MatchForm({ match, defaultSport, sportOptions = SPORTS, players, onClose, onSaved }) {
  const [title, setTitle] = useState(match?.title || "");
  const [sport, setSport] = useState(match?.sport || defaultSport || "Football");
  const [date, setDate] = useState(match ? dayOf(match) : "");
  const [venue, setVenue] = useState(match?.venue || "");
  const [opponent, setOpponent] = useState(match?.opponent || "");
  const [selected, setSelected] = useState(() => (match?.participants || []).map((p) => p.player?._id).filter(Boolean));
  const [search, setSearch] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const candidates = useMemo(() => {
    const q = search.trim().toLowerCase();
    return players.filter((p) => {
      if (!isActive(p)) return false;
      const inSport = showAll || sport === "Other" || sportsOf(p).some((s) => s.toLowerCase() === sport.toLowerCase());
      if (!inSport && !selected.includes(p._id)) return false;
      return !q || `${fullName(p)} ${p.playerId || ""}`.toLowerCase().includes(q);
    });
  }, [players, sport, showAll, search, selected]);

  const toggle = (id) => setSelected((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]));
  const selectAllShown = () => setSelected((list) => [...new Set([...list, ...candidates.map((p) => p._id)])]);

  async function submit(event) {
    event.preventDefault();
    if (!title.trim()) { setError("Please enter a match title."); return; }
    if (!date) { setError("Please choose the match date."); return; }
    setSaving(true);
    setError("");
    try {
      const body = JSON.stringify({ title: title.trim(), sport, date, venue, opponent, participants: selected });
      if (match) await api(`/${match._id}`, { method: "PATCH", body });
      else await api("", { method: "POST", body });
      await onSaved();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="panel player-form-card">
      <div className="section-heading">
        <div><h2>{match ? "Edit Match" : "Schedule a Match"}</h2><p>Fill in the fixture and choose who will take part</p></div>
        <button className="secondary-button" type="button" onClick={onClose}>Close</button>
      </div>
      <form onSubmit={submit}>
        <div className="player-form-grid">
          <label>Match title *<input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Academy League Match 1" maxLength="120" /></label>
          <label>Sport *<select value={sport} onChange={(e) => setSport(e.target.value)}>{sportOptions.map((s) => <option key={s}>{s}</option>)}</select></label>
          <label>Date *<CalendarDatePicker value={date} onChange={setDate} placeholder="Choose match date" /></label>
          <label>Venue<input value={venue} onChange={(e) => setVenue(e.target.value)} maxLength="160" placeholder="Academy Ground" /></label>
          <label>Opponent / team<input value={opponent} onChange={(e) => setOpponent(e.target.value)} maxLength="120" placeholder="Opponent name" /></label>
        </div>

        <div className="mt-picker">
          <div className="mt-picker-head">
            <strong>Players taking part <span className="mt-count">{selected.length} selected</span></strong>
            <div>
              <button type="button" className="text-button" onClick={selectAllShown}>Select all shown</button>
              <button type="button" className="text-button" onClick={() => setSelected([])}>Clear</button>
            </div>
          </div>
          <input className="mt-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or Player ID..." autoComplete="off" />
          <label className="mt-inline-check">
            <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} /> Show players from all sports
          </label>
          <div className="mt-picker-list">
            {candidates.length === 0 ? (
              <p className="mt-muted">No active {sport} players found. Tick "Show players from all sports", or register players first.</p>
            ) : candidates.map((p) => {
              const on = selected.includes(p._id);
              return (
                <label key={p._id} className={`mt-pick ${on ? "on" : ""}`}>
                  <input type="checkbox" checked={on} onChange={() => toggle(p._id)} />
                  <Avatar player={p} />
                  <span><strong>{fullName(p)}</strong><small>{p.playerId || "No ID"} · {sportsOf(p).join(", ")}</small></span>
                </label>
              );
            })}
          </div>
          <p className="mt-muted">You can change this list later, and on the result form you can also add players who were present that day.</p>
        </div>

        {error && <p className="form-error">{error}</p>}
        <div className="player-form-actions">
          <button className="primary-button" disabled={saving}>{saving ? "Saving..." : match ? "Save Changes" : "Save Match"}</button>
          <button type="button" className="secondary-button" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Record the result and rate each player (replaces the old browser popup).
// ---------------------------------------------------------------------------
function ResultModal({ match, players, onClose, onSaved }) {
  const [result, setResult] = useState(match.result || "");
  const [rows, setRows] = useState(() =>
    (match.participants || []).filter((p) => p.player).map((p) => ({ player: p.player, performance: p.performance || "" }))
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const rowIds = new Set(rows.map((r) => r.player._id));
  const suggestions = (match.presentThatDay || []).filter((p) => !rowIds.has(p._id));
  const suggestionIds = new Set(suggestions.map((p) => p._id));
  const others = players.filter(
    (p) => isActive(p) && !rowIds.has(p._id) && !suggestionIds.has(p._id) &&
      (match.sport === "Other" || sportsOf(p).some((s) => s.toLowerCase() === match.sport.toLowerCase()))
  );
  const unrated = rows.filter((r) => !r.performance).length;

  const setPerformance = (id, value) =>
    setRows((list) => list.map((r) => (r.player._id === id ? { ...r, performance: r.performance === value ? "" : value } : r)));
  const removeRow = (id) => setRows((list) => list.filter((r) => r.player._id !== id));
  const addRow = (player) => setRows((list) => (list.some((r) => r.player._id === player._id) ? list : [...list, { player, performance: "" }]));

  async function submit(event) {
    event.preventDefault();
    if (!result.trim()) { setError("Please enter the result or score."); return; }
    setSaving(true);
    setError("");
    try {
      await api(`/${match._id}/result`, {
        method: "POST",
        body: JSON.stringify({ result: result.trim(), participants: rows.map((r) => ({ player: r.player._id, performance: r.performance })) }),
      });
      await onSaved();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-modal-backdrop" onClick={onClose}>
      <form className="mt-modal" onSubmit={submit} onClick={(e) => e.stopPropagation()}>
        <h2>{match.status === "Completed" ? "Edit result" : "Record result"}</h2>
        <p className="mt-muted">{match.title} · {match.sport} · {prettyDate(dayOf(match))}</p>

        <label className="mt-field">
          Result / score *
          <input value={result} onChange={(e) => setResult(e.target.value)} placeholder="e.g. Won 3-1, or Lost by 12 runs" maxLength="160" autoFocus />
        </label>

        <div>
          <strong className="mt-section-title">Players and performance</strong>
          {rows.length === 0 && <p className="mt-muted">No players yet. Add the players who took part below.</p>}
          <div className="mt-rate-list">
            {rows.map((row) => (
              <div className="mt-rate-row" key={row.player._id}>
                <div className="mt-rate-who">
                  <Avatar player={row.player} />
                  <span><strong>{fullName(row.player)}</strong><small>{row.player.playerId || ""}</small></span>
                  <button type="button" className="mt-remove" title="Did not play" onClick={() => removeRow(row.player._id)}>✕</button>
                </div>
                <div className="mt-rate-options">
                  {PERFORMANCE.map((option) => (
                    <button
                      type="button"
                      key={option}
                      className={`mt-perf-btn mt-perf-${slug(option)} ${row.performance === option ? "on" : ""}`}
                      onClick={() => setPerformance(row.player._id, option)}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {rows.length > 0 && unrated > 0 && <p className="mt-muted">{unrated} player(s) not rated yet. You can save now and rate them later.</p>}
        </div>

        {suggestions.length > 0 && (
          <div>
            <strong className="mt-section-title">Present on match day (from attendance)</strong>
            <p className="mt-muted">Tap a player to add them to this match.</p>
            <div className="mt-chips">
              {suggestions.map((p) => <button type="button" key={p._id} className="mt-chip" onClick={() => addRow(p)}>＋ {fullName(p)}</button>)}
            </div>
          </div>
        )}

        {others.length > 0 && (
          <select className="mt-add-select" value="" onChange={(e) => { const p = players.find((x) => x._id === e.target.value); if (p) addRow(p); }}>
            <option value="">Add another player...</option>
            {others.map((p) => <option key={p._id} value={p._id}>{fullName(p)} ({p.playerId || "no ID"})</option>)}
          </select>
        )}

        {error && <p className="form-error">{error}</p>}
        <div className="mt-modal-actions">
          <button className="primary-button" disabled={saving}>{saving ? "Saving..." : "Save Result"}</button>
          <button type="button" className="secondary-button" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Match details: who played, result, and how each player performed.
// ---------------------------------------------------------------------------
function MatchDetail({ id, players, version, autoResult, onBack, onEdit, onChanged }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [showResult, setShowResult] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [busy, setBusy] = useState(false);
  const autoShown = useRef(false);

  useEffect(() => {
    let cancelled = false;
    setError("");
    api(`/${id}`)
      .then((result) => {
        if (cancelled) return;
        setData(result);
        if (autoResult && !autoShown.current) { autoShown.current = true; setShowResult(true); }
      })
      .catch((e) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [id, version, autoResult]);

  async function setStatus(status) {
    setBusy(true);
    setError("");
    try {
      await api(`/${id}`, { method: "PATCH", body: JSON.stringify({ status }) });
      setConfirmCancel(false);
      await onChanged();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  const participants = (data?.participants || []).filter((p) => p.player);
  const tally = PERFORMANCE.map((level) => [level, participants.filter((p) => p.performance === level).length]);

  return (
    <section className="mt-detail">
      <button className="back-button" onClick={onBack}>← Back to Matches</button>
      {error && <p className="form-error">{error}</p>}
      {!data && !error && <p className="mt-muted">Loading match...</p>}
      {data && (
        <>
          <div className="panel mt-detail-head">
            <div>
              <span className="eyebrow">{data.sport}</span>
              <h1>{data.title}</h1>
              <p className="mt-muted">
                {prettyDate(dayOf(data))}{data.opponent ? ` · vs ${data.opponent}` : ""}{data.venue ? ` · ${data.venue}` : ""}
              </p>
              {data.status === "Completed" && <p className="match-result">Result: {data.result}</p>}
            </div>
            <StatusPill status={data.status} />
          </div>

          <div className="mt-actions">
            {data.status === "Upcoming" && (
              <>
                <button className="primary-button" onClick={() => setShowResult(true)}>Record Result</button>
                <button className="secondary-button" onClick={() => onEdit(data)}>Edit match & players</button>
                {confirmCancel ? (
                  <>
                    <button className="danger-button" onClick={() => setStatus("Cancelled")} disabled={busy}>Yes, cancel this match</button>
                    <button className="secondary-button" onClick={() => setConfirmCancel(false)}>Keep it</button>
                  </>
                ) : (
                  <button className="danger-button" onClick={() => setConfirmCancel(true)}>Cancel match</button>
                )}
              </>
            )}
            {data.status === "Completed" && (
              <>
                <button className="secondary-button" onClick={() => setShowResult(true)}>Edit result & ratings</button>
                <button className="secondary-button" onClick={() => onEdit(data)}>Edit match details</button>
              </>
            )}
            {data.status === "Cancelled" && (
              <button className="secondary-button" onClick={() => setStatus("Upcoming")} disabled={busy}>Reopen as upcoming</button>
            )}
          </div>

          <section className="panel page-panel">
            <div className="section-heading">
              <div>
                <h2>{data.status === "Completed" ? "Players who took part" : "Selected players"}</h2>
                <p>{participants.length} player(s)</p>
              </div>
            </div>
            {data.status === "Completed" && participants.length > 0 && (
              <div className="mt-tally">{tally.map(([level, count]) => <span key={level} className={`mt-perf mt-perf-${slug(level)}`}>{level} · {count}</span>)}</div>
            )}
            {participants.length === 0 ? (
              <div className="empty-state">
                <p>{data.status === "Upcoming" ? "No players selected yet. Use “Edit match & players” to choose who will take part." : "No players were recorded for this match."}</p>
              </div>
            ) : (
              <div className="mt-people">
                {participants.map((p) => (
                  <div className="mt-person" key={p.player._id}>
                    <Avatar player={p.player} />
                    <div className="mt-person-info"><strong>{fullName(p.player)}</strong><small>{p.player.playerId || ""} · {sportsOf(p.player).join(", ")}</small></div>
                    {data.status === "Completed" ? <PerformancePill value={p.performance} /> : null}
                  </div>
                ))}
              </div>
            )}
          </section>

          {showResult && (
            <ResultModal
              match={data}
              players={players}
              onClose={() => setShowResult(false)}
              onSaved={async () => { setShowResult(false); await onChanged(); }}
            />
          )}
        </>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// The Matches page.
// ---------------------------------------------------------------------------
// allowedSports: when given (Coach), only these sports can be chosen or filtered.
export default function MatchesPage({ matches, loading, error, players, reload, intent, allowedSports }) {
  const sportOptions = allowedSports?.length ? allowedSports : SPORTS;
  const [view, setView] = useState(intent?.openMatchId ? { id: intent.openMatchId } : null);
  const [formState, setFormState] = useState(intent?.openForm ? { match: null } : null);
  const [statusFilter, setStatusFilter] = useState("All");
  const [sportFilter, setSportFilter] = useState(intent?.sport || "All");
  const [version, setVersion] = useState(0);

  async function changed() {
    setVersion((v) => v + 1);
    await reload();
  }

  const list = useMemo(() => {
    const rank = { Upcoming: 0, Completed: 1, Cancelled: 2 };
    return matches
      .filter((m) => (statusFilter === "All" || m.status === statusFilter) && (sportFilter === "All" || m.sport === sportFilter))
      .sort((a, b) =>
        (rank[a.status] ?? 3) - (rank[b.status] ?? 3) ||
        (a.status === "Upcoming" ? dayOf(a).localeCompare(dayOf(b)) : dayOf(b).localeCompare(dayOf(a)))
      );
  }, [matches, statusFilter, sportFilter]);

  const form = formState && (
    <MatchForm
      key={formState.match?._id || "new"}
      match={formState.match}
      sportOptions={sportOptions}
      defaultSport={intent?.sport && intent.sport !== "All" ? intent.sport : sportFilter !== "All" ? sportFilter : sportOptions[0]}
      players={players}
      onClose={() => setFormState(null)}
      onSaved={async () => { setFormState(null); await changed(); }}
    />
  );

  if (view) {
    return (
      <>
        {form}
        <MatchDetail
          id={view.id}
          players={players}
          version={version}
          autoResult={view.autoResult}
          onBack={() => setView(null)}
          onEdit={(match) => setFormState({ match })}
          onChanged={changed}
        />
      </>
    );
  }

  return (
    <>
      <section className="welcome-row">
        <div>
          <div className="eyebrow"><span className="live-dot" /> COMPETITIONS</div>
          <h1>Matches</h1>
          <p>Schedule fixtures, choose the players, and record results with player performance.</p>
        </div>
        <button className="primary-button" onClick={() => setFormState(formState ? null : { match: null })}>＋ Add Match</button>
      </section>

      {form}

      <section className="panel page-panel">
        <div className="section-heading">
          <div><h2>All Matches</h2><p>{list.length} shown of {matches.length}</p></div>
          <button className="text-button" onClick={reload}>↻ Refresh</button>
        </div>
        <div className="mt-filters">
          {["All", "Upcoming", "Completed", "Cancelled"].map((s) => (
            <button key={s} className={`att-tab ${statusFilter === s ? "active" : ""}`} onClick={() => setStatusFilter(s)}>{s}</button>
          ))}
          <select className="mt-sport-select" value={sportFilter} onChange={(e) => setSportFilter(e.target.value)}>
            <option value="All">All sports</option>
            {sportOptions.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>

        {loading && matches.length === 0 ? <p className="mt-muted">Loading matches...</p>
          : error ? <p className="form-error">{error}</p>
          : list.length === 0 ? (
            <div className="empty-state"><h3>No matches here</h3><p>Use Add Match to schedule a fixture.</p></div>
          ) : (
            <div className="match-list">
              {list.map((m) => (
                <article className="match-item match-item-wide mt-card" key={m._id}>
                  <div className="match-item-top">
                    <div><span className="eyebrow">{m.sport}</span><h3>{m.title}</h3></div>
                    <StatusPill status={m.status} />
                  </div>
                  <p>{m.opponent ? `vs ${m.opponent} · ` : ""}{m.venue || "Venue TBC"}</p>
                  <small>{prettyDate(dayOf(m))} · {(m.participants || []).length} player(s)</small>
                  {m.result && <p className="match-result">Result: {m.result}</p>}
                  <div className="mt-card-actions">
                    <button className="secondary-button compact" onClick={() => setView({ id: m._id })}>View details</button>
                    {m.status === "Upcoming" && <button className="primary-button compact" onClick={() => setView({ id: m._id, autoResult: true })}>Record result</button>}
                  </div>
                </article>
              ))}
            </div>
          )}
      </section>
    </>
  );
}
