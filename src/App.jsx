
import { useEffect, useMemo, useState } from "react";
import "./App.css";
import LoginPage from "./LoginPage.jsx";
import ChangePasswordPage from "./ChangePasswordPage.jsx";
import AttendancePage, { PlayerAttendanceCard } from "./AttendancePage.jsx";
import CalendarDatePicker from "./CalendarDatePicker.jsx";
import MatchesPage from "./MatchesPage.jsx";
import CoachesPage from "./CoachesPage.jsx";
import ScoutsPage from "./ScoutsPage.jsx";
import ScoutWorkspace from "./ScoutWorkspace.jsx";
import PlayerWorkspace from "./PlayerWorkspace.jsx";
import CoachWorkspace from "./CoachWorkspace.jsx";
import TrialReadinessPage from "./TrialReadinessPage.jsx";
import {
  useDrawer,
  usePageHistory,
  useScrollToTop,
  pageFromHash,
} from "./useMobileNav.js";
import LoginCredentialsPanel from "./LoginCredentialsPanel.jsx";
import PlayerAccountPanel from "./PlayerAccountPanel.jsx";
import {
  AttendanceSnapshot,
  UpcomingMatches,
  ActivityFeed,
  getUpcomingMatches,
} from "./DashboardWidgets.jsx";

const API_URL = "/api/players";
const MATCH_API_URL = "/api/matches";
const ATT_SUMMARY_URL = "/api/attendance/summary";
const AUTH_URL = "/api/auth";

const SPORTS = [
  "Football",
  "Cricket",
  "Basketball",
  "Badminton",
  "Tennis",
  "Volleyball",
  "Other",
];

const NAV = [
  { id: "dashboard", label: "Dashboard", icon: "▦" },
  { id: "players", label: "Players", icon: "♙" },
  { id: "coaches", label: "Coaches", icon: "♟" },
  { id: "scouts", label: "Scouts", icon: "◉" },
  { id: "games", label: "Games", icon: "⚽" },
  { id: "attendance", label: "Attendance", icon: "☑" },
  { id: "matches", label: "Matches", icon: "⚑" },
  { id: "trials", label: "Trial Readiness", icon: "◎" },
];

const ADMIN_PAGES = NAV.map((item) => item.id);

const blankForm = {
  firstName: "",
  lastName: "",
  age: "",
  sports: [],
  phone: "",
  email: "",
  position: "",
  photo: "",
};

const sportsOf = (p) =>
  p?.sports?.length ? p.sports : p?.sport ? [p.sport] : [];

const initials = (p) =>
  `${p?.firstName?.[0] || ""}${p?.lastName?.[0] || ""}`.toUpperCase() ||
  "PL";

const fullName = (p) =>
  `${p.firstName || ""} ${p.lastName || ""}`.trim();

const achievementTitles = (p) =>
  (p.achievements || [])
    .map((item) => item.title?.trim())
    .filter(Boolean);

function Avatar({ player, large = false }) {
  return player.photo ? (
    <img
      className={`player-avatar-img ${large ? "large" : ""}`}
      src={player.photo}
      alt={`${fullName(player)} profile`}
    />
  ) : (
    <div className={`player-avatar ${large ? "large" : ""}`}>
      {initials(player)}
    </div>
  );
}

function PageHeading({ eyebrow, title, description, action }) {
  return (
    <section className="welcome-row">
      <div>
        <div className="eyebrow">
          <span className="live-dot" /> {eyebrow}
        </div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </section>
  );
}

