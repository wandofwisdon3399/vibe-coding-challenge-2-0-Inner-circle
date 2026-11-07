// Sample data for testing SPORTSYNC. Plain data only: no database code here.
// Everything created from this file can be removed again with: node server/seed.js --remove

export const SAMPLE_STAFF = "Sample Data";

// rate = the share of sessions the player attends (used to make attendance predictable).
export const PLAYERS = [
  { first: "Aarav", last: "Sharma", age: 17, sports: ["Football"], position: "Striker", rate: 0.95,
    notes: ["Excellent leadership in training sessions.", "Private: discuss fee waiver with parents."],
    achievements: [["District U-17 Top Scorer", -40], ["Player of the Month, October", -9]] },
  { first: "Vihaan", last: "Verma", age: 16, sports: ["Football"], position: "Midfielder", rate: 0.88,
    notes: ["Great passing range. Needs to work on stamina."], achievements: [["Best Midfielder, City Camp", -30]] },
  { first: "Kabir", last: "Singh", age: 15, sports: ["Football", "Basketball"], position: "Defender", rate: 0.80,
    notes: [], achievements: [] },
  { first: "Arjun", last: "Mehta", age: 18, sports: ["Cricket"], position: "Batsman", rate: 0.92,
    notes: ["Consistent run scorer."], achievements: [["Century in Inter-School Cup", -20]] },
  { first: "Rohan", last: "Gupta", age: 17, sports: ["Cricket"], position: "Bowler", rate: 0.78,
    notes: [], achievements: [] },
  { first: "Ishaan", last: "Joshi", age: 14, sports: ["Cricket"], position: "All-rounder", rate: 0.55,
    notes: ["Private: attendance affected by exams."], achievements: [] },
  { first: "Dev", last: "Patel", age: 16, sports: ["Basketball"], position: "Point Guard", rate: 0.90,
    notes: [], achievements: [["MVP, Hoops Junior League", -25]] },
  { first: "Yash", last: "Nair", age: 19, sports: ["Basketball"], position: "Center", rate: 0.65,
    notes: [], achievements: [] },
  { first: "Ananya", last: "Iyer", age: 15, sports: ["Badminton"], position: "Singles", rate: 0.96,
    notes: ["Strong net play. Very disciplined."], achievements: [["State Under-16 Runner-up", -35], ["District Singles Champion", -60]] },
  { first: "Diya", last: "Reddy", age: 17, sports: ["Badminton", "Tennis"], position: "Doubles", rate: 0.82,
    notes: [], achievements: [["Doubles Winner, Club Open", -15]] },
  { first: "Meera", last: "Kapoor", age: 14, sports: ["Badminton"], position: "Singles", rate: 0.45,
    notes: ["Private: missed many sessions, speak to parents."], achievements: [] },
  { first: "Saanvi", last: "Rao", age: 16, sports: ["Tennis"], position: "Baseline", rate: 0.85,
    notes: [], achievements: [] },
  { first: "Tara", last: "Bose", age: 18, sports: ["Tennis"], position: "Serve and volley", rate: 0.70,
    notes: [], achievements: [] },
  { first: "Neha", last: "Chopra", age: 17, sports: ["Volleyball"], position: "Setter", rate: 0.93,
    notes: ["Natural team captain."], achievements: [["Best Setter, Zonal Tournament", -18]] },
  { first: "Pooja", last: "Menon", age: 16, sports: ["Volleyball"], position: "Spiker", rate: 0.76,
    notes: [], achievements: [] },
  { first: "Riya", last: "Das", age: 15, sports: ["Volleyball"], position: "Libero", rate: 0.60,
    notes: [], achievements: [] },
  { first: "Karan", last: "Malhotra", age: 20, sports: ["Football"], position: "Goalkeeper", rate: 0.70,
    inactive: true, reason: "Left the academy (relocated)", notes: [], achievements: [] },
  { first: "Sneha", last: "Pillai", age: 19, sports: ["Cricket"], position: "Wicketkeeper", rate: 0.50,
    inactive: true, reason: "Moved to another academy", notes: [], achievements: [] },
];

