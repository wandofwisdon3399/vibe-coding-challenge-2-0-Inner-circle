
import express from "express";
import mongoose from "mongoose";

import Player from "../models/Player.js";

import { nextPlayerId } from "../utils/playerSetup.js";
import User from "../models/User.js";
import {
  createPlayerAccount,
  syncPlayerAccount,
} from "../utils/playerAccounts.js";
import { authenticate } from "../middleware/auth.js";
import { getReadyPlayerDocs } from "../utils/readiness.js";

const router = express.Router();

router.use(authenticate);

const allowedFields = [
  "firstName",
  "lastName",
  "age",
  "phone",
  "email",
  "position",
  "status",
  "statusReason",
  "photo",
  "notes",
  "achievements",
];

function validId(id) {
  return mongoose.isValidObjectId(id);
}

function cleanPlayerInput(body) {
  const input = {};

  for (const field of allowedFields) {
    if (Object.hasOwn(body, field)) {
      input[field] = body[field];
    }
  }

  if (Object.hasOwn(input, "age")) {
    input.age = Number(input.age);
  }

  const hasSports = Object.hasOwn(body, "sports");
  const hasSport = Object.hasOwn(body, "sport");

  if (hasSports || hasSport) {
    const raw = hasSports ? body.sports : [body.sport];

    const list = [
      ...new Set(
        (Array.isArray(raw) ? raw : [raw])
          .map((s) => String(s ?? "").trim())
          .filter(Boolean)
      ),
    ];

    input.sports = list;
    input.sport = list[0] || "";
  }

  return input;
}

function cleanPrivateFields(player) {
  const result = player.toObject();

  delete result.notes;
  delete result.statusReason;
  delete result.user;

  return result;
}

function scoutPlayerView(player) {
  return {
    _id: player._id,
    playerId: player.playerId,
    firstName: player.firstName,
    lastName: player.lastName,
    age: player.age,
    sport: player.sport,
    sports: player.sports,
    position: player.position,
    photo: player.photo,
    achievements: player.achievements,
  };
}

function coachHasSportAccess(player, assignedSports) {
  const allowedSports = new Set(
    (assignedSports || []).map((sport) => sport.toLowerCase())
  );

  const playerSports = [
    ...(player.sports || []),
    player.sport,
  ]
    .filter(Boolean)
    .map((sport) => sport.toLowerCase());

  return playerSports.some((sport) => allowedSports.has(sport));
}

// Scout eligibility comes from the shared readiness module, so Admin,
// Scout and Trial Readiness always agree.
async function getScoutReadyPlayers() {
  const players = await getReadyPlayerDocs(
    "playerId firstName lastName age sport sports position photo achievements"
  );

  return players.map(scoutPlayerView);
}

// GET /api/players
router.get("/", async (req, res) => {
  try {
    const { role } = req.user;

    // Admin: all players.
    if (role === "admin") {
      const players = await Player.find().sort({ createdAt: -1 });
      return res.json(players);
    }

    // Coach: active players in assigned sports.
    if (role === "coach") {
      const assignedSports = req.user.assignedSports || [];

      if (!assignedSports.length) {
        return res.json([]);
      }

      const players = await Player.find({
        status: "Active",
        $or: [
          { sports: { $in: assignedSports } },
          { sport: { $in: assignedSports } },
        ],
      }).sort({ createdAt: -1 });

      return res.json(players.map(cleanPrivateFields));
    }

    // Scout: only eligible players.
    if (role === "scout") {
      const players = await getScoutReadyPlayers();
      return res.json(players);
    }

    // Player: only their own record.
    if (role === "player") {
      if (!req.user.player) {
        return res.status(404).json({
          message: "No player profile is linked to this account.",
        });
      }

      const player = await Player.findById(req.user.player);

      if (!player) {
        return res.status(404).json({
          message: "Player profile not found.",
        });
      }

      return res.json([cleanPrivateFields(player)]);
    }

    return res.status(403).json({ message: "Access denied." });
  } catch (error) {
    console.error("Fetch players error:", error.message);
    res.status(500).json({ message: "Failed to fetch players." });
  }
});

