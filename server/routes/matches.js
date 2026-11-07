
import express from "express";
import mongoose from "mongoose";

import Match, { PERFORMANCE_LEVELS } from "../models/Match.js";
import Player from "../models/Player.js";
import Attendance from "../models/Attendance.js";

import { authenticate } from "../middleware/auth.js";
import { getReadyPlayerIds } from "../utils/readiness.js";

const router = express.Router();

router.use(authenticate);

const allowedFields = [
  "title",
  "sport",
  "date",
  "venue",
  "opponent",
  "status",
  "result",
];

const validId = (id) => mongoose.isValidObjectId(id);

const PLAYER_FIELDS =
  "playerId firstName lastName sport sports status";

function cleanInput(body) {
  const input = {};

  for (const field of allowedFields) {
    if (Object.hasOwn(body, field)) {
      input[field] = body[field];
    }
  }

  return input;
}

const withPlayers = (query, fields = PLAYER_FIELDS) =>
  query.populate("participants.player", fields);

function hasAssignedSport(user, sport) {
  return (user.assignedSports || []).some(
    (item) => item.toLowerCase() === String(sport).toLowerCase()
  );
}

function playerHasSport(player, sport) {
  const sports = [
    ...(player.sports || []),
    player.sport,
  ].filter(Boolean);

  return sports.some(
    (item) => item.toLowerCase() === String(sport).toLowerCase()
  );
}

// Check participant IDs and ensure they exist.
async function checkPlayerIds(ids) {
  if (!Array.isArray(ids)) {
    return { error: "Participants must be a list of players." };
  }

  const unique = [...new Set(ids.map(String))];

  if (!unique.every(validId)) {
    return { error: "One of the selected players is invalid." };
  }

  const found = await Player.find({
    _id: { $in: unique },
    status: "Active",
  })
    .select("_id")
    .lean();

  if (found.length !== unique.length) {
    return {
      error: "One of the selected players is invalid or inactive.",
    };
  }

  return { ids: unique };
}

// Verify that all participants belong to the match's sport.
async function validateParticipants(ids, sport) {
  const players = await Player.find({
    _id: { $in: ids },
    status: "Active",
  })
    .select("sport sports")
    .lean();

  if (
    players.some((player) => !playerHasSport(player, sport))
  ) {
    return {
      error: "Every participant must belong to the selected sport.",
    };
  }

  return { valid: true };
}

// Scout eligibility comes from the shared readiness module.
const getScoutReadyPlayerIds = getReadyPlayerIds;

// Remove participants who should not be visible to the requester.
function filterMatchParticipants(match, allowedIds) {
  const result = match.toObject
    ? match.toObject()
    : { ...match };

  result.participants = (result.participants || []).filter(
    (participant) => {
      const player = participant.player;
      const id = player?._id || player;

      return id && allowedIds.has(String(id));
    }
  );

  return result;
}

