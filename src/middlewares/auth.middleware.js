import ApiError from "../utils/apiError.js";
import ApiResponse from "../utils/apiResponse.js";
import jwt from "jsonwebtoken";

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

export default isAuthenticated;