// GET /api/players/:id
router.get("/:id", async (req, res) => {
  if (!validId(req.params.id)) {
    return res.status(400).json({ message: "Invalid player ID." });
  }

  try {
    const { role } = req.user;

    // Player accounts can only access their own record.
    if (role === "player") {
      if (String(req.user.player) !== req.params.id) {
        return res.status(403).json({
          message: "You can only access your own player profile.",
        });
      }
    }

    const player = await Player.findById(req.params.id);

    if (!player) {
      return res.status(404).json({ message: "Player not found." });
    }

    if (role === "coach") {
      if (
        player.status !== "Active" ||
        !coachHasSportAccess(player, req.user.assignedSports)
      ) {
        return res.status(403).json({
          message: "You do not have access to this player.",
        });
      }

      return res.json(cleanPrivateFields(player));
    }

    if (role === "scout") {
      const readyPlayers = await getScoutReadyPlayers();

      const eligible = readyPlayers.find(
        (item) => String(item._id) === req.params.id
      );

      if (!eligible) {
        return res.status(403).json({
          message: "This player is not eligible for Scout access.",
        });
      }

      return res.json(eligible);
    }

    if (role === "player") {
      return res.json(cleanPrivateFields(player));
    }

    if (role === "admin") {
      return res.json(player);
    }

    return res.status(403).json({ message: "Access denied." });
  } catch (error) {
    console.error("Fetch player error:", error.message);
    res.status(500).json({ message: "Failed to fetch player." });
  }
});

// POST /api/players
// Only Admin can register players.
router.post("/", async (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({
      message: "Only Admin can register players.",
    });
  }

  try {
    const input = cleanPlayerInput(req.body);

    if (
      !input.firstName?.trim() ||
      !input.lastName?.trim() ||
      !input.age ||
      !input.sports?.length
    ) {
      return res.status(400).json({
        message:
          "First name, last name, age, and at least one sport are required.",
      });
    }

    input.playerId = await nextPlayerId();

    const player = await Player.create(input);

    // Every new player gets a login account (username = Player ID).
    let account;
    try {
      account = await createPlayerAccount(player);
    } catch (accountError) {
      await Player.deleteOne({ _id: player._id }).catch(() => {});
      console.error("Player account error:", accountError.message);
      return res.status(500).json({
        message: `Player was not saved because the login account could not be created: ${accountError.message}`,
      });
    }

    const saved = await Player.findById(player._id);

    // The temporary password is returned once, only to the Admin.
    res.status(201).json({
      ...saved.toObject(),
      credentials: account.credentials,
    });
  } catch (error) {
    if (
      error.name === "ValidationError" ||
      error.name === "CastError"
    ) {
      return res.status(400).json({
        message: "Invalid player details. Please check the submitted fields.",
      });
    }

    console.error("Create player error:", error.message);

    res.status(500).json({
      message: "Failed to register player.",
    });
  }
});