// GET /api/matches
router.get("/", async (req, res) => {
  try {
    const { role } = req.user;

    if (role === "admin") {
      const matches = await withPlayers(
        Match.find().sort({ date: 1, createdAt: -1 })
      );

      return res.json(matches);
    }

    if (role === "coach") {
      const assignedSports = req.user.assignedSports || [];

      if (!assignedSports.length) return res.json([]);

      const matches = await withPlayers(
        Match.find({
          sport: {
            $in: assignedSports.map((sport) =>
              new RegExp(
                `^${sport.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
                "i"
              )
            ),
          },
        }).sort({ date: 1, createdAt: -1 })
      );

      return res.json(matches);
    }

    if (role === "scout") {
      const readyIds = await getScoutReadyPlayerIds();

      if (!readyIds.length) return res.json([]);

      const matches = await withPlayers(
        Match.find({
          status: "Completed",
          "participants.player": { $in: readyIds },
        }).sort({ date: -1 })
      );

      const allowedIds = new Set(readyIds.map(String));

      return res.json(
        matches.map((match) =>
          filterMatchParticipants(match, allowedIds)
        )
      );
    }

    if (role === "player") {
      if (!req.user.player) {
        return res.status(404).json({
          message: "No player profile is linked to this account.",
        });
      }

      const matches = await withPlayers(
        Match.find({
          "participants.player": req.user.player,
        }).sort({ date: -1 })
      );

      const allowedIds = new Set([String(req.user.player)]);

      return res.json(
        matches.map((match) =>
          filterMatchParticipants(match, allowedIds)
        )
      );
    }

    return res.status(403).json({ message: "Access denied." });
  } catch (error) {
    console.error("Fetch matches error:", error.message);

    res.status(500).json({
      message: "Failed to fetch matches.",
    });
  }
});

// GET /api/matches/:id
router.get("/:id", async (req, res) => {
  if (!validId(req.params.id)) {
    return res.status(400).json({ message: "Invalid match ID." });
  }

  try {
    const { role } = req.user;

    const match = await withPlayers(
      Match.findById(req.params.id),
      `${PLAYER_FIELDS} photo`
    );

    if (!match) {
      return res.status(404).json({ message: "Match not found." });
    }

    if (role === "coach" && !hasAssignedSport(req.user, match.sport)) {
      return res.status(403).json({
        message: "You do not have access to this sport.",
      });
    }

    if (role === "scout") {
      if (match.status !== "Completed") {
        return res.status(403).json({
          message: "Scouts can only view completed matches.",
        });
      }

      const readyIds = await getScoutReadyPlayerIds();
      const allowedIds = new Set(readyIds.map(String));

      const visibleMatch = filterMatchParticipants(match, allowedIds);

      if (!visibleMatch.participants.length) {
        return res.status(403).json({
          message: "This match contains no Scout-eligible players.",
        });
      }

      return res.json(visibleMatch);
    }

    if (role === "player") {
      const playerId = String(req.user.player);

      const participated = match.participants.some(
        (participant) =>
          String(
            participant.player?._id || participant.player
          ) === playerId
      );

      if (!participated) {
        return res.status(403).json({
          message: "You can only access matches you participated in.",
        });
      }

      const visibleMatch = filterMatchParticipants(
        match,
        new Set([playerId])
      );

      return res.json(visibleMatch);
    }

    if (role !== "admin" && role !== "coach") {
      return res.status(403).json({ message: "Access denied." });
    }

    // Attendance suggestions are only provided to Admin and Coach.
    const day = match.date.toISOString().slice(0, 10);
    const sport = match.sport.toLowerCase();

    const records = await Attendance.find({
      date: day,
      status: { $in: ["Present", "Late"] },
    })
      .populate("player", `${PLAYER_FIELDS} photo`)
      .lean();

    const seen = new Set();
    const presentThatDay = [];

    for (const record of records) {
      const player = record.player;

      if (
        !player ||
        player.status !== "Active" ||
        seen.has(String(player._id)) ||
        !playerHasSport(player, sport)
      ) {
        continue;
      }

      seen.add(String(player._id));
      presentThatDay.push(player);
    }

    return res.json({
      ...match.toObject(),
      presentThatDay,
    });
  } catch (error) {
    console.error("Fetch match error:", error.message);

    res.status(500).json({
      message: "Failed to fetch the match.",
    });
  }
});

// POST /api/matches
// Admin and assigned Coaches can create matches.
router.post("/", async (req, res) => {
  try {
    const { role } = req.user;

    if (role !== "admin" && role !== "coach") {
      return res.status(403).json({
        message: "You do not have permission to create matches.",
      });
    }

    const input = cleanInput(req.body);

    if (
      !input.title?.trim() ||
      !input.sport?.trim() ||
      !input.date
    ) {
      return res.status(400).json({
        message: "Match title, sport and date are required.",
      });
    }

    if (
      role === "coach" &&
      !hasAssignedSport(req.user, input.sport)
    ) {
      return res.status(403).json({
        message: "You can only create matches for your assigned sports.",
      });
    }

    input.status = "Upcoming";
    input.result = "";

    if (Object.hasOwn(req.body, "participants")) {
      const check = await checkPlayerIds(req.body.participants);

      if (check.error) {
        return res.status(400).json({ message: check.error });
      }

      const validation = await validateParticipants(
        check.ids,
        input.sport
      );

      if (validation.error) {
        return res.status(400).json({ message: validation.error });
      }

      input.participants = check.ids.map((player) => ({ player }));
    }

    const match = await Match.create(input);

    res.status(201).json(
      await withPlayers(Match.findById(match._id))
    );
  } catch (error) {
    if (
      ["ValidationError", "CastError"].includes(error.name)
    ) {
      return res.status(400).json({
        message: "Invalid match details.",
      });
    }

    console.error("Create match error:", error.message);

    res.status(500).json({
      message: "Failed to create match.",
    });
  }
});

// PATCH /api/matches/:id
// Admin and assigned Coaches can edit match details.
router.patch("/:id", async (req, res) => {
  if (!validId(req.params.id)) {
    return res.status(400).json({ message: "Invalid match ID." });
  }

  try {
    const { role } = req.user;

    if (role !== "admin" && role !== "coach") {
      return res.status(403).json({
        message: "You do not have permission to edit matches.",
      });
    }

    const current = await Match.findById(req.params.id);

    if (!current) {
      return res.status(404).json({ message: "Match not found." });
    }

    if (
      role === "coach" &&
      !hasAssignedSport(req.user, current.sport)
    ) {
      return res.status(403).json({
        message: "You do not have access to this sport.",
      });
    }

    const input = cleanInput(req.body);

    if (
      role === "coach" &&
      Object.hasOwn(input, "sport") &&
      !hasAssignedSport(req.user, input.sport)
    ) {
      return res.status(403).json({
        message: "You cannot change a match to another sport.",
      });
    }

    // Results must be recorded through the result endpoint.
    if (
      Object.hasOwn(input, "status") &&
      input.status === "Completed"
    ) {
      return res.status(400).json({
        message: "Use the result-recording endpoint to complete a match.",
      });
    }

    if (Object.hasOwn(req.body, "participants")) {
      const check = await checkPlayerIds(req.body.participants);

      if (check.error) {
        return res.status(400).json({ message: check.error });
      }

      const sport = input.sport || current.sport;

      const validation = await validateParticipants(
        check.ids,
        sport
      );

      if (validation.error) {
        return res.status(400).json({ message: validation.error });
      }

      const rated = new Map(
        current.participants.map((participant) => [
          String(participant.player),
          participant.performance,
        ])
      );

      input.participants = check.ids.map((player) => ({
        player,
        performance: rated.get(player) || "",
      }));
    }

    const match = await Match.findByIdAndUpdate(
      req.params.id,
      input,
      {
        returnDocument: "after",
        runValidators: true,
      }
    );

    res.json(
      await withPlayers(Match.findById(match._id))
    );
  } catch (error) {
    if (
      ["ValidationError", "CastError"].includes(error.name)
    ) {
      return res.status(400).json({
        message: "Invalid match details.",
      });
    }

    console.error("Update match error:", error.message);

    res.status(500).json({
      message: "Failed to update match.",
    });
  }
});

// POST /api/matches/:id/result
// Admin and assigned Coaches can record results.
router.post("/:id/result", async (req, res) => {
  if (!validId(req.params.id)) {
    return res.status(400).json({ message: "Invalid match ID." });
  }

  try {
    const { role } = req.user;

    if (role !== "admin" && role !== "coach") {
      return res.status(403).json({
        message: "You do not have permission to record match results.",
      });
    }

    const current = await Match.findById(req.params.id);

    if (!current) {
      return res.status(404).json({ message: "Match not found." });
    }

    if (
      role === "coach" &&
      !hasAssignedSport(req.user, current.sport)
    ) {
      return res.status(403).json({
        message: "You do not have access to this sport.",
      });
    }

    const result = String(
      req.body?.result ?? ""
    ).trim().slice(0, 160);

    if (!result) {
      return res.status(400).json({
        message: "Please enter the result or score.",
      });
    }

    const rows = Array.isArray(req.body?.participants)
      ? req.body.participants
      : [];

    const check = await checkPlayerIds(
      rows.map((row) => row?.player)
    );

    if (check.error) {
      return res.status(400).json({ message: check.error });
    }

    const validation = await validateParticipants(
      check.ids,
      current.sport
    );

    if (validation.error) {
      return res.status(400).json({ message: validation.error });
    }

    const performanceById = new Map();

    for (const row of rows) {
      const performance = row.performance || "";

      if (
        performance &&
        !PERFORMANCE_LEVELS.includes(performance)
      ) {
        return res.status(400).json({
          message: `Performance must be one of: ${PERFORMANCE_LEVELS.join(", ")}.`,
        });
      }

      performanceById.set(String(row.player), performance);
    }

    const match = await Match.findByIdAndUpdate(
      req.params.id,
      {
        status: "Completed",
        result,
        resultRecordedAt: new Date(),
        participants: check.ids.map((player) => ({
          player,
          performance: performanceById.get(player) || "",
        })),
      },
      {
        returnDocument: "after",
        runValidators: true,
      }
    );

    res.json(
      await withPlayers(Match.findById(match._id))
    );
  } catch (error) {
    if (
      ["ValidationError", "CastError"].includes(error.name)
    ) {
      return res.status(400).json({
        message: "Invalid result details.",
      });
    }

    console.error("Record result error:", error.message);

    res.status(500).json({
      message: "Failed to record the result.",
    });
  }
});

export default router;
