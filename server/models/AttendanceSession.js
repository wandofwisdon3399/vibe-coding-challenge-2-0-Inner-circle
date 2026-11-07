import mongoose from "mongoose";

const reopenSchema = new mongoose.Schema(
  {
    reopenedAt: { type: Date, default: Date.now },
    reason: { type: String, required: true, trim: true, maxlength: 300 },
    by: { type: String, trim: true, default: "", maxlength: 120 },
    previouslyClosedBy: { type: String, default: "" },
    previouslyClosedAt: { type: Date, default: null },
  },
  { _id: false }
);

// One session per day for the whole academy.
const sessionSchema = new mongoose.Schema(
  {
    date: {
      type: String, // "YYYY-MM-DD" (plain text avoids time-zone bugs)
      required: true,
      unique: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
    },
    status: { type: String, enum: ["Open", "Closed"], default: "Open" },
    startedBy: { type: String, trim: true, default: "", maxlength: 120 },
    startedAt: { type: Date, default: Date.now },
    closedBy: { type: String, trim: true, default: "", maxlength: 120 },
    closedAt: { type: Date, default: null },
    reopenHistory: { type: [reopenSchema], default: [] },
  },
  { timestamps: true }
);

export default mongoose.model("AttendanceSession", sessionSchema);
