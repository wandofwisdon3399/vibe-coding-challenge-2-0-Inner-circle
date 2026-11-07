
import express from "express";
import crypto from "crypto";
import bcrypt from "bcryptjs";

import Coach from "../models/Coach.js";
import User from "../models/User.js";
import { authenticate, authorizeRoles } from "../middleware/auth.js";

const router = express.Router();

router.use(authenticate, authorizeRoles("admin"));

const clean = (value, max = 200) =>
  String(value ?? "").trim().slice(0, max);

const generateTemporaryPassword = () =>
  crypto.randomBytes(15).toString("base64url");

// GET ALL COACHES
router.get("/", async (_req, res) => {
  try {
    const coaches = await Coach.find()
      .populate("user", "username isActive lastLogin")
      .sort({ createdAt: -1 });

    res.json(coaches);
  } catch (error) {
    console.error("Load coaches error:", error.message);
    res.status(500).json({ message: "Failed to load coaches." });
  }
});

// GET ONE COACH
router.get("/:id", async (req, res) => {
  try {
    if (!/^[a-f\d]{24}$/i.test(req.params.id)) {
      return res.status(400).json({ message: "Invalid coach ID." });
    }

    const coach = await Coach.findById(req.params.id)
      .populate("user", "username isActive lastLogin");

    if (!coach) {
      return res.status(404).json({ message: "Coach not found." });
    }

    res.json(coach);
  } catch (error) {
    console.error("Load coach error:", error.message);
    res.status(500).json({ message: "Failed to load coach." });
  }
});

// CREATE COACH + LOGIN ACCOUNT
router.post("/", async (req, res) => {
  let createdUser = null;

  try {
    const {
      name,
      phone,
      email,
      photo,
      designation,
      qualifications,
      experience,
      joiningDate,
      assignedSports,
      notes,
    } = req.body || {};

    const normalizedName = clean(name);
    const normalizedPhone = clean(phone, 30);
    const normalizedEmail = clean(email, 150).toLowerCase();
    const normalizedSports = Array.isArray(assignedSports)
      ? [...new Set(assignedSports.map((s) => clean(s, 50)).filter(Boolean))]
      : [];

    if (!normalizedName || !normalizedPhone || !normalizedEmail) {
      return res.status(400).json({
        message: "Name, phone and email are required.",
      });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return res.status(400).json({ message: "Enter a valid email address." });
    }

    if (
      experience === undefined ||
      experience === null ||
      experience === "" ||
      !Number.isFinite(Number(experience)) ||
      Number(experience) < 0
    ) {
      return res.status(400).json({
        message: "Experience must be a valid non-negative number.",
      });
    }

    if (!joiningDate || Number.isNaN(Date.parse(joiningDate))) {
      return res.status(400).json({
        message: "A valid joining date is required.",
      });
    }

    if (!normalizedSports.length) {
      return res.status(400).json({
        message: "Assign at least one sport to the coach.",
      });
    }

    const existingCoach = await Coach.findOne({ email: normalizedEmail });
    const existingUser = await User.findOne({ username: normalizedEmail });

    if (existingCoach || existingUser) {
      return res.status(409).json({
        message: "An account with this email already exists.",
      });
    }

    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, 12);

    createdUser = await User.create({
      username: normalizedEmail,
      passwordHash,
      role: "coach",
      isActive: true,
      assignedSports: normalizedSports,
      mustChangePassword: true,
    });

    const coach = await Coach.create({
      name: normalizedName,
      phone: normalizedPhone,
      email: normalizedEmail,
      photo: clean(photo, 2_000_000),
      designation: clean(designation, 100) || "Coach",
      qualifications: clean(qualifications, 1000),
      experience: Number(experience),
      joiningDate: new Date(joiningDate),
      assignedSports: normalizedSports,
      notes: clean(notes, 2000),
      status: "Active",
      user: createdUser._id,
    });

    res.status(201).json({
      message: "Coach and login account created successfully.",
      coach,
      credentials: {
        username: normalizedEmail,
        temporaryPassword,
        mustChangePassword: true,
      },
    });
  } catch (error) {
    // If profile creation fails, remove the account created above.
    if (createdUser) {
      await User.deleteOne({ _id: createdUser._id }).catch(() => {});
    }

    if (error.code === 11000) {
      return res.status(409).json({
        message: "This coach or login account already exists.",
      });
    }

    console.error("Create coach error:", error.message);
    res.status(500).json({ message: "Failed to create coach." });
  }
});

// UPDATE COACH
router.patch("/:id", async (req, res) => {
  try {
    if (!/^[a-f\d]{24}$/i.test(req.params.id)) {
      return res.status(400).json({ message: "Invalid coach ID." });
    }

    const coach = await Coach.findById(req.params.id);

    if (!coach) {
      return res.status(404).json({ message: "Coach not found." });
    }

    const allowedFields = [
      "name",
      "phone",
      "photo",
      "designation",
      "qualifications",
      "experience",
      "joiningDate",
      "assignedSports",
      "notes",
    ];

    for (const field of allowedFields) {
      if (Object.hasOwn(req.body, field)) {
        coach[field] = req.body[field];
      }
    }

    if (Object.hasOwn(req.body, "experience")) {
      const value = Number(req.body.experience);

      if (!Number.isFinite(value) || value < 0) {
        return res.status(400).json({
          message: "Experience must be a non-negative number.",
        });
      }

      coach.experience = value;
    }

    if (Object.hasOwn(req.body, "assignedSports")) {
      if (
        !Array.isArray(req.body.assignedSports) ||
        req.body.assignedSports.length === 0
      ) {
        return res.status(400).json({
          message: "Assign at least one sport.",
        });
      }

      coach.assignedSports = [
        ...new Set(req.body.assignedSports.map((s) => clean(s, 50)).filter(Boolean)),
      ];
    }

    if (Object.hasOwn(req.body, "joiningDate")) {
      const date = new Date(req.body.joiningDate);

      if (Number.isNaN(date.getTime())) {
        return res.status(400).json({ message: "Invalid joining date." });
      }

      coach.joiningDate = date;
    }

    await coach.save();

    if (coach.user) {
      await User.findByIdAndUpdate(coach.user, {
        $set: { assignedSports: coach.assignedSports },
      });
    }

    res.json({
      message: "Coach updated successfully.",
      coach,
    });
  } catch (error) {
    console.error("Update coach error:", error.message);
    res.status(500).json({ message: "Failed to update coach." });
  }
});

// ACTIVATE / DEACTIVATE COACH
router.patch("/:id/status", async (req, res) => {
  try {
    if (!/^[a-f\d]{24}$/i.test(req.params.id)) {
      return res.status(400).json({ message: "Invalid coach ID." });
    }

    const { status } = req.body || {};

    if (!["Active", "Inactive"].includes(status)) {
      return res.status(400).json({
        message: "Status must be Active or Inactive.",
      });
    }

    const coach = await Coach.findById(req.params.id);

    if (!coach) {
      return res.status(404).json({ message: "Coach not found." });
    }

    coach.status = status;
    await coach.save();

    if (coach.user) {
      await User.findByIdAndUpdate(coach.user, {
        $set: { isActive: status === "Active" },
      });
    }

    res.json({
      message: `Coach ${status.toLowerCase()} successfully.`,
      coach,
    });
  } catch (error) {
    console.error("Coach status error:", error.message);
    res.status(500).json({ message: "Failed to update coach status." });
  }
});

export default router;
