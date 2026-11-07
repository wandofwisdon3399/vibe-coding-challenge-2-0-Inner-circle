
import express from "express";
import mongoose from "mongoose";
import Player from "../models/Player.js";
import AttendanceSession from "../models/AttendanceSession.js";
import Attendance from "../models/Attendance.js";
import { authenticate, authorizeRoles } from "../middleware/auth.js";

const router = express.Router();

const STATUSES = ["Present", "Absent", "Late", "Excused"];
const validId = (id) => mongoose.isValidObjectId(id);
const clean = (value, max = 120) => String(value ?? "").trim().slice(0, max);
const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

router.use(authenticate);

// Attendance management is for Admin and Coach only.
// Scouts have no access; Players may only read their own history.
router.use((req, res, next) => {
  const { role } = req.user;

  if (role === "admin" || role === "coach") return next();

  if (
    role === "player" &&
    req.method === "GET" &&
    /^\/player\/[^/]+\/?$/.test(req.path)
  ) {
    return next();
  }

  return res.status(403).json({
    message: "You do not have permission to access attendance records.",
  });
});

const isAdmin = (req) => req.user.role === "admin";
const isCoach = (req) => req.user.role === "coach";
const isPlayer = (req) => req.user.role === "player";

const assignedSports = (req) =>
  (req.user.assignedSports || []).map((s) => String(s).toLowerCase());

function playerSportQuery(req) {
  if (isAdmin(req)) return {};

  const sports = assignedSports(req);
  return {
    $or: [
      { sports: { $in: sports.map((s) => new RegExp(`^${escapeRegex(s)}$`, "i")) } },
      { sport: { $in: sports.map((s) => new RegExp(`^${escapeRegex(s)}$`, "i")) } },
    ],
  };
}

function playerMatchesSports(player, req) {
  if (isAdmin(req)) return true;

  const allowed = assignedSports(req);
  const playerSports = player.sports?.length ? player.sports : player.sport ? [player.sport] : [];

  return playerSports.some((sport) => allowed.includes(String(sport).toLowerCase()));
}

function displayName(req) {
  return req.user.username || "Account";
}

// Today's date as YYYY-MM-DD in Indian time.
function todayString() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

const fullSort = (p) =>
  `${p.firstName || ""} ${p.lastName || ""}`.trim().toLowerCase();

const sportsOf = (player) =>
  player.sports?.length ? player.sports : player.sport ? [player.sport] : [];

async function countsFor(sessionId, req = null) {
  const match = { session: sessionId };

  if (req && isCoach(req)) {
    const sports = assignedSports(req);
    match.sports = {
      $in: sports.map((s) => new RegExp(`^${escapeRegex(s)}$`, "i")),
    };
  }

  const rows = await Attendance.aggregate([
    { $match: match },
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ]);

  const counts = { Present: 0, Late: 0, Absent: 0, Excused: 0 };
  for (const row of rows) counts[row._id] = row.count;
  return counts;
}

async function activePlayerCount(req) {
  const query = { status: "Active" };

  if (isCoach(req)) {
    Object.assign(query, playerSportQuery(req));
  }

  return Player.countDocuments(query);
}

async function loadSession(req, res) {
  if (!validId(req.params.id)) {
    res.status(400).json({ message: "Invalid session ID." });
    return null;
  }

  const session = await AttendanceSession.findById(req.params.id);

  if (!session) {
    res.status(404).json({ message: "Session not found." });
    return null;
  }

  return session;
}

function requireOpen(session, res) {
  if (session.status !== "Open") {
    res.status(409).json({
      message: "This session is closed. Ask the admin to reopen it.",
    });
    return false;
  }

  return true;
}

async function loadManageablePlayer(playerId, req, res) {
  if (!validId(playerId)) {
    res.status(400).json({ message: "Invalid player ID." });
    return null;
  }

  const player = await Player.findById(playerId);

  if (!player) {
    res.status(404).json({ message: "Player not found." });
    return null;
  }

  if (!playerMatchesSports(player, req)) {
    res.status(403).json({
      message: "You can only manage attendance for your assigned sports.",
    });
    return null;
  }

  return player;
}

