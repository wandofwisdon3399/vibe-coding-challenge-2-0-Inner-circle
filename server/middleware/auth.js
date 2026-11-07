
import jwt from "jsonwebtoken";
import User from "../models/User.js";

// Verify the user's login session.
// Unless allowPasswordChangePending is true, accounts that still have a
// temporary password are blocked from every route until it is changed.
const buildAuthenticator = (allowPasswordChangePending) => async (req, res, next) => {
  try {
    const token = req.cookies?.sportsync_token;

    if (!token) {
      return res.status(401).json({
        message: "Authentication required.",
      });
    }

    if (!process.env.JWT_SECRET) {
      throw new Error("JWT_SECRET is missing.");
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.userId);

    if (!user || !user.isActive) {
      return res.status(401).json({
        message: "Account not found or deactivated.",
      });
    }

    if (user.mustChangePassword && !allowPasswordChangePending) {
      return res.status(403).json({
        code: "PASSWORD_CHANGE_REQUIRED",
        message: "You must change your temporary password before continuing.",
      });
    }

    req.user = user;

    next();
  } catch (error) {
    return res.status(401).json({
      message: "Invalid or expired login session.",
    });
  }
};

export const authenticate = buildAuthenticator(false);

// Only for /me and /change-password
export const authenticateAllowPasswordChange = buildAuthenticator(true);

// Restrict access according to account role
export const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        message: "Authentication required.",
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        message: "You do not have permission to access this resource.",
      });
    }

    next();
  };
};
