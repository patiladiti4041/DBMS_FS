// middleware/errorHandler.js
// A single place that catches any error passed via next(err) or thrown
// in an async route (if you use try/catch and call next(err)).
// This means individual controllers don't need to format error
// responses themselves — they just throw or call next(err).

function errorHandler(err, req, res, next) {
  console.error("🔥 Error:", err.message);

  // MySQL trigger errors (SIGNAL SQLSTATE '45000') land here with this code
  if (err.sqlState === "45000") {
    return res.status(403).json({ success: false, message: err.sqlMessage });
  }

  // Duplicate entry (e.g. email already registered)
  if (err.code === "ER_DUP_ENTRY") {
    return res.status(409).json({ success: false, message: "This record already exists (duplicate entry)." });
  }

  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || "Something went wrong on the server."
  });
}

module.exports = errorHandler;