// ---------- Sessions ----------

// Today's session.
router.get("/sessions/today", async (req, res) => {
  try {
    const session = await AttendanceSession.findOne({ date: todayString() });

    if (!session) {
      return res.json({
        date: todayString(),
        session: null,
        counts: null,
        activePlayers: await activePlayerCount(req),
      });
    }

    res.json({
      date: session.date,
      session,
      counts: await countsFor(session._id, req),
      activePlayers: await activePlayerCount(req),
    });
  } catch (error) {
    console.error("Today session error:", error.message);
    res.status(500).json({ message: "Failed to load today's session." });
  }
});

// Recent sessions.
router.get("/sessions", async (_req, res) => {
  try {
    const sessions = await AttendanceSession.find()
      .sort({ date: -1 })
      .limit(60);

    res.json(sessions);
  } catch (error) {
    res.status(500).json({ message: "Failed to load sessions." });
  }
});

// Start today's session: Admin only.
router.post("/sessions/start", authorizeRoles("admin"), async (req, res) => {
  try {
    const date = todayString();
    const existing = await AttendanceSession.findOne({ date });

    if (existing) {
      return res.status(409).json({
        message: "Today's session has already been started.",
        session: existing,
      });
    }

    const session = await AttendanceSession.create({
      date,
      startedBy: displayName(req),
    });

    res.status(201).json(session);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message: "Today's session has already been started.",
      });
    }

    console.error("Start session error:", error.message);
    res.status(500).json({ message: "Failed to start the session." });
  }
});

// One session with its attendance records.
router.get("/sessions/:id", async (req, res) => {
  try {
    const session = await loadSession(req, res);
    if (!session) return;

    const query = { session: session._id };

    if (isCoach(req)) {
      query.sports = {
        $in: assignedSports(req).map(
          (s) => new RegExp(`^${escapeRegex(s)}$`, "i")
        ),
      };
    }

    const records = await Attendance.find(query)
      .populate("player", "playerId firstName lastName photo sports sport status")
      .sort({ markedAt: -1 });

    res.json({
      session,
      counts: await countsFor(session._id, req),
      activePlayers: await activePlayerCount(req),
      records,
    });
  } catch (error) {
    console.error("Load session error:", error.message);
    res.status(500).json({ message: "Failed to load the session." });
  }
});

// ---------- Check-in ----------

// Search active players.
router.get("/search", async (req, res) => {
  try {
    const q = clean(req.query.q, 60);
    if (q.length < 2) return res.json([]);

    const pattern = escapeRegex(q);

    const query = {
      status: "Active",
      $or: [
        { firstName: { $regex: pattern, $options: "i" } },
        { lastName: { $regex: pattern, $options: "i" } },
        { playerId: { $regex: pattern, $options: "i" } },
        {
          $expr: {
            $regexMatch: {
              input: { $concat: ["$firstName", " ", "$lastName"] },
              regex: pattern,
              options: "i",
            },
          },
        },
      ],
    };

    if (isCoach(req)) {
      const sportQuery = playerSportQuery(req);
      query.$and = [{ $or: query.$or }, sportQuery];
      delete query.$or;
    }

    const players = await Player.find(query)
      .select("playerId firstName lastName photo sport sports")
      .sort({ firstName: 1, lastName: 1 })
      .limit(10)
      .lean();

    let statusByPlayer = {};

    if (req.query.session && validId(req.query.session)) {
      const records = await Attendance.find({
        session: req.query.session,
        player: { $in: players.map((p) => p._id) },
      }).lean();

      statusByPlayer = Object.fromEntries(
        records.map((r) => [String(r.player), r.status])
      );
    }

    res.json(
      players.map((p) => ({
        ...p,
        attendanceStatus: statusByPlayer[String(p._id)] || null,
      }))
    );
  } catch (error) {
    console.error("Search error:", error.message);
    res.status(500).json({ message: "Search failed." });
  }
});

