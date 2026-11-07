// Adds (or removes) sample data for testing.
//
//   node server/seed.js            adds sample players, matches and attendance
//   node server/seed.js --remove   removes ONLY the sample data (your real data is untouched)
//
// Run it from the project folder (the one that contains the .env file).

import dotenv from "dotenv";
import mongoose from "mongoose";
import Player from "./models/Player.js";
import Match from "./models/Match.js";
import Attendance from "./models/Attendance.js";
import AttendanceSession from "./models/AttendanceSession.js";
import { nextPlayerId } from "./utils/playerSetup.js";
import { SAMPLE_STAFF, PLAYERS, MATCHES, buildAttendance, completedMatchCount, attendancePercent } from "./seedData.js";

dotenv.config();

const SAMPLE_EMAIL = /@sample\.test$/; // every sample player has an email ending in @sample.test
const SAMPLE_TITLE = /^\[Sample\]/;     // every sample match title starts with [Sample]
const SESSIONS_WANTED = 12;

const todayIST = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

function addDays(day, n) {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

async function removeSample() {
  const players = await Player.find({ email: SAMPLE_EMAIL }).select("_id").lean();
  const playerIds = players.map((p) => p._id);
  const sessions = await AttendanceSession.find({ startedBy: SAMPLE_STAFF }).select("_id").lean();
  const sessionIds = sessions.map((s) => s._id);

  const records = await Attendance.deleteMany({ $or: [{ player: { $in: playerIds } }, { session: { $in: sessionIds } }] });
  const removedSessions = await AttendanceSession.deleteMany({ _id: { $in: sessionIds } });
  const matches = await Match.deleteMany({ title: SAMPLE_TITLE });
  const removedPlayers = await Player.deleteMany({ _id: { $in: playerIds } });

  console.log("Removed sample data:");
  console.log(`  ${removedPlayers.deletedCount} players, ${matches.deletedCount} matches, ${removedSessions.deletedCount} sessions, ${records.deletedCount} attendance records`);
}

async function addSample() {
  if (await Player.exists({ email: SAMPLE_EMAIL })) {
    console.log("Sample data is already in the database.");
    console.log("To start fresh, run:  node server/seed.js --remove   and then   node server/seed.js");
    return;
  }

  const today = todayIST();

  // 1. Players
  const byFirstName = {};
  for (const [index, spec] of PLAYERS.entries()) {
    const player = await Player.create({
      playerId: await nextPlayerId(),
      firstName: spec.first,
      lastName: spec.last,
      age: spec.age,
      sport: spec.sports[0],
      sports: spec.sports,
      phone: `90000000${String(index + 1).padStart(2, "0")}`,
      email: `${spec.first}.${spec.last}@sample.test`,
      position: spec.position,
      status: spec.inactive ? "Inactive" : "Active",
      statusReason: spec.inactive ? spec.reason : "",
      notes: spec.notes.map((text) => ({ text })),
      achievements: spec.achievements.map(([title, daysAgo]) => ({ title, date: new Date(`${addDays(today, daysAgo)}T00:00:00Z`) })),
      createdAt: new Date(Date.now() - 25 * 86400000), // registered about 25 days ago
    });
    byFirstName[spec.first] = player;
  }

  // 2. Closed attendance sessions on free days in the past (days that already have a session are skipped)
  const taken = new Set((await AttendanceSession.find().select("date").lean()).map((s) => s.date));
  const dates = [];
  for (let back = 1; back <= 40 && dates.length < SESSIONS_WANTED; back++) {
    const day = addDays(today, -back);
    if (!taken.has(day)) dates.push(day);
  }
  dates.reverse(); // oldest first
  const sessions = await AttendanceSession.insertMany(
    dates.map((day) => ({
      date: day,
      status: "Closed",
      startedBy: SAMPLE_STAFF,
      startedAt: new Date(`${day}T10:30:00+05:30`),
      closedBy: SAMPLE_STAFF,
      closedAt: new Date(`${day}T12:30:00+05:30`),
    }))
  );

  // 3. Attendance records
  const statusesByPlayer = buildAttendance(sessions.length);
  const records = [];
  for (const spec of PLAYERS) {
    const player = byFirstName[spec.first];
    statusesByPlayer[spec.first].forEach((status, dayIndex) => {
      records.push({
        session: sessions[dayIndex]._id,
        player: player._id,
        date: sessions[dayIndex].date,
        status,
        sports: spec.sports,
        markedAt: new Date(`${sessions[dayIndex].date}T10:45:00+05:30`),
        auto: status === "Absent", // absentees are marked automatically when a session closes
      });
    });
  }
  await Attendance.insertMany(records);

  // 4. Matches
  for (const spec of MATCHES) {
    const day = addDays(today, spec.day);
    await Match.create({
      title: `[Sample] ${spec.title}`,
      sport: spec.sport,
      date: new Date(`${day}T00:00:00Z`),
      venue: spec.venue,
      opponent: spec.opponent,
      status: spec.status,
      result: spec.result || "",
      resultRecordedAt: spec.status === "Completed" ? new Date(`${day}T18:00:00+05:30`) : null,
      participants: spec.players.map(([first, performance]) => ({ player: byFirstName[first]._id, performance: performance || "" })),
    });
  }

  console.log(`Added ${PLAYERS.length} players, ${sessions.length} closed attendance sessions, ${records.length} attendance records and ${MATCHES.length} matches.`);
  console.log("");
  console.log("Player".padEnd(18), "ID".padEnd(9), "Attendance".padEnd(11), "Matches", " Would be Ready?");
  for (const spec of PLAYERS) {
    const pct = attendancePercent(statusesByPlayer[spec.first]);
    const matches = completedMatchCount(spec.first);
    const ready = !spec.inactive && pct !== null && pct >= 75 && statusesByPlayer[spec.first].length >= 10 && matches >= 2;
    console.log(
      `${spec.first} ${spec.last}`.padEnd(18),
      byFirstName[spec.first].playerId.padEnd(9),
      `${pct ?? "-"}%`.padEnd(11),
      String(matches).padEnd(7),
      spec.inactive ? " inactive" : ready ? " YES" : " no"
    );
  }
  console.log("");
  console.log("To remove all of this later:  node server/seed.js --remove");
}

async function main() {
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is missing. Run this from the project folder that contains your .env file.");
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
  console.log(`Connected to database: ${mongoose.connection.name}`);
  if (process.argv.includes("--remove")) await removeSample();
  else await addSample();
}

main()
  .catch((error) => {
    console.error("Sample data step failed:", error.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
