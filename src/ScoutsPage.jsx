
import { useEffect, useMemo, useState } from "react";
import CalendarDatePicker from "./CalendarDatePicker.jsx";
import "./CoachesPage.css";

const API_URL = "/api/scouts";

// Parse a response as JSON; give a clear message if the server sent HTML instead.
async function readJson(response) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    throw new Error(
      `Server returned an unexpected response (HTTP ${response.status}). Make sure the backend is running the latest code and restart it.`
    );
  }
}


const EMPTY_FORM = {
  name: "",
  phone: "",
  email: "",
  photo: "",
  designation: "Scout",
  organization: "",
  experience: "",
  joiningDate: "",
  notes: "",
};

function formatDate(value) {
  if (!value) return "Not specified";

  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getInitials(name = "") {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "SC";
}

export default function ScoutsPage() {
  const [scouts, setScouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");

  const [showForm, setShowForm] = useState(false);
  const [editingScout, setEditingScout] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const [credentials, setCredentials] = useState(null);
  const [copied, setCopied] = useState(false);

  async function fetchScouts() {
    try {
      setLoading(true);
      setLoadError("");

      const response = await fetch(API_URL, {
        credentials: "include",
      });

      const data = await readJson(response);

      if (!response.ok) {
        throw new Error(data.message || "Unable to load scouts.");
      }

      setScouts(Array.isArray(data) ? data : []);
    } catch (error) {
      setLoadError(error.message || "Unable to load scouts.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchScouts();
  }, []);

  const activeCount = scouts.filter(
    (scout) => scout.status === "Active"
  ).length;

  const inactiveCount = scouts.length - activeCount;

  const filteredScouts = useMemo(() => {
    const term = search.trim().toLowerCase();

    return scouts.filter((scout) => {
      const matchesStatus =
        filter === "All" || scout.status === filter;

      const searchableText = [
        scout.name,
        scout.email,
        scout.phone,
        scout.designation,
        scout.organization,
      ]
        .join(" ")
        .toLowerCase();

      return matchesStatus && searchableText.includes(term);
    });
  }, [scouts, search, filter]);

  function openAddForm() {
    setEditingScout(null);
    setForm({ ...EMPTY_FORM });
    setFormError("");
    setShowForm(true);
    setCredentials(null);
  }

  function openEditForm(scout) {
    setEditingScout(scout);

    setForm({
      name: scout.name || "",
      phone: scout.phone || "",
      email: scout.email || "",
      photo: scout.photo || "",
      designation: scout.designation || "Scout",
      organization: scout.organization || "",
      experience: String(scout.experience ?? ""),
      joiningDate: scout.joiningDate
        ? String(scout.joiningDate).slice(0, 10)
        : "",
      notes: scout.notes || "",
    });

    setFormError("");
    setShowForm(true);
    setCredentials(null);
  }

  function updateField(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function handlePhoto(event) {
    const file = event.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setFormError("Please select a valid image.");
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

      updateField("photo", canvas.toDataURL("image/jpeg", 0.78));
      setFormError("");
    } catch {
      setFormError("Could not process this image.");
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError("");

    if (!form.joiningDate) {
      setFormError("Please select the joining date.");
      return;
    }

    const experience = Number(form.experience);

    if (
      form.experience === "" ||
      !Number.isFinite(experience) ||
      experience < 0
    ) {
      setFormError("Enter a valid experience value.");
      return;
    }

    setSaving(true);

    const payload = {
      ...form,
      experience,
    };

    try {
      const response = await fetch(
        editingScout
          ? `${API_URL}/${editingScout._id}`
          : API_URL,
        {
          method: editingScout ? "PATCH" : "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      const result = await readJson(response);

      if (!response.ok) {
        throw new Error(result.message || "Could not save scout.");
      }

      if (editingScout) {
        setShowForm(false);
        setEditingScout(null);
      } else {
        setShowForm(false);

        // Credentials are displayed only after successful creation.
        setCredentials(result.credentials);
      }

      await fetchScouts();
    } catch (error) {
      setFormError(error.message || "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(scout) {
    const nextStatus =
      scout.status === "Active" ? "Inactive" : "Active";

    const confirmed = window.confirm(
      `${nextStatus === "Inactive" ? "Deactivate" : "Activate"} ${scout.name}'s scout account?`
    );

    if (!confirmed) return;

    try {
      const response = await fetch(
        `${API_URL}/${scout._id}/status`,
        {
          method: "PATCH",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ status: nextStatus }),
        }
      );

      const result = await readJson(response);

      if (!response.ok) {
        throw new Error(result.message || "Could not update status.");
      }

      await fetchScouts();
    } catch (error) {
      window.alert(error.message);
    }
  }

  async function copyCredentials() {
    if (!credentials) return;

    const text = [
      `Username: ${credentials.username}`,
      `Temporary password: ${credentials.temporaryPassword}`,
    ].join("\n");

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      window.alert("Clipboard access was unavailable. Copy the credentials manually.");
    }
  }

  return (
    <div className="coaches-page scouts-page">
      <section className="welcome-row">
        <div>
          <div className="eyebrow">
            <span className="live-dot" /> STAFF MANAGEMENT
          </div>
          <h1>Scouts</h1>
          <p>
            Manage scouts and their login accounts. Scouts get read-only
            access to Ready players only.
          </p>
        </div>

        <button
          className="primary-button"
          onClick={openAddForm}
        >
          ＋ Add New Scout
        </button>
      </section>

      <section className="coach-stats">
        <article className="stat-card">
          <span className="stat-label">Total Scouts</span>
          <strong className="stat-value">{scouts.length}</strong>
          <span className="stat-change">Registered staff</span>
        </article>

        <article className="stat-card">
          <span className="stat-label">Active Scouts</span>
          <strong className="stat-value">{activeCount}</strong>
          <span className="stat-change">Can access their accounts</span>
        </article>

        <article className="stat-card">
          <span className="stat-label">Inactive Scouts</span>
          <strong className="stat-value">{inactiveCount}</strong>
          <span className="stat-change">Login access disabled</span>
        </article>
      </section>

      {credentials && (
        <section className="coach-credentials">
          <div className="credentials-heading">
            <div>
              <span className="credentials-icon">✓</span>
              <h2>Scout account created successfully</h2>
            </div>

            <button
              className="secondary-button compact"
              onClick={() => {
                setCredentials(null);
                setCopied(false);
              }}
            >
              Close
            </button>
          </div>

          <p>
            Share these login details securely with the scout.
            The temporary password will not be shown again after closing.
          </p>

          <div className="credentials-grid">
            <div>
              <span>Username</span>
              <strong>{credentials.username}</strong>
            </div>

            <div>
              <span>Temporary Password</span>
              <strong className="temporary-password">
                {credentials.temporaryPassword}
              </strong>
            </div>
          </div>

          <div className="credentials-footer">
            <span>
              The scout must change this password after their first login.
            </span>

            <button
              className="primary-button"
              onClick={copyCredentials}
            >
              {copied ? "✓ Copied" : "Copy Login Details"}
            </button>
          </div>
        </section>
      )}

      {showForm && (
        <section className="panel coach-form-panel">
          <div className="section-heading">
            <div>
              <h2>
                {editingScout ? "Edit Scout Details" : "Add New Scout"}
              </h2>
              <p>
                {editingScout
                  ? "Update the scout's profile and assignments."
                  : "A login account will be created automatically."}
              </p>
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
            <div className="coach-photo-row">
              <div className="coach-photo-preview">
                {form.photo ? (
                  <img src={form.photo} alt="Scout preview" />
                ) : (
                  <span>{getInitials(form.name)}</span>
                )}
              </div>

              <div>
                <label className="field-label" htmlFor="coach-photo">
                  Scout photo
                </label>

                <input
                  id="coach-photo"
                  type="file"
                  accept="image/*"
                  onChange={handlePhoto}
                />

                <small>Optional · Maximum 8 MB</small>

                {form.photo && (
                  <button
                    className="text-button"
                    type="button"
                    onClick={() => updateField("photo", "")}
                  >
                    Remove photo
                  </button>
                )}
              </div>
            </div>

            <div className="coach-form-grid">
              <label>
                Full Name *
                <input
                  value={form.name}
                  onChange={(e) => updateField("name", e.target.value)}
                  placeholder="Enter scout's full name"
                  maxLength={200}
                  required
                />
              </label>

              <label>
                Phone Number *
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => updateField("phone", e.target.value)}
                  placeholder="Enter phone number"
                  maxLength={30}
                  required
                />
              </label>

              <label>
                Email Address *
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => updateField("email", e.target.value)}
                  placeholder="scout@example.com"
                  maxLength={150}
                  required
                  disabled={Boolean(editingScout)}
                />
                {editingScout && (
                  <small>Email is used as the login username.</small>
                )}
              </label>

              <label>
                Designation
                <input
                  value={form.designation}
                  onChange={(e) => updateField("designation", e.target.value)}
                  placeholder="e.g. Head Scout"
                  maxLength={100}
                />
              </label>

              <label>
                Organization / Club
                <input
                  value={form.organization}
                  onChange={(e) => updateField("organization", e.target.value)}
                  placeholder="e.g. City FC Talent Team"
                  maxLength={200}
                />
              </label>

              <label>
                Experience (Years) *
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={form.experience}
                  onChange={(e) => updateField("experience", e.target.value)}
                  placeholder="e.g. 2.5"
                  required
                />
                <small>Decimal values are allowed, e.g. 2.5 years.</small>
              </label>

              <label>
                Joining Date *
                <CalendarDatePicker
                  value={form.joiningDate}
                  onChange={(value) => updateField("joiningDate", value)}
                  placeholder="Select joining date"
                />
              </label>

              <label className="coach-notes-field">
                Internal Notes
                <textarea
                  rows="3"
                  value={form.notes}
                  onChange={(e) => updateField("notes", e.target.value)}
                  placeholder="Additional information about this scout..."
                  maxLength={2000}
                />
              </label>
            </div>

            {formError && (
              <div className="coach-form-error">{formError}</div>
            )}

            <div className="coach-form-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setShowForm(false)}
                disabled={saving}
              >
                Cancel
              </button>

              <button
                type="submit"
                className="primary-button"
                disabled={saving}
              >
                {saving
                  ? "Saving..."
                  : editingScout
                  ? "Save Changes"
                  : "Create Scout & Login"}
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="panel coach-directory">
        <div className="section-heading">
          <div>
            <h2>Scout Directory</h2>
            <p>View and manage registered scouts.</p>
          </div>

          <span>{filteredScouts.length} Records</span>
        </div>

        <div className="coach-directory-controls">
          <input
            type="search"
            placeholder="Search name, email, phone or organization..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="All">All Scouts</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
        </div>

        {loading ? (
          <p className="coach-empty-message">Loading scouts...</p>
        ) : loadError ? (
          <div className="coach-empty-message">
            <p>{loadError}</p>
            <button className="secondary-button" onClick={fetchScouts}>
              Try Again
            </button>
          </div>
        ) : filteredScouts.length === 0 ? (
          <div className="coach-empty-message">
            <h3>No scouts found</h3>
            <p>
              {scouts.length === 0
                ? "Add your first scout to get started."
                : "Try changing your search or status filter."}
            </p>
          </div>
        ) : (
          <div className="coach-list">
            {filteredScouts.map((scout) => (
              <article className="coach-row" key={scout._id}>
                <div className="coach-avatar">
                  {scout.photo ? (
                    <img src={scout.photo} alt={scout.name} />
                  ) : (
                    <span>{getInitials(scout.name)}</span>
                  )}
                </div>

                <div className="coach-main-info">
                  <div className="coach-name-line">
                    <h3>{scout.name}</h3>

                    <span
                      className={`status-pill ${
                        scout.status === "Active"
                          ? "status-active"
                          : "status-inactive"
                      }`}
                    >
                      {scout.status}
                    </span>
                  </div>

                  <p>{scout.designation || "Scout"}</p>

                  <div className="coach-contact-info">
                    <span>{scout.email}</span>
                    <span>{scout.phone}</span>
                  </div>

                  <div className="coach-meta">
                    <span>
                      {scout.organization || "No organization specified"}
                    </span>
                    <span>
                      {Number(scout.experience || 0)} years experience
                    </span>
                    <span>
                      Joined {formatDate(scout.joiningDate)}
                    </span>
                  </div>

                  <div className="coach-account-info">
                    Login: {scout.user?.username || scout.email}
                    {" · "}
                    {scout.user?.isActive ? "Account enabled" : "Account disabled"}
                  </div>
                </div>

                <div className="coach-row-actions">
                  <button
                    className="secondary-button compact"
                    onClick={() => openEditForm(scout)}
                  >
                    Edit
                  </button>

                  <button
                    className={
                      scout.status === "Active"
                        ? "danger-button compact"
                        : "primary-button compact"
                    }
                    onClick={() => changeStatus(scout)}
                  >
                    {scout.status === "Active" ? "Deactivate" : "Activate"}
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