// Check in one player.
router.post("/sessions/:id/checkin", authorizeRoles("admin", "coach"), async (req, res) => {
  try {
    const session = await loadSession(req, res);
    if (!session || !requireOpen(session, res)) return;

    const status = req.body?.status || "Present";

    if (!["Present", "Late"].includes(status)) {
      return res.status(400).json({
        message: "Check-in status must be Present or Late.",
      });
    }

    const player = await loadManageablePlayer(req.body?.playerId, req, res);
    if (!player) return;

    if (player.status !== "Active") {
      return res.status(400).json({ message: "This player is inactive." });
    }

    const existing = await Attendance.findOne({
      session: session._id,
      player: player._id,
    });

    const record = await Attendance.findOneAndUpdate(
      { session: session._id, player: player._id },
      {
        $set: {
          date: session.date,
          status,
          sports: sportsOf(player),
          markedAt: new Date(),
          auto: false,
        },
      },
      { returnDocument: "after", upsert: true, runValidators: true }
    );

    res.status(existing ? 200 : 201).json({
      record,
      previousStatus: existing?.status || null,
    });
  } catch (error) {
    console.error("Check-in error:", error.message);
    res.status(500).json({ message: "Failed to check in the player." });
  }
});

// Set any attendance status.
router.patch(
  "/sessions/:id/records/:playerId",
  authorizeRoles("admin", "coach"),
  async (req, res) => {
    try {
      const session = await loadSession(req, res);
      if (!session || !requireOpen(session, res)) return;

      const { status } = req.body || {};

      if (!STATUSES.includes(status)) {
        return res.status(400).json({
          message: `Status must be one of: ${STATUSES.join(", ")}.`,
        });
      }

      const player = await loadManageablePlayer(req.params.playerId, req, res);
      if (!player) return;

      const update = {
        date: session.date,
        status,
        sports: sportsOf(player),
        markedAt: new Date(),
        auto: false,
      };

      if (Object.hasOwn(req.body, "note")) {
        update.note = clean(req.body.note, 300);
      }

      const record = await Attendance.findOneAndUpdate(
        { session: session._id, player: player._id },
        { $set: update },
        { returnDocument: "after", upsert: true, runValidators: true }
      );

      res.json(record);
    } catch (error) {
      console.error("Mark error:", error.message);
      res.status(500).json({ message: "Failed to update the record." });
    }
  }
);

// Undo a check-in.
router.delete(
  "/sessions/:id/records/:playerId",
  authorizeRoles("admin", "coach"),
  async (req, res) => {
    try {
      const session = await loadSession(req, res);
      if (!session || !requireOpen(session, res)) return;

      const player = await loadManageablePlayer(req.params.playerId, req, res);
      if (!player) return;

      await Attendance.deleteOne({
        session: session._id,
        player: player._id,
      });

      res.json({ message: "Check-in removed." });
    } catch (error) {
      res.status(500).json({ message: "Failed to remove the record." });
    }
  }
);

// ---------- Close / Reopen ----------

