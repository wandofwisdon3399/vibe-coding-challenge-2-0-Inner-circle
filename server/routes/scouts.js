import express from "express";
import crypto from "crypto";
import bcrypt from "bcryptjs";

import Scout from "../models/Scout.js";
import User from "../models/User.js";
import { authenticate, authorizeRoles } from "../middleware/auth.js";

const router = express.Router();

// Scout accounts are managed by the Admin only.
router.use(authenticate, authorizeRoles("admin"));

const OBJECT_ID = /^[a-f\d]{24}$/i;

const clean = (value, max = 200) =>
  String(value ?? "").trim().slice(0, max);

const generateTemporaryPassword = () =>
  crypto.randomBytes(15).toString("base64url");

const validExperience = (value) =>
  value !== undefined &&
  value !== null &&
  value !== "" &&
  Number.isFinite(Number(value)) &&
  Number(value) >= 0;

// GET ALL SCOUTS
router.get("/", async (_req, res) => {
  try {
    const scouts = await Scout.find()
      .populate("user", "username isActive lastLogin mustChangePassword")
      .sort({ createdAt: -1 });

    res.json(scouts);
  } catch (error) {
    console.error("Load scouts error:", error.message);
    res.status(500).json({ message: "Failed to load scouts." });
  }
});

// GET ONE SCOUT
router.get("/:id", async (req, res) => {
  try {
    if (!OBJECT_ID.test(req.params.id)) {
      return res.status(400).json({ message: "Invalid scout ID." });
    }

    const scout = await Scout.findById(req.params.id).populate(
      "user",
      "username isActive lastLogin mustChangePassword"
    );

    if (!scout) {
      return res.status(404).json({ message: "Scout not found." });
    }

    res.json(scout);
  } catch (error) {
    console.error("Load scout error:", error.message);
    res.status(500).json({ message: "Failed to load scout." });
  }
});

// CREATE SCOUT + LOGIN ACCOUNT
router.post("/", async (req, res) => {
  let createdUser = null;

  try {
    const {
      name,
      phone,
      email,
      photo,
      designation,
      organization,
      experience,
      joiningDate,
      notes,
    } = req.body || {};

    const normalizedName = clean(name);
    const normalizedPhone = clean(phone, 30);
    const normalizedEmail = clean(email, 150).toLowerCase();

    if (!normalizedName || !normalizedPhone || !normalizedEmail) {
      return res.status(400).json({
        message: "Name, phone and email are required.",
      });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return res.status(400).json({ message: "Enter a valid email address." });
    }

    if (!validExperience(experience)) {
      return res.status(400).json({
        message: "Experience must be a valid non-negative number.",
      });
    }

    if (!joiningDate || Number.isNaN(Date.parse(joiningDate))) {
      return res.status(400).json({
        message: "A valid joining date is required.",
      });
    }

    const existingScout = await Scout.findOne({ email: normalizedEmail });
    const existingUser = await User.findOne({ username: normalizedEmail });

    if (existingScout || existingUser) {
      return res.status(409).json({
        message: "An account with this email already exists.",
      });
    }

    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, 12);

    createdUser = await User.create({
      username: normalizedEmail,
      passwordHash,
      role: "scout",
      isActive: true,
      assignedSports: [],
      mustChangePassword: true,
    });

    const scout = await Scout.create({
      name: normalizedName,
      phone: normalizedPhone,
      email: normalizedEmail,
      photo: clean(photo, 2_000_000),
      designation: clean(designation, 100) || "Scout",
      organization: clean(organization, 200),
      experience: Number(experience),
      joiningDate: new Date(joiningDate),
      notes: clean(notes, 2000),
      status: "Active",
      user: createdUser._id,
      createdBy: req.user._id,
      updatedBy: req.user._id,
    });

    res.status(201).json({
      message: "Scout and login account created successfully.",
      scout,
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
        message: "This scout or login account already exists.",
      });
    }

    console.error("Create scout error:", error.message);
    res.status(500).json({ message: "Failed to create scout." });
  }
});

// UPDATE SCOUT DETAILS (email/login username is not editable)
router.patch("/:id", async (req, res) => {
  try {
    if (!OBJECT_ID.test(req.params.id)) {
      return res.status(400).json({ message: "Invalid scout ID." });
    }

    const scout = await Scout.findById(req.params.id);

    if (!scout) {
      return res.status(404).json({ message: "Scout not found." });
    }

    const body = req.body || {};

    if (Object.hasOwn(body, "name")) {
      const value = clean(body.name);
      if (!value) {
        return res.status(400).json({ message: "Name is required." });
      }
      scout.name = value;
    }

    if (Object.hasOwn(body, "phone")) {
      const value = clean(body.phone, 30);
      if (!value) {
        return res.status(400).json({ message: "Phone is required." });
      }
      scout.phone = value;
    }

    if (Object.hasOwn(body, "photo")) scout.photo = clean(body.photo, 2_000_000);
    if (Object.hasOwn(body, "designation")) {
      scout.designation = clean(body.designation, 100) || "Scout";
    }
    if (Object.hasOwn(body, "organization")) {
      scout.organization = clean(body.organization, 200);
    }
    if (Object.hasOwn(body, "notes")) scout.notes = clean(body.notes, 2000);

    if (Object.hasOwn(body, "experience")) {
      if (!validExperience(body.experience)) {
        return res.status(400).json({
          message: "Experience must be a non-negative number.",
        });
      }
      scout.experience = Number(body.experience);
    }

    if (Object.hasOwn(body, "joiningDate")) {
      const date = new Date(body.joiningDate);
      if (Number.isNaN(date.getTime())) {
        return res.status(400).json({ message: "Invalid joining date." });
      }
      scout.joiningDate = date;
    }

    scout.updatedBy = req.user._id;
    await scout.save();

    res.json({
      message: "Scout updated successfully.",
      scout,
    });
  } catch (error) {
    console.error("Update scout error:", error.message);
    res.status(500).json({ message: "Failed to update scout." });
  }
});

// ACTIVATE / DEACTIVATE SCOUT (also enables / disables the login account)
router.patch("/:id/status", async (req, res) => {
  try {
    if (!OBJECT_ID.test(req.params.id)) {
      return res.status(400).json({ message: "Invalid scout ID." });
    }

    const { status } = req.body || {};

    if (!["Active", "Inactive"].includes(status)) {
      return res.status(400).json({
        message: "Status must be Active or Inactive.",
      });
    }

    const scout = await Scout.findById(req.params.id);

    if (!scout) {
      return res.status(404).json({ message: "Scout not found." });
    }

    scout.status = status;
    scout.updatedBy = req.user._id;
    await scout.save();

    if (scout.user) {
      await User.findByIdAndUpdate(scout.user, {
        $set: { isActive: status === "Active" },
      });
    }

    res.json({
      message: `Scout ${status.toLowerCase()} successfully.`,
      scout,
    });
  } catch (error) {
    console.error("Scout status error:", error.message);
    res.status(500).json({ message: "Failed to update scout status." });
  }
});

export default router;
