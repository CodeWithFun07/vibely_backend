const errorHandler = (err, req, res, next) => {
  console.error("Error:", err);

  let statusCode = Number(err.statusCode) || 500;
  if (!Number.isInteger(statusCode) || statusCode < 100 || statusCode > 599) {
    statusCode = 500;
  }
  const message = err.message || "Internal Server Error";

  res.status(statusCode).json({
    statusCode,
    message,
    success: false,
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
};

export default errorHandler;