function App() {
  const [activePage, setActivePage] = useState(() =>
    pageFromHash(ADMIN_PAGES, "dashboard")
  );
  const drawer = useDrawer();

  // Authentication
  const [currentUser, setCurrentUser] = useState(null);
  const [newPlayerCredentials, setNewPlayerCredentials] = useState(null);
  const [authChecking, setAuthChecking] = useState(true);

  // Main application data
  const [players, setPlayers] = useState([]);
  const [matches, setMatches] = useState([]);
  const [matchesLoading, setMatchesLoading] = useState(false);
  const [matchesError, setMatchesError] = useState("");

  const [selectedSport, setSelectedSport] = useState("Football");
  const [matchIntent, setMatchIntent] = useState(null);

  // Player management
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState(null);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [form, setForm] = useState(blankForm);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState("Active");
  const [search, setSearch] = useState("");

  // Player profile
  const [noteText, setNoteText] = useState("");
  const [achievement, setAchievement] = useState({
    title: "",
    description: "",
    date: "",
  });
  const [detailError, setDetailError] = useState("");

  // Attendance dashboard data
  const [attSummary, setAttSummary] = useState(null);
  const [attError, setAttError] = useState("");

  // Load players
  async function fetchPlayers() {
    try {
      setLoading(true);
      setLoadError("");

      const response = await fetch(API_URL, {
        credentials: "include",
      });

      const data = await response.json();

      if (!response.ok || !Array.isArray(data)) {
        throw new Error(data.message || "Unable to load players.");
      }

      setPlayers(data);

      if (selectedPlayer) {
        setSelectedPlayer(
          data.find((p) => p._id === selectedPlayer._id) || null
        );
      }
    } catch (error) {
      setLoadError(
        error.message || "Unable to load players from the server."
      );
    } finally {
      setLoading(false);
    }
  }

  // Load matches
  async function fetchMatches() {
    try {
      setMatchesLoading(true);
      setMatchesError("");

      const response = await fetch(MATCH_API_URL, {
        credentials: "include",
      });

      const data = await response.json();

      if (!response.ok || !Array.isArray(data)) {
        throw new Error(data.message || "Unable to load matches.");
      }

      setMatches(data);
    } catch (error) {
      setMatchesError(error.message || "Unable to load matches.");
    } finally {
      setMatchesLoading(false);
    }
  }

  // Restore the logged-in session when the application opens
  useEffect(() => {
    async function restoreSession() {
      try {
        const response = await fetch(`${AUTH_URL}/me`, {
          credentials: "include",
        });

        if (!response.ok) return;

        const data = await response.json();

        setCurrentUser(data.user);

        if (data.user.role === "admin" && !data.user.mustChangePassword) {
          await Promise.all([fetchPlayers(), fetchMatches()]);
        }
      } catch (error) {
        console.error("Session restoration failed:", error);
      } finally {
        setAuthChecking(false);
      }
    }

    restoreSession();
  }, []);

  // Called after successful login
  async function handleLogin(user) {
    setCurrentUser(user);

    // Data is loaded after the mandatory password change if one is pending
    if (user.role === "admin" && !user.mustChangePassword) {
      await Promise.all([fetchPlayers(), fetchMatches()]);
    }
  }

  // Called after the temporary password has been replaced
  async function handlePasswordChanged(user) {
    setCurrentUser(user);

    if (user.role === "admin") {
      await Promise.all([fetchPlayers(), fetchMatches()]);
    }
  }

  // Logout
  async function handleLogout() {
    try {
      await fetch(`${AUTH_URL}/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch (error) {
      console.error("Logout request failed:", error);
    } finally {
      setCurrentUser(null);
      setNewPlayerCredentials(null);
      setPlayers([]);
      setMatches([]);
      setAttSummary(null);
      setActivePage("dashboard");
      setSelectedPlayer(null);
    }
  }

  // Load attendance summary
  async function fetchAttSummary() {
    try {
      setAttError("");

      const response = await fetch(ATT_SUMMARY_URL, {
        credentials: "include",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to load attendance.");
      }

      setAttSummary(data);
    } catch (error) {
      setAttError(error.message || "Unable to load attendance.");
    }
  }

  // Refresh attendance when the Admin opens the dashboard
  useEffect(() => {
    if (
      currentUser?.role === "admin" &&
      activePage === "dashboard"
    ) {
      fetchAttSummary();
    }
  }, [activePage, currentUser]);

  // Back/Forward buttons move between pages; every new page starts at the top
  usePageHistory({
    page: activePage,
    validPages: ADMIN_PAGES,
    onPageChange: navigate,
    enabled: currentUser?.role === "admin",
  });

  useScrollToTop(`${activePage}:${selectedPlayer?._id || ""}`);

  function navigate(page) {
    setMatchIntent(null);
    setActivePage(page);
    setShowForm(false);
    setEditingPlayer(null);
    setSelectedPlayer(null);
    setFormError("");
  }

  function openAddForm() {
    setEditingPlayer(null);
    setForm({ ...blankForm });
    setFormError("");
    setShowForm(true);
  }

  function openEditForm(player) {
    setEditingPlayer(player);

    setForm({
      firstName: player.firstName || "",
      lastName: player.lastName || "",
      age: player.age || "",
      sports: sportsOf(player),
      phone: player.phone || "",
      email: player.email || "",
      position: player.position || "",
      photo: player.photo || "",
      status: player.status || "Active",
    });

    setFormError("");
    setShowForm(true);
  }

  // Player photo upload
  async function handlePhoto(event) {
    const file = event.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setFormError("Please choose an image file.");
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      setFormError("Choose an image smaller than 8 MB.");
      return;
    }

    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const image = new Image();
      image.src = dataUrl;

      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = reject;
      });

      const canvas = document.createElement("canvas");
      const scale = Math.min(
        1,
        640 / Math.max(image.width, image.height)
      );

      canvas.width = Math.round(image.width * scale);
      canvas.height = Math.round(image.height * scale);

      canvas
        .getContext("2d")
        .drawImage(image, 0, 0, canvas.width, canvas.height);

      setForm((current) => ({
        ...current,
        photo: canvas.toDataURL("image/jpeg", 0.78),
      }));

      setFormError("");
    } catch {
      setFormError("Could not read that image. Try another photo.");
    }
  }

  // Save new or edited player
  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setFormError("");

    const payload = {
      ...form,
      age: Number(form.age),
    };

    if (!form.sports?.length) {
      setFormError("Please choose at least one sport.");
      setSaving(false);
      return;
    }

    try {
      const response = await fetch(
        editingPlayer
          ? `${API_URL}/${editingPlayer._id}`
          : API_URL,
        {
          method: editingPlayer ? "PATCH" : "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Could not save player.");
      }

      // A new player also comes back with their one-time login details.
      const { credentials, ...playerData } = result;

      setPlayers((current) =>
        editingPlayer
          ? current.map((p) => (p._id === playerData._id ? playerData : p))
          : [playerData, ...current]
      );

      if (!editingPlayer && credentials) {
        setNewPlayerCredentials({
          ...credentials,
          playerName: fullName(playerData),
        });
      }

      setShowForm(false);
      setEditingPlayer(null);
      setForm({ ...blankForm });

      if (selectedPlayer?._id === playerData._id) {
        setSelectedPlayer(playerData);
      }
    } catch (error) {
      setFormError(error.message);
    } finally {
      setSaving(false);
    }
  }

  // Deactivate player
  async function deactivatePlayer(player) {
    const reason = window.prompt(
      `Why is ${fullName(player)} being moved to inactive?`,
      "Expelled / Left academy"
    );

    if (reason === null) return;

    try {
      const response = await fetch(`${API_URL}/${player._id}`, {
        method: "DELETE",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ reason }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Could not deactivate player.");
      }

      setPlayers((current) =>
        current.map((p) =>
          p._id === player._id ? result.player : p
        )
      );

      if (selectedPlayer?._id === player._id) {
        setSelectedPlayer(result.player);
      }
    } catch (error) {
      window.alert(error.message);
    }
  }

  // Update player profile
  async function updatePlayer(playerId, patch) {
    const response = await fetch(`${API_URL}/${playerId}`, {
      method: "PATCH",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(patch),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || "Could not update player.");
    }

    setPlayers((current) =>
      current.map((p) => (p._id === playerId ? result : p))
    );

    setSelectedPlayer(result);
  }

  // Add player note
  async function addNote(event) {
    event.preventDefault();

    if (!noteText.trim() || !selectedPlayer) return;

    try {
      setDetailError("");

      await updatePlayer(selectedPlayer._id, {
        notes: [
          ...(selectedPlayer.notes || []),
          { text: noteText.trim() },
        ],
      });

      setNoteText("");
    } catch (error) {
      setDetailError(error.message);
    }
  }

  // Add player achievement
  async function addAchievement(event) {
    event.preventDefault();

    if (!achievement.title.trim() || !selectedPlayer) return;

    try {
      setDetailError("");

      await updatePlayer(selectedPlayer._id, {
        achievements: [
          ...(selectedPlayer.achievements || []),
          {
            ...achievement,
            date: achievement.date || null,
          },
        ],
      });

      setAchievement({
        title: "",
        description: "",
        date: "",
      });
    } catch (error) {
      setDetailError(error.message);
    }
  }

  const activePlayers = players.filter(
    (p) => (p.status || "Active") === "Active"
  );

  const filteredPlayers = useMemo(
    () =>
      players.filter(
        (p) =>
          (filter === "All" ||
            (p.status || "Active") === filter) &&
          `${fullName(p)} ${sportsOf(p).join(" ")} ${
            p.position || ""
          } ${p.playerId || ""} ${p.phone || ""}`
            .toLowerCase()
            .includes(search.toLowerCase())
      ),
    [players, filter, search]
  );

  const pageTitles = {
    dashboard: "Dashboard",
    players: "Players",
    coaches: "Coaches",
    scouts: "Scouts",
    games: "Games",
    attendance: "Attendance",
    matches: "Matches",
    trials: "Trial Readiness",
  };

  // Player registration form
  function renderPlayerForm() {
    if (!showForm) return null;

    return (
      <section className="panel player-form-card">
        <div className="section-heading">
          <div>
            <h2>
              {editingPlayer
                ? "Edit Player Details"
                : "Register New Player"}
            </h2>
            <p>Fields marked with * are required</p>
          </div>

          <button
            className="secondary-button"
            type="button"
            onClick={() => setShowForm(false)}
          >
            Close
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="photo-upload-row">
            <div className="photo-preview">
              {form.photo ? (
                <img src={form.photo} alt="Player preview" />
              ) : (
                <span>{editingPlayer ? initials(editingPlayer) : "＋"}</span>
              )}
            </div>

            <div>
              <label className="field-label" htmlFor="player-photo">
                Player photo <span className="muted-inline">(optional)</span>
              </label>

              <input
                id="player-photo"
                type="file"
                accept="image/*"
                onChange={handlePhoto}
              />

              <small>
                Image is resized before saving. Maximum upload size: 8 MB.
              </small>

              {form.photo && (
                <button
                  className="text-button"
                  type="button"
                  onClick={() =>
                    setForm((f) => ({ ...f, photo: "" }))
                  }
                >
                  Remove photo
                </button>
              )}
            </div>
          </div>

          <div className="player-form-grid">
            <label>
              First name *
              <input
                value={form.firstName}
                onChange={(e) =>
                  setForm({ ...form, firstName: e.target.value })
                }
                required
                maxLength="80"
              />
            </label>

            <label>
              Last name *
              <input
                value={form.lastName}
                onChange={(e) =>
                  setForm({ ...form, lastName: e.target.value })
                }
                required
                maxLength="80"
              />
            </label>

            <label>
              Age *
              <input
                type="number"
                min="5"
                max="100"
                value={form.age}
                onChange={(e) =>
                  setForm({ ...form, age: e.target.value })
                }
                required
              />
            </label>

            <div className="sport-picker">
              <span>
                Sports *{" "}
                <span className="muted-inline">
                  (choose one or more)
                </span>
              </span>

              <div className="sport-picker-chips">
                {[
                  ...SPORTS,
                  ...form.sports.filter((s) => !SPORTS.includes(s)),
                ].map((sport) => {
                  const on = form.sports.includes(sport);

                  return (
                    <button
                      type="button"
                      key={sport}
                      className={`sport-chip ${on ? "on" : ""}`}
                      aria-pressed={on}
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          sports: on
                            ? f.sports.filter((s) => s !== sport)
                            : [...f.sports, sport],
                        }))
                      }
                    >
                      {on ? "✓ " : ""}
                      {sport}
                    </button>
                  );
                })}
              </div>
            </div>

            <label>
              Phone
              <input
                value={form.phone}
                onChange={(e) =>
                  setForm({ ...form, phone: e.target.value })
                }
                maxLength="30"
              />
            </label>

            <label>
              Email
              <input
                type="email"
                value={form.email}
                onChange={(e) =>
                  setForm({ ...form, email: e.target.value })
                }
                maxLength="160"
              />
            </label>

            <label>
              Position
              <input
                value={form.position}
                onChange={(e) =>
                  setForm({ ...form, position: e.target.value })
                }
                maxLength="80"
              />
            </label>

            {editingPlayer && (
              <label>
                Status
                <select
                  value={form.status || editingPlayer.status || "Active"}
                  onChange={(e) =>
                    setForm({ ...form, status: e.target.value })
                  }
                >
                  <option>Active</option>
                  <option>Inactive</option>
                </select>
              </label>
            )}
          </div>

          {formError && <p className="form-error">{formError}</p>}

          <div className="player-form-actions">
            <button className="primary-button" disabled={saving}>
              {saving
                ? "Saving..."
                : editingPlayer
                ? "Save Changes"
                : "Register Player"}
            </button>

            <button
              className="secondary-button"
              type="button"
              onClick={() => setShowForm(false)}
            >
              Cancel
            </button>
          </div>
        </form>
      </section>
    );
  }

  // Player profile
  function renderPlayerProfile() {
    if (!selectedPlayer) return null;

    const p = selectedPlayer;

    return (
      <section className="profile-page">
        <button
          className="back-button"
          onClick={() => setSelectedPlayer(null)}
        >
          ← Back to Players
        </button>

        <div className="panel profile-hero">
          <Avatar player={p} large />

          <div className="profile-main">
            <span
              className={`status-pill ${
                (p.status || "Active") === "Active"
                  ? "status-active"
                  : "status-inactive"
              }`}
            >
              {p.status || "Active"}
            </span>

            <h1>{fullName(p)}</h1>

            <p>
              {p.playerId ? `${p.playerId} · ` : ""}
              {sportsOf(p).join(", ")}
              {p.position ? ` · ${p.position}` : ""} · Age {p.age}
            </p>
          </div>

          <button
            className="primary-button"
            onClick={() => openEditForm(p)}
          >
            Edit Player
          </button>
        </div>

        {renderPlayerForm()}

        {newPlayerCredentials && (
          <LoginCredentialsPanel
            heading={`Player registered — login created for ${newPlayerCredentials.playerName}`}
            roleLabel="player"
            credentials={newPlayerCredentials}
            onClose={() => setNewPlayerCredentials(null)}
          />
        )}

        <PlayerAccountPanel key={`${p._id}-${p.status}`} player={p} />

        <div className="profile-info-grid">
          <article className="panel">
            <h2>Personal Information</h2>

            <dl className="info-list">
              <div><dt>Phone</dt><dd>{p.phone || "Not provided"}</dd></div>
              <div><dt>Email</dt><dd>{p.email || "Not provided"}</dd></div>
              <div><dt>Player ID</dt><dd>{p.playerId || "—"}</dd></div>
              <div><dt>Sports</dt><dd>{sportsOf(p).join(", ") || "—"}</dd></div>
              <div><dt>Position</dt><dd>{p.position || "Not specified"}</dd></div>
              <div><dt>Age</dt><dd>{p.age}</dd></div>
              <div><dt>Status reason</dt><dd>{p.statusReason || "—"}</dd></div>
            </dl>

            {(p.status || "Active") === "Active" && (
              <button
                className="danger-button"
                onClick={() => deactivatePlayer(p)}
              >
                Deactivate player
              </button>
            )}
          </article>

          <article className="panel">
            <h2>Player Notes</h2>

            <form className="stack-form" onSubmit={addNote}>
              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Add a training, performance or conduct note..."
                rows="3"
                maxLength="2000"
                required
              />

              <button className="primary-button">Add Note</button>
            </form>

            <div className="record-list">
              {(p.notes || []).length ? (
                [...p.notes].reverse().map((note) => (
                  <div
                    className="record-item"
                    key={note._id || note.createdAt}
                  >
                    <p>{note.text}</p>
                    <small>
                      {note.createdAt
                        ? new Date(note.createdAt).toLocaleString("en-IN")
                        : "Recently added"}
                    </small>
                  </div>
                ))
              ) : (
                <p className="muted-text">No notes added yet.</p>
              )}
            </div>
          </article>

          <article className="panel achievements-panel">
            <h2>Achievements</h2>

            <form className="stack-form" onSubmit={addAchievement}>
              <input
                placeholder="Achievement title"
                value={achievement.title}
                onChange={(e) =>
                  setAchievement({
                    ...achievement,
                    title: e.target.value,
                  })
                }
                required
                maxLength="120"
              />

              <textarea
                placeholder="Description (optional)"
                rows="2"
                value={achievement.description}
                onChange={(e) =>
                  setAchievement({
                    ...achievement,
                    description: e.target.value,
                  })
                }
                maxLength="1000"
              />

              <label>
                Achievement date
                <CalendarDatePicker
                  value={achievement.date}
                  onChange={(date) =>
                    setAchievement((current) => ({
                      ...current,
                      date,
                    }))
                  }
                />
              </label>

              <button className="primary-button">
                Add Achievement
              </button>
            </form>

            <div className="record-list">
              {(p.achievements || []).length ? (
                [...p.achievements].reverse().map((item) => (
                  <div
                    className="record-item"
                    key={item._id || item.createdAt}
                  >
                    <strong>🏆 {item.title}</strong>

                    {item.description && <p>{item.description}</p>}

                    <small>
                      {item.date
                        ? new Date(item.date).toLocaleDateString("en-IN")
                        : "Date not specified"}
                    </small>
                  </div>
                ))
              ) : (
                <p className="muted-text">
                  No achievements recorded yet.
                </p>
              )}
            </div>
          </article>

          <PlayerAttendanceCard playerId={p._id} />
        </div>

        {detailError && <p className="form-error">{detailError}</p>}
      </section>
    );
  }

  // Dashboard
  function renderDashboard() {
    const upcomingMatches = getUpcomingMatches(matches);
    const todaySession = attSummary?.today;

    const todayAttended = todaySession
      ? todaySession.counts.Present + todaySession.counts.Late
      : 0;

    const nextMatch = upcomingMatches[0];

    return (
      <>
        <PageHeading
          eyebrow="ACADEMY OVERVIEW"
          title={`Good morning, ${currentUser?.username || "Admin"} ✦`}
          description="Here's what's happening at your academy today."
          action={
            <button
              className="primary-button"
              onClick={() => {
                navigate("players");
                openAddForm();
              }}
            >
              ＋ Add New Player
            </button>
          }
        />

        <section className="hero-banner">
          <div className="hero-content">
            <span className="hero-kicker">SPORTSYNC ACADEMY</span>
            <h2>
              Build champions.
              <br />
              Shape the future.
            </h2>
            <p>One academy. Every sport. Endless possibilities.</p>
          </div>
          <div className="hero-image-overlay" />
          <div className="hero-image-label">PERFORMANCE STARTS HERE</div>
        </section>

        <section className="stats-grid">
          <article className="stat-card">
            <div className="stat-top">
              <span className="stat-label">Total Players</span>
              <div className="stat-icon">👥</div>
            </div>
            <div className="stat-value">
              {loading ? "..." : players.length}
            </div>
            <div className="stat-change">
              {players.length - activePlayers.length} inactive, records retained
            </div>
          </article>

          <article className="stat-card">
            <div className="stat-top">
              <span className="stat-label">Active Players</span>
              <div className="stat-icon">✓</div>
            </div>
            <div className="stat-value">{activePlayers.length}</div>
            <div className="stat-change">
              {new Set(activePlayers.flatMap(sportsOf)).size} sports represented
            </div>
          </article>

          <article className="stat-card">
            <div className="stat-top">
              <span className="stat-label">Today's Attendance</span>
              <div className="stat-icon">☑</div>
            </div>
            <div className="stat-value">
              {!attSummary
                ? "..."
                : todaySession
                ? `${todayAttended}/${attSummary.activePlayers}`
                : "—"}
            </div>
            <div className="stat-change">
              {!attSummary
                ? attError || "Loading..."
                : !todaySession
                ? "Session not started"
                : todaySession.status === "Open"
                ? "Session in progress"
                : "Session closed"}
            </div>
          </article>

          <article className="stat-card">
            <div className="stat-top">
              <span className="stat-label">Upcoming Matches</span>
              <div className="stat-icon">⚑</div>
            </div>
            <div className="stat-value">{upcomingMatches.length}</div>
            <div className="stat-change">
              {nextMatch
                ? `Next: ${new Date(
                    `${nextMatch.date.slice(0, 10)}T12:00:00`
                  ).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                  })} · ${nextMatch.sport}`
                : "Nothing scheduled"}
            </div>
          </article>
        </section>

        <div className="dash-grid">
          <AttendanceSnapshot
            summary={attSummary}
            error={attError}
            onOpen={() => navigate("attendance")}
          />

          <UpcomingMatches
            matches={matches}
            onOpen={() => navigate("matches")}
          />
        </div>

        <div className="dash-grid">
          <ActivityFeed
            players={players}
            matches={matches}
            sessions={attSummary?.recent}
          />

          <section className="panel recent-players">
            <div className="section-heading">
              <div>
                <h2>Recent Players</h2>
                <p>Latest registered academy players</p>
              </div>

              <button
                className="text-button"
                onClick={() => navigate("players")}
              >
                View all ↗
              </button>
            </div>

            {loading ? (
              <p>Loading players...</p>
            ) : loadError ? (
              <p>{loadError}</p>
            ) : players.length === 0 ? (
              <p>No players registered yet.</p>
            ) : (
              <div className="players-list">
                {players.slice(0, 5).map((p) => (
                  <button
                    className="player-row player-row-button"
                    key={p._id}
                    onClick={() => {
                      setSelectedPlayer(p);
                      setActivePage("players");
                    }}
                  >
                    <Avatar player={p} />

                    <div className="player-info">
                      <strong>{fullName(p)}</strong>
                      <span>
                        {sportsOf(p).join(", ")} · Age {p.age}
                      </span>
                    </div>

                    <span className="player-position">
                      {p.status || "Active"}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>
      </>
    );
  }

  // Players directory
  function renderPlayers() {
    if (selectedPlayer) return renderPlayerProfile();

    return (
      <>
        <PageHeading
          eyebrow="PLAYER MANAGEMENT"
          title="Players"
          description="Manage your academy's player directory and registrations."
          action={
            <button className="primary-button" onClick={openAddForm}>
              ＋ Add New Player
            </button>
          }
        />

        {newPlayerCredentials && (
          <LoginCredentialsPanel
            heading={`Player registered — login created for ${newPlayerCredentials.playerName}`}
            roleLabel="player"
            credentials={newPlayerCredentials}
            onClose={() => setNewPlayerCredentials(null)}
          />
        )}

        {renderPlayerForm()}

        <section className="panel page-panel">
          <div className="section-heading">
            <div>
              <h2>Player Directory</h2>
              <p>Open a player to view their full profile</p>
            </div>

            <span>{players.length} Total Records</span>
          </div>

          <div className="directory-controls">
            <input
              placeholder="Search by name, ID, phone, sport or position..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option>Active</option>
              <option>Inactive</option>
              <option>All</option>
            </select>
          </div>

          {loading ? (
            <p>Loading players...</p>
          ) : loadError ? (
            <div>
              <p>{loadError}</p>
              <button className="secondary-button" onClick={fetchPlayers}>
                Try again
              </button>
            </div>
          ) : filteredPlayers.length === 0 ? (
            <div className="empty-state">
              <h3>No matching players</h3>
              <p>Try another filter or register a player.</p>
            </div>
          ) : (
            <div className="players-list">
              {filteredPlayers.map((p) => (
                <div className="player-row directory-row" key={p._id}>
                  <button
                    className="player-open"
                    onClick={() => {
                      setSelectedPlayer(p);
                      setShowForm(false);
                    }}
                  >
                    <Avatar player={p} />

                    <span className="player-info">
                      <strong>{fullName(p)}</strong>

                      {achievementTitles(p).length > 0 && (
                        <span className="player-achievement-titles">
                          🏆 {achievementTitles(p).join(" · ")}
                        </span>
                      )}

                      <span>
                        {p.playerId ? `${p.playerId} · ` : ""}
                        {sportsOf(p).join(", ")} · Age {p.age}
                      </span>
                    </span>
                  </button>

                  <span
                    className={`status-pill ${
                      (p.status || "Active") === "Active"
                        ? "status-active"
                        : "status-inactive"
                    }`}
                  >
                    {p.status || "Active"}
                  </span>

                  <div className="row-actions">
                    <button
                      className="secondary-button compact"
                      onClick={() => openEditForm(p)}
                    >
                      Edit
                    </button>

                    {(p.status || "Active") === "Active" && (
                      <button
                        className="danger-button compact"
                        onClick={() => deactivatePlayer(p)}
                      >
                        Deactivate
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </>
    );
  }

  // Sport-specific Games page
  function renderGames() {
    const sportPlayers = activePlayers.filter((player) =>
      sportsOf(player).some(
        (sport) => sport.toLowerCase() === selectedSport.toLowerCase()
      )
    );

    const sportMatches = matches.filter(
      (match) => match.sport?.toLowerCase() === selectedSport.toLowerCase()
    );

    return (
      <>
        <PageHeading
          eyebrow="SPORTS CENTRE"
          title={selectedSport}
          description={`Players, fixtures and results for ${selectedSport.toLowerCase()}.`}
          action={
            <button
              className="primary-button"
              onClick={() => {
                setMatchIntent({
                  sport: selectedSport,
                  openForm: true,
                });
                setActivePage("matches");
              }}
            >
              ＋ Add Match
            </button>
          }
        />

        <section className="panel sport-tabs-panel">
          <div className="sport-tabs">
            {SPORTS.filter((sport) => sport !== "Other").map((sport) => (
              <button
                key={sport}
                className={`sport-tab ${
                  selectedSport === sport ? "active" : ""
                }`}
                onClick={() => setSelectedSport(sport)}
              >
                {sport}
              </button>
            ))}

            <button
              className={`sport-tab ${
                selectedSport === "Other" ? "active" : ""
              }`}
              onClick={() => setSelectedSport("Other")}
            >
              Other
            </button>
          </div>
        </section>

        <section className="stats-grid sport-stats">
          <article className="stat-card">
            <div className="stat-label">Active players</div>
            <div className="stat-value">{sportPlayers.length}</div>
            <div className="stat-change">Registered in {selectedSport}</div>
          </article>

          <article className="stat-card">
            <div className="stat-label">Upcoming matches</div>
            <div className="stat-value">
              {sportMatches.filter((m) => m.status === "Upcoming").length}
            </div>
            <div className="stat-change">Scheduled fixtures</div>
          </article>

          <article className="stat-card">
            <div className="stat-label">Completed matches</div>
            <div className="stat-value">
              {sportMatches.filter((m) => m.status === "Completed").length}
            </div>
            <div className="stat-change">Results recorded</div>
          </article>
        </section>

        <div className="games-content-grid">
          <section className="panel page-panel">
            <div className="section-heading">
              <div>
                <h2>{selectedSport} Players</h2>
                <p>Active athletes registered for this sport</p>
              </div>

              <button
                className="text-button"
                onClick={() => navigate("players")}
              >
                All players ↗
              </button>
            </div>

            {sportPlayers.length ? (
              <div className="players-list">
                {sportPlayers.map((player) => (
                  <button
                    className="player-row player-row-button"
                    key={player._id}
                    onClick={() => {
                      setSelectedPlayer(player);
                      setActivePage("players");
                    }}
                  >
                    <Avatar player={player} />

                    <span className="player-info">
                      <strong>{fullName(player)}</strong>
                      <span>
                        {player.position || "Player"} · Age {player.age}
                      </span>
                    </span>

                    <span className="player-position">View profile ↗</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <h3>No active {selectedSport.toLowerCase()} players yet</h3>
                <p>
                  Players assigned to {selectedSport} will appear here.
                </p>

                <button
                  className="secondary-button"
                  onClick={() => {
                    navigate("players");
                    openAddForm();
                  }}
                >
                  ＋ Register player
                </button>
              </div>
            )}
          </section>

          <section className="panel page-panel">
            <div className="section-heading">
              <div>
                <h2>{selectedSport} Matches</h2>
                <p>Upcoming fixtures and recorded results</p>
              </div>

              <button
                className="text-button"
                onClick={() => {
                  setMatchIntent({ sport: selectedSport });
                  setActivePage("matches");
                }}
              >
                View all ↗
              </button>
            </div>

            {sportMatches.length ? (
              <div className="match-list">
                {sportMatches.map((match) => (
                  <article
                    className="match-item match-item-clickable"
                    key={match._id}
                    onClick={() => {
                      setMatchIntent({ openMatchId: match._id });
                      setActivePage("matches");
                    }}
                  >
                    <div className="match-item-top">
                      <strong>{match.title}</strong>
                      <span
                        className={`status-pill ${
                          match.status === "Completed" ? "status-active" : ""
                        }`}
                      >
                        {match.status}
                      </span>
                    </div>

                    <p>
                      {match.opponent ? `vs ${match.opponent} · ` : ""}
                      {match.venue || "Venue TBC"}
                    </p>

                    <small>
                      {match.date
                        ? new Date(
                            `${match.date.slice(0, 10)}T12:00:00`
                          ).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })
                        : "Date TBC"}
                    </small>

                    {match.result && (
                      <p className="match-result">
                        Result: {match.result}
                      </p>
                    )}
                  </article>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <p>No matches scheduled for this sport.</p>

                <button
                  className="secondary-button"
                  onClick={() => {
                    setMatchIntent({
                      sport: selectedSport,
                      openForm: true,
                    });
                    setActivePage("matches");
                  }}
                >
                  ＋ Schedule match
                </button>
              </div>
            )}
          </section>
        </div>
      </>
    );
  }

  // Authentication loading screen
  if (authChecking) {
    return (
      <div className="auth-loading">
        <h2>SPORTSYNC</h2>
        <p>Loading your academy workspace...</p>
      </div>
    );
  }

  // Show login page when no user is authenticated
  if (!currentUser) {
    return <LoginPage onLogin={handleLogin} />;
  }

  // Force a new password before any other screen is available
  if (currentUser.mustChangePassword) {
    return (
      <ChangePasswordPage
        username={currentUser.username}
        onChanged={handlePasswordChanged}
        onLogout={handleLogout}
      />
    );
  }

  // Scouts get a read-only view of Ready players
  if (currentUser.role === "scout") {
    return <ScoutWorkspace user={currentUser} onLogout={handleLogout} />;
  }

  // Coaches work with their assigned sports only
  if (currentUser.role === "coach") {
    return <CoachWorkspace user={currentUser} onLogout={handleLogout} />;
  }

  // Players see their own profile, attendance and matches
  if (currentUser.role === "player") {
    return <PlayerWorkspace user={currentUser} onLogout={handleLogout} />;
  }

  // Other roles will receive their own dashboards in later stages
  if (currentUser.role !== "admin") {
    return (
      <div className="auth-loading">
        <h2>Welcome to SportSync</h2>

        <p>
          Your {currentUser.role} workspace is being prepared.
        </p>

        <button className="primary-button" onClick={handleLogout}>
          Logout
        </button>
      </div>
    );
  }

  const title = pageTitles[activePage] || "Dashboard";

  // Main Admin application
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
            <span>ACADEMY MANAGER</span>
          </div>
        </div>

        <div className="menu-label">WORKSPACE</div>

        <nav className="navigation">
          {NAV.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`nav-item ${
                activePage === item.id ? "active" : ""
              }`}
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
          <div className="help-card">
            <div className="help-icon">✦</div>
            <strong>Need some help?</strong>
            <p>Manage your academy with ease.</p>

            <button
              onClick={() =>
                window.alert("Help center will be available soon.")
              }
            >
              Visit Help Center ↗
            </button>
          </div>

          <div className="profile">
            <div className="avatar">
              {currentUser.username?.slice(0, 2).toUpperCase() || "AD"}
            </div>

            <div className="profile-info">
              <strong>{currentUser.username}</strong>
              <span>{currentUser.role.toUpperCase()}</span>
            </div>
          </div>

          <button
            type="button"
            className="drawer-logout"
            onClick={handleLogout}
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
            <strong>
              {selectedPlayer ? fullName(selectedPlayer) : title}
            </strong>
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

            <button
              className="icon-button"
              aria-label="Notifications"
              onClick={() => window.alert("You're all caught up!")}
            >
              ♧<i />
            </button>

            <div className="top-avatar">
              {currentUser.username?.slice(0, 2).toUpperCase() || "AD"}
            </div>

            <button
              className="secondary-button compact"
              onClick={handleLogout}
            >
              Logout
            </button>
          </div>
        </header>

        <div className="page-content">
          {activePage === "dashboard"
            ? renderDashboard()
            : activePage === "players"
            ? renderPlayers()
            : activePage === "coaches"
            ? <CoachesPage />
            : activePage === "scouts"
            ? <ScoutsPage />
            : activePage === "games"
            ? renderGames()
            : activePage === "matches"
            ? (
                <MatchesPage
                  key={JSON.stringify(matchIntent)}
                  matches={matches}
                  loading={matchesLoading}
                  error={matchesError}
                  players={players}
                  reload={fetchMatches}
                  intent={matchIntent}
                />
              )
            : activePage === "attendance"
            ? <AttendancePage />
            : activePage === "trials"
            ? <TrialReadinessPage role="admin" />
            : null}

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

export default App;
