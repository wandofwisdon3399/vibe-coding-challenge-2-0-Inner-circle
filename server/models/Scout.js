import mongoose from "mongoose";

const scoutSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },

    phone: { type: String, required: true, trim: true },

    // Also used as the login username
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    photo: { type: String, default: "" },

    designation: { type: String, default: "Scout", trim: true },

    // Club / agency / organisation the scout represents
    organization: { type: String, default: "", trim: true },

    // Decimal values allowed, e.g. 2.5 years
    experience: { type: Number, required: true, min: 0, default: 0 },

    joiningDate: { type: Date, required: true },

    notes: { type: String, default: "" },

    status: {
      type: String,
      enum: ["Active", "Inactive"],
      default: "Active",
    },

    // Linked login account
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      unique: true,
      sparse: true,
      default: null,
    },

    // Identity of the Admin who created / last changed this record
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true }
);

const Scout = mongoose.model("Scout", scoutSchema);

export default Scout;
