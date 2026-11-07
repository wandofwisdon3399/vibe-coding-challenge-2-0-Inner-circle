
import mongoose from "mongoose";

const coachSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    phone: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    photo: {
      type: String,
      default: "",
    },

    designation: {
      type: String,
      default: "Coach",
      trim: true,
    },

    qualifications: {
      type: String,
      default: "",
      trim: true,
    },

    experience: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },

    joiningDate: {
      type: Date,
      required: true,
    },

    assignedSports: {
      type: [String],
      required: true,
      validate: {
        validator: (sports) => sports.length > 0,
        message: "A coach must be assigned at least one sport.",
      },
    },

    notes: {
      type: String,
      default: "",
    },

    status: {
      type: String,
      enum: ["Active", "Inactive"],
      default: "Active",
    },

    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      unique: true,
      sparse: true,
      default: null,
    },
  },
  { timestamps: true }
);

const Coach = mongoose.model("Coach", coachSchema);

export default Coach;
