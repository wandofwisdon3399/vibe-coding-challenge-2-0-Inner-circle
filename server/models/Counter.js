import mongoose from "mongoose";

// Keeps running numbers (used to create Player IDs like SA-0001).
const counterSchema = new mongoose.Schema({
  _id: { type: String },
  seq: { type: Number, default: 0 },
});

export default mongoose.model("Counter", counterSchema);
