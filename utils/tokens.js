import jwt from "jsonwebtoken";

const generateAccessToken = async (userId) => {
  const payload = { userId };

  const accessToken = jwt.sign(payload, process.env.ACCESS_TOKEN_SECRET, {
    expiresIn: "15m",
  });
  return accessToken;
};

const generateRefreshToken = async (userId) => {
  const payload = { userId };

  const refreshToken = jwt.sign(payload, process.env.REFRESH_TOKEN_SECRET, {
    expiresIn: "7d",
  });
  return refreshToken;
}

export { generateAccessToken, generateRefreshToken };