// Close the academy-wide session: Admin only.
router.post("/sessions/:id/close", authorizeRoles("admin"), async (req, res) => {
  try {
    const session = await loadSession(req, res);
    if (!session || !requireOpen(session, res)) return;

    const activePlayers = await Player.find({ status: "Active" })
      .select("sport sports")
      .lean();

    const marked = await Attendance.find({ session: session._id })
      .select("player")
      .lean();

    const markedIds = new Set(marked.map((r) => String(r.player)));
    const missing = activePlayers.filter(
      (p) => !markedIds.has(String(p._id))
    );

    if (missing.length) {
      await Attendance.bulkWrite(
        missing.map((player) => ({
          updateOne: {
            filter: { session: session._id, player: player._id },
            update: {
              $setOnInsert: {
                date: session.date,
                status: "Absent",
                sports: sportsOf(player),
                markedAt: new Date(),
                auto: true,
              },
            },
            upsert: true,
          },
        }))
      );
    }

    const closed = await AttendanceSession.findOneAndUpdate(
      { _id: session._id, status: "Open" },
      {
        $set: {
          status: "Closed",
          closedBy: displayName(req),
          closedAt: new Date(),
        },
      },
      { returnDocument: "after" }
    );

    if (!closed) {
      return res.status(409).json({
        message: "This session was already closed.",
      });
    }

    res.json({
      session: closed,
      autoAbsent: missing.length,
      counts: await countsFor(session._id),
    });
  } catch (error) {
    console.error("Close session error:", error.message);
    res.status(500).json({ message: "Failed to close the session." });
  }
});

// Reopen a closed session: Admin only, reason mandatory.
router.post("/sessions/:id/reopen", authorizeRoles("admin"), async (req, res) => {
  try {
    const session = await loadSession(req, res);
    if (!session) return;

    if (session.status !== "Closed") {
      return res.status(409).json({
        message: "This session is already open.",
      });
    }

    const reason = clean(req.body?.reason, 300);

    if (reason.length < 3) {
      return res.status(400).json({
        message: "Please give a reason for reopening.",
      });
    }

    await Attendance.deleteMany({
      session: session._id,
      auto: true,
    });

    session.reopenHistory.push({
      reason,
      by: displayName(req),
      previouslyClosedBy: session.closedBy,
      previouslyClosedAt: session.closedAt,
    });

    session.status = "Open";
    session.closedBy = "";
    session.closedAt = null;

    await session.save();

    res.json({
      session,
      counts: await countsFor(session._id),
    });
  } catch (error) {
    console.error("Reopen error:", error.message);
    res.status(500).json({ message: "Failed to reopen the session." });
  }
});

// ---------- Per-player history ----------

// Players can access only their own history.
// Admins and coaches can access permitted players.
router.get("/player/:id", async (req, res) => {
  try {
    if (!validId(req.params.id)) {
      return res.status(400).json({ message: "Invalid player ID." });
    }

    if (isPlayer(req) && String(req.user.player) !== req.params.id) {
      return res.status(403).json({
        message: "You can only view your own attendance history.",
      });
    }

    if (req.user.role === "scout") {
      return res.status(403).json({
        message: "Scouts do not have access to attendance records.",
      });
    }

    const player = await Player.findById(req.params.id)
      .select("playerId firstName lastName sport sports status");

    if (!player) {
      return res.status(404).json({ message: "Player not found." });
    }

    if (isCoach(req) && !playerMatchesSports(player, req)) {
      return res.status(403).json({
        message: "This player is outside your assigned sports.",
      });
    }

    const closed = await AttendanceSession.find({ status: "Closed" })
      .select("_id")
      .lean();

    const history = await Attendance.find({
      player: player._id,
      session: { $in: closed.map((s) => s._id) },
    })
      .sort({ date: -1 })
      .lean();

    const counts = { Present: 0, Late: 0, Absent: 0, Excused: 0 };

    for (const record of history) {
      counts[record.status] += 1;
    }

    const attended = counts.Present + counts.Late;
    const counted = attended + counts.Absent;

    // Players only see date and status; staff notes stay private.
    const visibleHistory = isPlayer(req)
      ? history.map((record) => ({
          _id: record._id,
          date: record.date,
          status: record.status,
          sports: record.sports,
        }))
      : history;

    res.json({
      player,
      counts,
      sessionsCounted: counted,
      percentage: counted
        ? Math.round((attended / counted) * 1000) / 10
        : null,
      history: visibleHistory,
    });
  } catch (error) {
    console.error("Player attendance error:", error.message);
    res.status(500).json({
      message: "Failed to load attendance history.",
    });
  }
});

// ---------- Dashboard summary ----------