// day = days from today (negative = in the past). Players are listed by first name.
// Performance: Excellent / Good / Average / Needs Improvement
export const MATCHES = [
  // Completed
  { title: "Academy League Round 1", sport: "Football", day: -12, opponent: "Blue Eagles FC", venue: "Academy Ground", status: "Completed", result: "Won 3-1",
    players: [["Aarav", "Excellent"], ["Vihaan", "Good"], ["Kabir", "Average"]] },
  { title: "Inter-Academy Friendly", sport: "Football", day: -6, opponent: "City Strikers", venue: "City Stadium", status: "Completed", result: "Lost 1-2",
    players: [["Aarav", "Good"], ["Vihaan", "Good"], ["Kabir", "Needs Improvement"]] },
  { title: "T20 Practice Match", sport: "Cricket", day: -10, opponent: "Royal Colts", venue: "Academy Ground", status: "Completed", result: "Won by 24 runs",
    players: [["Arjun", "Excellent"], ["Rohan", "Good"], ["Ishaan", "Average"]] },
  { title: "Weekend Cup", sport: "Cricket", day: -4, opponent: "Green Valley CC", venue: "Green Valley Oval", status: "Completed", result: "Lost by 3 wickets",
    players: [["Arjun", "Good"], ["Rohan", "Average"]] },
  { title: "Hoops Challenge", sport: "Basketball", day: -8, opponent: "Court Kings", venue: "Indoor Court", status: "Completed", result: "Won 54-48",
    players: [["Dev", "Excellent"], ["Yash", "Good"], ["Kabir", "Good"]] },
  { title: "Doubles Open", sport: "Badminton", day: -7, opponent: "Smash Club", venue: "Indoor Arena", status: "Completed", result: "Won 2-1",
    players: [["Ananya", "Excellent"], ["Diya", "Good"], ["Meera", "Average"]] },
  { title: "Club Singles Meet", sport: "Badminton", day: -3, opponent: "Feather Club", venue: "Indoor Arena", status: "Completed", result: "Lost 1-2",
    players: [["Ananya", "Good"], ["Diya", "Average"]] },
  { title: "Spike Series Game 1", sport: "Volleyball", day: -5, opponent: "Net Ninjas", venue: "Indoor Court", status: "Completed", result: "Won 3-2",
    players: [["Neha", "Excellent"], ["Pooja", "Good"], ["Riya", "Average"]] },
  { title: "Spike Series Game 2", sport: "Volleyball", day: -2, opponent: "Beach Blasters", venue: "Indoor Court", status: "Completed", result: "Won 3-0",
    players: [["Neha", "Excellent"], ["Pooja", "Excellent"]] },
  { title: "Open Doubles", sport: "Tennis", day: -9, opponent: "Baseline Club", venue: "Tennis Courts", status: "Completed", result: "Won 2-0",
    players: [["Saanvi", "Good"], ["Tara", "Average"], ["Diya", "Good"]] },
  // Upcoming
  { title: "League Round 2", sport: "Football", day: 2, opponent: "Blue Eagles FC", venue: "Academy Ground", status: "Upcoming",
    players: [["Aarav"], ["Vihaan"], ["Kabir"]] },
  { title: "T20 Cup Quarter Final", sport: "Cricket", day: 5, opponent: "Royal Colts", venue: "Academy Ground", status: "Upcoming",
    players: [["Arjun"], ["Rohan"], ["Ishaan"]] },
  { title: "State Qualifier", sport: "Badminton", day: 9, opponent: "State Selection Panel", venue: "State Arena", status: "Upcoming",
    players: [["Ananya"], ["Diya"], ["Meera"]] },
  { title: "Hoops Challenge Round 2", sport: "Basketball", day: 12, opponent: "Court Kings", venue: "Indoor Court", status: "Upcoming",
    players: [["Dev"], ["Yash"]] },
  // Past date but no result yet (shows the "waiting for a result" warning on the dashboard)
  { title: "Zonal Match", sport: "Volleyball", day: -1, opponent: "Zone Warriors", venue: "Indoor Court", status: "Upcoming",
    players: [["Neha"], ["Pooja"], ["Riya"]] },
  // Cancelled
  { title: "Rain-affected Tie", sport: "Tennis", day: -1, opponent: "Court Masters", venue: "Tennis Courts", status: "Cancelled",
    players: [["Saanvi"], ["Tara"]] },
];

// Small repeatable shuffle, so the same player always gets the same absent days.
function seededOrder(n, seed) {
  const order = [...Array(n).keys()];
  let x = seed * 9301 + 49297;
  for (let i = n - 1; i > 0; i--) {
    x = (x * 9301 + 49297) % 233280;
    const j = Math.floor((x / 233280) * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

// Returns { Aarav: ["Present", "Late", "Absent", ...], ... } with one status per session.
// Inactive players only have records for the first sessions (before they left).
export function buildAttendance(sessionCount) {
  const result = {};
  PLAYERS.forEach((player, index) => {
    const count = player.inactive ? Math.min(6, sessionCount) : sessionCount;
    const absences = Math.round((1 - player.rate) * count);
    const absentDays = new Set(seededOrder(count, index + 1).slice(0, absences));
    let excusedUsed = false;
    const statuses = [];
    for (let day = 0; day < count; day++) {
      if (absentDays.has(day)) {
        // Low-attendance players get one valid (Excused) absence, which is not counted against them.
        if (player.rate < 0.7 && !excusedUsed) { statuses.push("Excused"); excusedUsed = true; }
        else statuses.push("Absent");
      } else {
        statuses.push((day + index) % 5 === 0 ? "Late" : "Present");
      }
    }
    result[player.first] = statuses;
  });
  return result;
}

export function completedMatchCount(first) {
  return MATCHES.filter((m) => m.status === "Completed" && m.players.some(([name]) => name === first)).length;
}

// Attendance % = (Present + Late) / (Present + Late + Absent). Excused is ignored.
export function attendancePercent(statuses) {
  const attended = statuses.filter((s) => s === "Present" || s === "Late").length;
  const counted = attended + statuses.filter((s) => s === "Absent").length;
  return counted ? Math.round((attended / counted) * 1000) / 10 : null;
}
