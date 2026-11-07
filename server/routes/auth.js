import crypto from "crypto";
import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { authenticateAllowPasswordChange } from "../middleware/auth.js";

const router = express.Router();

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
};


// INITIAL ADMIN SETUP
router.post("/setup-admin", async (req, res) => {
  try {
    const { username, password, setupKey } = req.body;

    if (!process.env.ADMIN_SETUP_KEY) {
      return res.status(500).json({
        message: "Admin setup is not configured.",
      });
    }

    if (
      typeof setupKey !== "string" ||
      setupKey.length !== process.env.ADMIN_SETUP_KEY.length ||
      !crypto.timingSafeEqual(
        Buffer.from(setupKey),
        Buffer.from(process.env.ADMIN_SETUP_KEY)
      )
    ) {
      return res.status(403).json({
        message: "Invalid setup key.",
      });
    }

    const existingAdmin = await User.findOne({
      role: "admin",
    });

    if (existingAdmin) {
      return res.status(403).json({
        message: "Admin account already exists.",
      });
    }

    if (
      typeof username !== "string" ||
      !/^[a-zA-Z0-9._-]{3,40}$/.test(username)
    ) {
      return res.status(400).json({
        message: "Username must be 3-40 valid characters.",
      });
    }

    if (
      typeof password !== "string" ||
      password.length < 12 ||
      password.length > 128
    ) {
      return res.status(400).json({
        message: "Password must contain 12-128 characters.",
      });
    }

    const normalizedUsername = username.toLowerCase();

    const existingUser = await User.findOne({
      username: normalizedUsername,
    });

    if (existingUser) {
      return res.status(409).json({
        message: "This username is already taken.",
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const admin = await User.create({
      username: normalizedUsername,
      passwordHash,
      role: "admin",
      isActive: true,
      mustChangePassword: false,
    });

    return res.status(201).json({
      message: "Initial Admin account created successfully.",
      user: {
        id: admin._id,
        username: admin.username,
        role: admin.role,
      },
    });

  } catch (error) {
    console.error("Admin setup error:", error.message);

    return res.status(500).json({
      message: "Unable to create Admin account.",
    });
  }
});

// LOGIN
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        message: "Username and password are required.",
      });
    }

    if (!process.env.JWT_SECRET) {
      throw new Error("JWT_SECRET is missing.");
    }

    const user = await User.findOne({
      username: username.trim().toLowerCase(),
    }).select("+passwordHash");

    if (!user || !user.isActive) {
      return res.status(401).json({
        message: "Invalid username or password.",
      });
    }

    const passwordMatches = await bcrypt.compare(
      password,
      user.passwordHash
    );

    if (!passwordMatches) {
      return res.status(401).json({
        message: "Invalid username or password.",
      });
    }

    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    user.lastLogin = new Date();
    await user.save();

    res.cookie("sportsync_token", token, {
      ...cookieOptions,
      maxAge: 24 * 60 * 60 * 1000,
    });

    return res.json({
      message: "Login successful.",
      user: {
        id: user._id,
        username: user.username,
        role: user.role,
        assignedSports: user.assignedSports,
        player: user.player,
        mustChangePassword: user.mustChangePassword,
      },
    });
  } catch (error) {
    console.error("Login error:", error.message);

    return res.status(500).json({
      message: "Unable to process login.",
    });
  }
});

// LOGOUT
router.post("/logout", (req, res) => {
  res.clearCookie("sportsync_token", cookieOptions);

  return res.json({
    message: "Logged out successfully.",
  });
});

// CURRENT LOGGED-IN USER
router.get("/me", authenticateAllowPasswordChange, (req, res) => {
  const user = req.user;

  return res.json({
    user: {
      id: user._id,
      username: user.username,
      role: user.role,
      assignedSports: user.assignedSports,
      player: user.player,
      mustChangePassword: user.mustChangePassword,
    },
  });
});

// CHANGE PASSWORD (also used for the mandatory first-login change)
router.post(
  "/change-password",
  authenticateAllowPasswordChange,
  async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body || {};

      if (
        typeof currentPassword !== "string" ||
        typeof newPassword !== "string" ||
        !currentPassword ||
        !newPassword
      ) {
        return res.status(400).json({
          message: "Current password and new password are required.",
        });
      }

      if (newPassword.length < 12 || newPassword.length > 128) {
        return res.status(400).json({
          message: "New password must contain 12-128 characters.",
        });
      }

      if (newPassword === currentPassword) {
        return res.status(400).json({
          message: "New password must be different from the current password.",
        });
      }

      const user = await User.findById(req.user._id).select("+passwordHash");

      const matches = await bcrypt.compare(currentPassword, user.passwordHash);

      if (!matches) {
        return res.status(401).json({
          message: "Current password is incorrect.",
        });
      }

      user.passwordHash = await bcrypt.hash(newPassword, 12);
      user.mustChangePassword = false;
      await user.save();

      return res.json({
        message: "Password changed successfully.",
        user: {
          id: user._id,
          username: user.username,
          role: user.role,
          assignedSports: user.assignedSports,
          player: user.player,
          mustChangePassword: false,
        },
      });
    } catch (error) {
      console.error("Change password error:", error.message);

      return res.status(500).json({
        message: "Unable to change password.",
      });
    }
  }
);

export default router;
