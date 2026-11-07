import Player from "../models/Player.js";
import Attendance from "../models/Attendance.js";
import AttendanceSession from "../models/AttendanceSession.js";
import Match from "../models/Match.js";

// The ONE place where "Ready" is defined.
// Admin, Coach, Scout and the Trial Readiness page all use this file.
export const READINESS_RULES = {
  minAttendancePct: 75, // Present + Late out of (Present + Late + Absent); Excused is ignored
  minCompletedMatches: 2,
};

// Sessions only count once they are closed (a reopened session is "Open" again).
export const CLOSED_SESSION_FILTER = {
  status: "Closed",
  closedAt: { $ne: null },
};

const PERFORMANCE_SCORE = {
  Excellent: 4,
  Good: 3,
  Average: 2,
  "Needs Improvement": 1,
};

const round1 = (n) => Math.round(n * 10) / 10;

function performanceLabel(avg) {
  if (avg === null) return "";
  if (avg >= 3.5) return "Excellent";
  if (avg >= 2.5) return "Good";
  if (avg >= 1.5) return "Average";
  return "Needs Improvement";
}

const plural = (n, word, many = `${word}s`) =>
  `${n} ${n === 1 ? word : many}`;

// Build the three criteria and the human-readable reasons for one player.
function buildCriteria(metrics) {
  const rules = READINESS_RULES;

  const attendanceMet =
    metrics.attendancePct !== null &&
    metrics.attendancePct >= rules.minAttendancePct;

  const criteria = [
    {
      key: "attendance",
      label: "Attendance",
      required: `${rules.minAttendancePct}% or more`,
      actual:
        metrics.attendancePct === null
          ? "No attendance yet"
          : `${metrics.attendancePct}%`,
      met: attendanceMet,
      progress: Math.min(
        100,
        Math.round(((metrics.attendancePct || 0) / rules.minAttendancePct) * 100)
      ),
    },
    {
      key: "matches",
      label: "Completed matches",
      required: `${rules.minCompletedMatches} or more`,
      actual: String(metrics.completedMatches),
      met: metrics.completedMatches >= rules.minCompletedMatches,
      progress: Math.min(
        100,
        Math.round((metrics.completedMatches / rules.minCompletedMatches) * 100)
      ),
    },
  ];

  const reasons = [];

  if (!criteria[0].met) {
    if (metrics.attendancePct === null) {
      reasons.push(
        "No Present, Late or Absent records yet, so attendance cannot be calculated."
      );
    } else {
      reasons.push(
        `Attendance is ${metrics.attendancePct}%, below the required ${rules.minAttendancePct}% (Excused days are not counted).`
      );
    }
  }

  if (!criteria[1].met) {
    const gap = rules.minCompletedMatches - metrics.completedMatches;
    reasons.push(
      `Has played ${plural(metrics.completedMatches, "completed match", "completed matches")}. ` +
        `${plural(gap, "more match", "more matches")} needed (minimum ${rules.minCompletedMatches}).`
    );
  }

  return { criteria, reasons };
}

// Evaluate Active players against the readiness rules using real records.
//   playerIds : only these players (optional)
//   sports    : only players in any of these sports (optional)
//   select    : Player fields to return with each evaluation
export async function evaluatePlayers({
  playerIds = null,
  sports = null,
  select = "playerId firstName lastName age sport sports position photo status",
} = {}) {
  const playerQuery = { status: "Active" };

  if (playerIds) playerQuery._id = { $in: playerIds };

  if (sports) {
    playerQuery.$or = [
      { sports: { $in: sports } },
      { sport: { $in: sports } },
    ];
  }

  const [players, closedSessions] = await Promise.all([
    Player.find(playerQuery).select(select).sort({ createdAt: -1 }).lean(),
    AttendanceSession.find(CLOSED_SESSION_FILTER).select("_id").lean(),
  ]);

  const result = {
    rules: READINESS_RULES,
    academyClosedSessions: closedSessions.length,
    evaluations: [],
  };

  if (!players.length) return result;

  const ids = players.map((p) => p._id);
  const sessionIds = closedSessions.map((s) => s._id);

  const [attendanceRecords, completedMatches] = await Promise.all([
    sessionIds.length
      ? Attendance.find({
          player: { $in: ids },
          session: { $in: sessionIds },
        })
          .select("player session status")
          .lean()
      : [],
    Match.find({
      status: "Completed",
      "participants.player": { $in: ids },
    })
      .select("participants")
      .lean(),
  ]);

  const attendanceBy = new Map();

  for (const record of attendanceRecords) {
    const id = String(record.player);

    if (!attendanceBy.has(id)) {
      attendanceBy.set(id, {
        sessions: new Set(),
        present: 0,
        late: 0,
        absent: 0,
        excused: 0,
      });
    }

    const item = attendanceBy.get(id);
    item.sessions.add(String(record.session));

    if (record.status === "Present") item.present++;
    else if (record.status === "Late") item.late++;
    else if (record.status === "Absent") item.absent++;
    else if (record.status === "Excused") item.excused++;
  }

  const idSet = new Set(ids.map(String));
  const matchesBy = new Map(); // playerId -> { count, scores[] }

  for (const match of completedMatches) {
    const seen = new Set();

    for (const participant of match.participants || []) {
      const id = String(participant.player);

      if (!idSet.has(id) || seen.has(id)) continue;
      seen.add(id);

      if (!matchesBy.has(id)) matchesBy.set(id, { count: 0, scores: [] });

      const item = matchesBy.get(id);
      item.count++;

      const score = PERFORMANCE_SCORE[participant.performance];
      if (score) item.scores.push(score);
    }
  }

  for (const player of players) {
    const id = String(player._id);
    const att = attendanceBy.get(id);
    const matchInfo = matchesBy.get(id);

    const present = att?.present || 0;
    const late = att?.late || 0;
    const absent = att?.absent || 0;
    const excused = att?.excused || 0;

    const attended = present + late;
    const counted = attended + absent;

    const scores = matchInfo?.scores || [];
    const avg = scores.length
      ? scores.reduce((sum, n) => sum + n, 0) / scores.length
      : null;

    const metrics = {
      recordedSessions: att ? att.sessions.size : 0,
      present,
      late,
      absent,
      excused,
      attended,
      counted,
      attendancePct: counted ? round1((attended / counted) * 100) : null,
      completedMatches: matchInfo?.count || 0,
      ratedMatches: scores.length,
      avgPerformance: avg === null ? null : round1(avg),
      performanceLabel: performanceLabel(avg),
    };

    const { criteria, reasons } = buildCriteria(metrics);

    result.evaluations.push({
      player,
      metrics,
      criteria,
      criteriaMet: criteria.filter((c) => c.met).length,
      ready: criteria.every((c) => c.met),
      reasons,
    });
  }

  return result;
}

// Full player records of everyone who is Ready (used by the Scout view).
export async function getReadyPlayerDocs(select) {
  const { evaluations } = await evaluatePlayers({ select });
  return evaluations.filter((e) => e.ready).map((e) => e.player);
}

// IDs of everyone who is Ready (used by Scout match filtering).
export async function getReadyPlayerIds() {
  const { evaluations } = await evaluatePlayers({ select: "_id" });
  return evaluations.filter((e) => e.ready).map((e) => e.player._id);
}
