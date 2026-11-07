
import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    // Login ID: email for staff, Player ID for students
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },

    passwordHash: {
      type: String,
      required: true,
      select: false,
    },

    role: {
      type: String,
      enum: ["admin", "coach", "scout", "player"],
      required: true,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    // Used for Coach accounts
    assignedSports: {
      type: [String],
      default: [],
    },

    // Used for Player accounts
    player: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Player",
      default: null,
    },

    mustChangePassword: {
      type: Boolean,
      default: true,
    },

    lastLogin: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

const User = mongoose.model("User", userSchema);

export default User;
