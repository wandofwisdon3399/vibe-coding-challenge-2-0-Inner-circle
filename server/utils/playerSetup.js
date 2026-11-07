import Counter from "../models/Counter.js";
import Player from "../models/Player.js";

// Returns the next Player ID: SA-0001, SA-0002, ...
export async function nextPlayerId() {
  const counter = await Counter.findOneAndUpdate(
    { _id: "player" },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return `SA-${String(counter.seq).padStart(4, "0")}`;
}

// Runs once at server start. Safe to run many times: it only touches
// players that are missing a Player ID or a sports list.
export async function backfillPlayers() {
  const needSports = await Player.find({
    $or: [{ sports: { $exists: false } }, { sports: { $size: 0 } }],
  }).lean();
  for (const player of needSports) {
    if (player.sport) {
      await Player.updateOne({ _id: player._id }, { $set: { sports: [player.sport] } });
    }
  }

  const needId = await Player.find({
    $or: [{ playerId: { $exists: false } }, { playerId: null }, { playerId: "" }],
  })
    .sort({ createdAt: 1 })
    .select("_id")
    .lean();
  for (const player of needId) {
    await Player.updateOne({ _id: player._id }, { $set: { playerId: await nextPlayerId() } });
  }

  if (needSports.length || needId.length) {
    console.log(`Updated existing players: ${needId.length} got Player IDs, ${needSports.length} got sports lists.`);
  }
}
