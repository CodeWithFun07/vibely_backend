import jwt from "jsonwebtoken";
import ApiError from "../utils/apiError.js";
import { generateAccessToken } from "../utils/tokens.js";
import User from "../models/user.model.js";

const verifyAccessToken = async (req, res, next) => {
  try {
    // Get token from Authorization header (Bearer token)
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(" ")[1]; // "Bearer TOKEN"

    if (!token) {
      throw new ApiError(401, "Access token is required");
    }

    try {
      // Try to verify the access token
      const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
      req.user = { userId: decoded.userId };
      return next();
    } catch (error) {
      // If token is expired, try to refresh it
      if (error.name === "TokenExpiredError") {
        const refreshToken = req.cookies.refreshToken;

        if (!refreshToken) {
          throw new ApiError(401, "Refresh token is required. Please login again.");
        }

        try {
          const decoded = jwt.verify(
            refreshToken,
            process.env.REFRESH_TOKEN_SECRET
          );

          const user = await User.findById(decoded.userId);

          if (!user) {
            throw new ApiError(404, "User not found");
          }

          // Verify that the refresh token matches the one stored in the database
          if (user.refresh_token !== refreshToken) {
            throw new ApiError(401, "Invalid refresh token");
          }

          // Generate new access token
          const newAccessToken = await generateAccessToken(user._id);

          // Set the new access token in response header
          res.setHeader("x-access-token", newAccessToken);

          // Also set it in a custom header for the frontend to catch
          res.setHeader("X-New-Access-Token", "true");

          // Add user info to request
          req.user = { userId: decoded.userId };
          req.newAccessToken = newAccessToken;

          return next();
        } catch (refreshError) {
          if (refreshError.name === "TokenExpiredError") {
            throw new ApiError(401, "Refresh token has expired. Please login again.");
          }
          if (refreshError.name === "JsonWebTokenError") {
            throw new ApiError(401, "Invalid refresh token. Please login again.");
          }
          throw refreshError;
        }
      }

      throw new ApiError(401, "Invalid access token");
    }
  } catch (error) {
    next(error);
  }
};

export { verifyAccessToken };
