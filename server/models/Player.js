import mongoose from "mongoose";

const noteSchema = new mongoose.Schema(
  {
    text: { type: String, required: true, trim: true, maxlength: 2000 },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const achievementSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, trim: true, maxlength: 1000, default: "" },
    date: { type: Date, default: null },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const playerSchema = new mongoose.Schema(
  {
    // Auto-generated, e.g. SA-0001. Never edited by hand.
    playerId: { type: String, trim: true, unique: true, sparse: true },
    firstName: { type: String, required: true, trim: true, maxlength: 80 },
    lastName: { type: String, required: true, trim: true, maxlength: 80 },
    age: { type: Number, required: true, min: 5, max: 100 },
    // "sport" is the main sport (first in the list). "sports" holds all of them.
    sport: { type: String, required: true, trim: true, maxlength: 80 },
    sports: { type: [String], default: [] },
    phone: { type: String, trim: true, default: "", maxlength: 30 },
    email: { type: String, trim: true, lowercase: true, default: "", maxlength: 160 },
    position: { type: String, trim: true, default: "", maxlength: 80 },
    status: { type: String, enum: ["Active", "Inactive"], default: "Active" },
    statusReason: { type: String, trim: true, default: "", maxlength: 300 },
    photo: { type: String, default: "" },
    notes: { type: [noteSchema], default: [] },
    achievements: { type: [achievementSchema], default: [] },
    // Linked login account (username = Player ID)
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

const Player = mongoose.model("Player", playerSchema);
export default Player;
