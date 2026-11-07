
import express from "express";
import cookieParser from "cookie-parser";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";

import authRoutes from "./routes/auth.js";
import playersRouter from "./routes/player.js";
import matchesRouter from "./routes/matches.js";
import attendanceRouter from "./routes/attendance.js";
import coachesRouter from "./routes/coaches.js";
import scoutsRouter from "./routes/scouts.js";
import readinessRouter from "./routes/readiness.js";

import { backfillPlayers } from "./utils/playerSetup.js";

dotenv.config();

const app = express();

// The hosting platform (Render) sits behind a proxy, so trust it for HTTPS detection.
app.set("trust proxy", 1);

// Allowed browser origins: local development plus any production site(s)
// listed in CLIENT_ORIGIN (comma-separated, e.g. https://my-academy.vercel.app).
// In production the Vercel site proxies /api to this server, so requests
// are same-origin for the browser and CORS is only a safety net.
const extraOrigins = (process.env.CLIENT_ORIGIN || "")
  .split(",")
  .map((origin) => origin.trim().replace(/\/$/, ""))
  .filter(Boolean);

// Middleware
app.use(
  cors({
    origin(origin, callback) {
      if (
        !origin ||
        /^http:\/\/localhost:\d+$/.test(origin) ||
        extraOrigins.includes(origin)
      ) {
        return callback(null, true);
      }

      return callback(null, false);
    },
    credentials: true,
  })
);

// API responses are private and per-user: never let a CDN or browser cache them.
app.use("/api", (req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

app.use(express.json({ limit: "10mb" }));
app.use(cookieParser());

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/players", playersRouter);
app.use("/api/matches", matchesRouter);
app.use("/api/attendance", attendanceRouter);
app.use("/api/coaches", coachesRouter);
app.use("/api/scouts", scoutsRouter);
app.use("/api/readiness", readinessRouter);

// Unknown /api routes must answer with JSON, never an HTML page
// Home route
app.get("/", (req, res) => {
  res.json({
    message: "Sports Academy API is running!",
  });
});

// Database health check
app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    database:
      mongoose.connection.readyState === 1
        ? "Connected"
        : "Disconnected",
  });
});

// Unknown /api routes must answer with JSON, never an HTML page
app.use("/api", (req, res) => {
  res.status(404).json({
    message: `API route not found: ${req.method} ${req.originalUrl}`,
  });
});

// Last-resort error handler (always JSON)
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err.message);
  if (res.headersSent) return next(err);
  const status = err.type === "entity.too.large" ? 413 : err.status || 500;
  res.status(status).json({
    message:
      status === 413
        ? "Request too large (try a smaller photo)."
        : "Server error.",
  });
});

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error("MONGODB_URI is missing from the .env file");
    }

    if (!process.env.JWT_SECRET) {
      throw new Error("JWT_SECRET is missing from the .env file");
    }

    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
    });

    console.log("MongoDB connected successfully!");

    // Backfill existing player records
    try {
      await backfillPlayers();
    } catch (error) {
      console.error("Player update step failed:", error.message);
    }

    // Express 5 passes startup errors (e.g. port already in use) to this callback
    app.listen(PORT, (listenError) => {
      if (listenError) {
        console.error(
          listenError.code === "EADDRINUSE"
            ? `Port ${PORT} is already in use. Stop the old backend process, then start again.`
            : `Server failed to start: ${listenError.message}`
        );
        process.exit(1);
      }
      console.log(`Server running at http://localhost:${PORT}`);
      console.log("Coach API mounted at /api/coaches");
      console.log("Scout API mounted at /api/scouts");
      console.log("Readiness API mounted at /api/readiness");
    });

  } catch (error) {
    console.error("Failed to start the server:", error.message);
    process.exit(1);
  }
}

startServer();
