// Middleware to handle refreshed tokens in response
const handleRefreshedToken = (req, res, next) => {
  // Store the original json method
  const originalJson = res.json;

  // Override the json method
  res.json = function (data) {
    // If a new access token was generated during middleware execution
    if (req.newAccessToken) {
      // Add the new access token to the response data
      if (data && typeof data === "object") {
        data.newAccessToken = req.newAccessToken;
      }

      // Also set it in the response header
      res.setHeader("X-New-Access-Token", req.newAccessToken);
    }

    // Call the original json method with the modified data
    return originalJson.call(this, data);
  };

  next();
};

export { handleRefreshedToken };
