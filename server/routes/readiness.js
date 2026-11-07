import express from "express";
import mongoose from "mongoose";

import Player from "../models/Player.js";
import Attendance from "../models/Attendance.js";
import AttendanceSession from "../models/AttendanceSession.js";
import Match from "../models/Match.js";

import { authenticate, authorizeRoles } from "../middleware/auth.js";
import {
  evaluatePlayers,
  READINESS_RULES,
  CLOSED_SESSION_FILTER,
} from "../utils/readiness.js";

const router = express.Router();

// Admin sees every sport; Coach sees only assigned sports.
// Scouts have their own Ready Players view and are not allowed here.
router.use(authenticate);
router.use(authorizeRoles("admin", "coach"));

const validId = (id) => mongoose.isValidObjectId(id);

const sportsOfPlayer = (player) =>
  [...new Set([player.sport, ...(player.sports || [])].filter(Boolean))];

function coachHasSportAccess(player, assignedSports) {
  const allowed = new Set(
    (assignedSports || []).map((sport) => sport.toLowerCase())
  );

  return sportsOfPlayer(player).some((sport) =>
    allowed.has(sport.toLowerCase())
  );
}

function shapeEvaluation(evaluation) {
  const { player } = evaluation;

  return {
    _id: player._id,
    playerId: player.playerId,
    firstName: player.firstName,
    lastName: player.lastName,
    age: player.age,
    sport: player.sport,
    sports: sportsOfPlayer(player),
    position: player.position,
    photo: player.photo,
    ready: evaluation.ready,
    criteriaMet: evaluation.criteriaMet,
    criteria: evaluation.criteria,
    reasons: evaluation.reasons,
    metrics: evaluation.metrics,
  };
}

// GET /api/readiness
router.get("/", async (req, res) => {
  try {
    let sports = null;

    if (req.user.role === "coach") {
      sports = req.user.assignedSports || [];

      if (!sports.length) {
        return res.json({
          rules: READINESS_RULES,
          academyClosedSessions: 0,
          players: [],
        });
      }
    }

    const { rules, academyClosedSessions, evaluations } =
      await evaluatePlayers({ sports });

    res.json({
      rules,
      academyClosedSessions,
      generatedAt: new Date().toISOString(),
      players: evaluations.map(shapeEvaluation),
    });
  } catch (error) {
    console.error("Readiness list error:", error.message);
    res.status(500).json({ message: "Failed to evaluate players." });
  }
});

// GET /api/readiness/:id  (detailed evaluation of one player)
router.get("/:id", async (req, res) => {
  if (!validId(req.params.id)) {
    return res.status(400).json({ message: "Invalid player ID." });
  }

  try {
    const player = await Player.findById(req.params.id)
      .select("sport sports status")
      .lean();

    if (!player) {
      return res.status(404).json({ message: "Player not found." });
    }

    if (
      req.user.role === "coach" &&
      !coachHasSportAccess(player, req.user.assignedSports)
    ) {
      return res.status(403).json({
        message: "You do not have access to this player.",
      });
    }

    if (player.status !== "Active") {
      return res.status(404).json({
        message: "Only active players are evaluated.",
      });
    }

    const { rules, academyClosedSessions, evaluations } =
      await evaluatePlayers({
        playerIds: [player._id],
        select:
          "playerId firstName lastName age sport sports position photo status",
      });

    if (!evaluations.length) {
      return res.status(404).json({ message: "Player not found." });
    }

    const closedSessions = await AttendanceSession.find(CLOSED_SESSION_FILTER)
      .select("_id date")
      .lean();

    const dateBySession = new Map(
      closedSessions.map((s) => [String(s._id), s.date])
    );

    const records = closedSessions.length
      ? await Attendance.find({
          player: player._id,
          session: { $in: closedSessions.map((s) => s._id) },
        })
          .select("session status")
          .lean()
      : [];

    const history = records
      .map((r) => ({
        date: dateBySession.get(String(r.session)) || "",
        status: r.status,
      }))
      .sort((a, b) => b.date.localeCompare(a.date));

    // Month-by-month attendance (newest first, last 6 months).
    const monthly = new Map();

    for (const item of history) {
      const month = item.date.slice(0, 7);

      if (!monthly.has(month)) {
        monthly.set(month, { month, attended: 0, counted: 0, excused: 0 });
      }

      const row = monthly.get(month);

      if (item.status === "Present" || item.status === "Late") {
        row.attended++;
        row.counted++;
      } else if (item.status === "Absent") {
        row.counted++;
      } else if (item.status === "Excused") {
        row.excused++;
      }
    }

    const monthlyAttendance = [...monthly.values()]
      .sort((a, b) => b.month.localeCompare(a.month))
      .slice(0, 6)
      .map((row) => ({
        ...row,
        percentage: row.counted
          ? Math.round((row.attended / row.counted) * 1000) / 10
          : null,
      }));

    const matches = await Match.find({
      status: "Completed",
      "participants.player": player._id,
    })
      .select("title sport date opponent result participants")
      .sort({ date: -1 })
      .lean();

    const matchHistory = matches.map((match) => {
      const mine = (match.participants || []).find(
        (p) => String(p.player) === String(player._id)
      );

      return {
        _id: match._id,
        title: match.title,
        sport: match.sport,
        date: match.date,
        opponent: match.opponent,
        result: match.result,
        performance: mine?.performance || "",
      };
    });

    res.json({
      rules,
      academyClosedSessions,
      ...shapeEvaluation(evaluations[0]),
      recentAttendance: history.slice(0, 15),
      monthlyAttendance,
      matches: matchHistory,
    });
  } catch (error) {
    console.error("Readiness detail error:", error.message);
    res.status(500).json({ message: "Failed to load player evaluation." });
  }
});

export default router;