// PATCH /api/players/:id
router.patch("/:id", async (req, res) => {
  if (!validId(req.params.id)) {
    return res.status(400).json({ message: "Invalid player ID." });
  }

  try {
    const { role } = req.user;

    const player = await Player.findById(req.params.id);

    if (!player) {
      return res.status(404).json({ message: "Player not found." });
    }

    // Coach: only update playing position for assigned sports.
    if (role === "coach") {
      if (
        player.status !== "Active" ||
        !coachHasSportAccess(player, req.user.assignedSports)
      ) {
        return res.status(403).json({
          message: "You do not have access to this player.",
        });
      }

      if (
        !Object.hasOwn(req.body, "position") ||
        Object.keys(req.body).some((key) => key !== "position")
      ) {
        return res.status(403).json({
          message: "Coaches can only update a player's position.",
        });
      }

      player.position = String(req.body.position ?? "").trim();

      await player.save();

      return res.json(cleanPrivateFields(player));
    }

    // Player and Scout accounts cannot edit player records.
    if (role !== "admin") {
      return res.status(403).json({
        message: "You do not have permission to edit player records.",
      });
    }

    const input = cleanPlayerInput(req.body);

    const updatedPlayer = await Player.findByIdAndUpdate(
      req.params.id,
      input,
      {
        new: true,
        runValidators: true,
      }
    );

    // Keep the login enabled/disabled in step with the player's status.
    if (updatedPlayer && Object.hasOwn(input, "status")) {
      await syncPlayerAccount(updatedPlayer);
    }

    res.json(updatedPlayer);
  } catch (error) {
    if (
      error.name === "ValidationError" ||
      error.name === "CastError"
    ) {
      return res.status(400).json({
        message: "Invalid player details. Please check the submitted fields.",
      });
    }

    console.error("Update player error:", error.message);

    res.status(500).json({
      message: "Failed to update player.",
    });
  }
});

// DELETE /api/players/:id
// Soft-delete: Admin only.
router.delete("/:id", async (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({
      message: "Only Admin can deactivate players.",
    });
  }

  if (!validId(req.params.id)) {
    return res.status(400).json({ message: "Invalid player ID." });
  }

  try {
    const player = await Player.findByIdAndUpdate(
      req.params.id,
      {
        status: "Inactive",
        statusReason:
          req.body?.reason || "Removed from active roster",
      },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!player) {
      return res.status(404).json({ message: "Player not found." });
    }

    // Deactivated players can no longer log in.
    await syncPlayerAccount(player);

    res.json({
      message:
        "Player marked inactive. Their record has been preserved.",
      player,
    });
  } catch (error) {
    console.error("Deactivate player error:", error.message);

    res.status(500).json({
      message: "Failed to deactivate player.",
    });
  }
});

// GET /api/players/:id/account  (Admin) - login account status
router.get("/:id/account", async (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Only Admin can view accounts." });
  }

  if (!validId(req.params.id)) {
    return res.status(400).json({ message: "Invalid player ID." });
  }

  try {
    const player = await Player.findById(req.params.id).select("user playerId");

    if (!player) {
      return res.status(404).json({ message: "Player not found." });
    }

    const account = await User.findOne(
      player.user ? { _id: player.user } : { player: player._id }
    ).select("username isActive lastLogin mustChangePassword");

    if (!account) {
      return res.json({ exists: false, username: player.playerId?.toLowerCase() || "" });
    }

    res.json({
      exists: true,
      username: account.username,
      isActive: account.isActive,
      lastLogin: account.lastLogin,
      mustChangePassword: account.mustChangePassword,
    });
  } catch (error) {
    console.error("Player account lookup error:", error.message);
    res.status(500).json({ message: "Failed to load the login account." });
  }
});

// POST /api/players/:id/account  (Admin) - create a login for an existing player
router.post("/:id/account", async (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Only Admin can create accounts." });
  }

  if (!validId(req.params.id)) {
    return res.status(400).json({ message: "Invalid player ID." });
  }

  try {
    const player = await Player.findById(req.params.id);

    if (!player) {
      return res.status(404).json({ message: "Player not found." });
    }

    const already = await User.exists({
      $or: [{ _id: player.user || null }, { player: player._id }],
    });

    if (already) {
      return res.status(409).json({
        message: "This player already has a login account.",
      });
    }

    const account = await createPlayerAccount(player);

    res.status(201).json({
      message: "Login account created.",
      username: account.username,
      credentials: account.credentials,
    });
  } catch (error) {
    if (error.code === "ACCOUNT_CONFLICT" || error.code === "NO_PLAYER_ID") {
      return res.status(409).json({ message: error.message });
    }

    console.error("Create player account error:", error.message);
    res.status(500).json({ message: "Failed to create the login account." });
  }
});

export default router;
