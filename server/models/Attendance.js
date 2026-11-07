import mongoose from "mongoose";

// One record = one player on one day (inside one session).
const attendanceSchema = new mongoose.Schema(
  {
    session: { type: mongoose.Schema.Types.ObjectId, ref: "AttendanceSession", required: true },
    player: { type: mongoose.Schema.Types.ObjectId, ref: "Player", required: true, index: true },
    date: { type: String, required: true }, // "YYYY-MM-DD"
    status: { type: String, enum: ["Present", "Absent", "Late", "Excused"], required: true },
    // The player's sports at the time, so old history stays correct if they change sport later.
    sports: { type: [String], default: [] },
    note: { type: String, trim: true, default: "", maxlength: 300 },
    markedAt: { type: Date, default: Date.now },
    // true = created automatically as "Absent" when the session was closed.
    auto: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// A player can only have one record per session.
attendanceSchema.index({ session: 1, player: 1 }, { unique: true });

export default mongoose.model("Attendance", attendanceSchema);