router.get("/summary", async (req, res) => {
  try {
    const date = todayString();

    const recent = await AttendanceSession.find()
      .sort({ date: -1 })
      .limit(7)
      .lean();

    const attendanceMatch = {
      session: { $in: recent.map((s) => s._id) },
    };

    if (isCoach(req)) {
      attendanceMatch.sports = {
        $in: assignedSports(req).map(
          (s) => new RegExp(`^${escapeRegex(s)}$`, "i")
        ),
      };
    }

    const rows = await Attendance.aggregate([
      { $match: attendanceMatch },
      {
        $group: {
          _id: { session: "$session", status: "$status" },
          count: { $sum: 1 },
        },
      },
    ]);

    const bySession = {};

    for (const row of rows) {
      const key = String(row._id.session);

      if (!bySession[key]) {
        bySession[key] = {
          Present: 0,
          Late: 0,
          Absent: 0,
          Excused: 0,
        };
      }

      bySession[key][row._id.status] = row.count;
    }

    const sessions = recent.map((s) => {
      const counts = bySession[String(s._id)] || {
        Present: 0,
        Late: 0,
        Absent: 0,
        Excused: 0,
      };

      const attended = counts.Present + counts.Late;
      const counted = attended + counts.Absent;

      return {
        ...s,
        counts,
        rate: counted
          ? Math.round((attended / counted) * 1000) / 10
          : null,
      };
    });

    res.json({
      date,
      activePlayers: await activePlayerCount(req),
      today: sessions.find((s) => s.date === date) || null,
      recent: sessions,
    });
  } catch (error) {
    console.error("Summary error:", error.message);
    res.status(500).json({
      message: "Failed to load the attendance summary.",
    });
  }
});

// ---------- Monthly report ----------

router.get("/monthly", async (req, res) => {
  try {
    const month =
      clean(req.query.month, 7) || todayString().slice(0, 7);

    if (!/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({
        message: "Month must look like 2026-11.",
      });
    }

    const sessions = await AttendanceSession.find({
      date: { $regex: `^${month}-` },
    })
      .sort({ date: 1 })
      .lean();

    const attendanceQuery = {
      session: { $in: sessions.map((s) => s._id) },
    };

    if (isCoach(req)) {
      attendanceQuery.sports = {
        $in: assignedSports(req).map(
          (s) => new RegExp(`^${escapeRegex(s)}$`, "i")
        ),
      };
    }

    const records = await Attendance.find(attendanceQuery)
      .populate("player", "playerId firstName lastName sport sports status")
      .lean();

    const closedIds = new Set(
      sessions
        .filter((s) => s.status === "Closed")
        .map((s) => String(s._id))
    );

    const byPlayer = new Map();

    for (const record of records) {
      if (!record.player) continue;

      const key = String(record.player._id);

      if (!byPlayer.has(key)) {
        byPlayer.set(key, {
          player: record.player,
          days: {},
          counts: {
            Present: 0,
            Late: 0,
            Absent: 0,
            Excused: 0,
          },
        });
      }

      const row = byPlayer.get(key);
      row.days[record.date] = record.status;

      if (closedIds.has(String(record.session))) {
        row.counts[record.status] += 1;
      }
    }

    const players = [...byPlayer.values()]
      .map((row) => {
        const attended = row.counts.Present + row.counts.Late;
        const counted = attended + row.counts.Absent;

        return {
          ...row,
          percentage: counted
            ? Math.round((attended / counted) * 1000) / 10
            : null,
        };
      })
      .sort((a, b) =>
        fullSort(a.player).localeCompare(fullSort(b.player))
      );

    res.json({
      month,
      sessions: sessions.map((s) => ({
        _id: s._id,
        date: s.date,
        status: s.status,
      })),
      players,
    });
  } catch (error) {
    console.error("Monthly report error:", error.message);
    res.status(500).json({
      message: "Failed to load the monthly report.",
    });
  }
});

export default router;
