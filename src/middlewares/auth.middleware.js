import ApiError from "../utils/apiError.js";
import ApiResponse from "../utils/apiResponse.js";
import jwt from "jsonwebtoken";
import User from "../models/user.model.js";

const isAuthenticated = async (req, res, next) => {
  try {
    const token = req.headers?.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json(new ApiResponse(false, "access token missing", 401, null));
    }

    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

    req.userId = decoded.userId;

    next();
  } catch (error) {
    console.log("authenticated verification failed", error.message);
    return res.status(401).json(new ApiResponse(false, error.message || "Unauthorized", 401, null));
  }
};

/**
 * Middleware to verify if user account is active
 * Should be used after isAuthenticated middleware
 */
const isAccountActive = async (req, res, next) => {
  try {
    if (!req.userId) {
      return res.status(401).json(new ApiResponse(false, "User not authenticated", 401, null));
    }

    const user = await User.findById(req.userId).select("is_active is_banned");

    if (!user) {
      return res.status(404).json(new ApiResponse(false, "User not found", 404, null));
    }

    if (user.is_banned) {
      return res.status(403).json(new ApiResponse(false, "Your account has been banned", 403, null));
    }

    if (!user.is_active) {
      return res.status(403).json(new ApiResponse(false, "Your account is inactive. Please log in again.", 403, null));
    }

    next();
  } catch (error) {
    console.log("Account active verification failed", error.message);
    return res.status(500).json(new ApiResponse(false, error.message || "Internal server error", 500, null));
  }
};

export { isAuthenticated, isAccountActive };
export default isAuthenticated;
