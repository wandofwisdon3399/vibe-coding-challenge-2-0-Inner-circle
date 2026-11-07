import crypto from "crypto";
import bcrypt from "bcryptjs";

import Player from "../models/Player.js";
import User from "../models/User.js";

const generateTemporaryPassword = () =>
  crypto.randomBytes(15).toString("base64url");

// Creates (or links) the login account for a player.
// Username = Player ID (e.g. "sa-0001"). Returns credentials ONLY when a new
// account was created; a linked existing account keeps its own password.
export async function createPlayerAccount(player) {
  if (!player.playerId) {
    const error = new Error("This player has no Player ID yet.");
    error.code = "NO_PLAYER_ID";
    throw error;
  }

  const username = player.playerId.toLowerCase();
  const active = (player.status || "Active") === "Active";

  // Link an account that already points at this player or uses this username.
  const existing =
    (await User.findOne({ player: player._id })) ||
    (await User.findOne({ username }));

  if (existing) {
    const linkable =
      existing.role === "player" &&
      (!existing.player || String(existing.player) === String(player._id));

    if (!linkable) {
      const error = new Error(
        "A different account already uses this Player ID as its username."
      );
      error.code = "ACCOUNT_CONFLICT";
      throw error;
    }

    existing.player = player._id;
    existing.isActive = active;
    await existing.save();

    await Player.updateOne(
      { _id: player._id },
      { $set: { user: existing._id } }
    );

    return { linked: true, username: existing.username, credentials: null };
  }

  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await bcrypt.hash(temporaryPassword, 12);

  const user = await User.create({
    username,
    passwordHash,
    role: "player",
    isActive: active,
    player: player._id,
    assignedSports: [],
    mustChangePassword: true,
  });

  await Player.updateOne({ _id: player._id }, { $set: { user: user._id } });

  return {
    linked: false,
    username,
    credentials: {
      username,
      temporaryPassword,
      mustChangePassword: true,
    },
  };
}

// Keeps the login in step with the roster: inactive player = login disabled.
export async function syncPlayerAccount(player) {
  if (!player) return;

  const filter = player.user
    ? { _id: player.user }
    : { player: player._id, role: "player" };

  await User.updateMany(filter, {
    $set: { isActive: (player.status || "Active") === "Active" },
  });
}
