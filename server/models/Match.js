import mongoose from "mongoose";

export const PERFORMANCE_LEVELS = ["Excellent", "Good", "Average", "Needs Improvement"];

// One player who took part in a match, with how they performed.
const participantSchema = new mongoose.Schema(
  {
    player: { type: mongoose.Schema.Types.ObjectId, ref: "Player", required: true },
    performance: { type: String, enum: [...PERFORMANCE_LEVELS, ""], default: "" },
  },
  { _id: false }
);

const matchSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    sport: { type: String, required: true, trim: true, maxlength: 80 },
    date: { type: Date, required: true },
    venue: { type: String, trim: true, default: "", maxlength: 160 },
    opponent: { type: String, trim: true, default: "", maxlength: 120 },
    status: { type: String, enum: ["Upcoming", "Completed", "Cancelled"], default: "Upcoming" },
    result: { type: String, trim: true, default: "", maxlength: 160 },
    participants: { type: [participantSchema], default: [] },
    resultRecordedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export default mongoose.model("Match", matchSchema);
