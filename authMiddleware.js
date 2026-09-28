// middleware/authMiddleware.js
// Two middlewares:
// 1. verifyToken   -> checks the JWT is present and valid, attaches req.user
// 2. checkRole(...) -> checks req.user.role is one of the allowed roles
//
// These get stacked on routes like:
//   router.post("/properties", verifyToken, checkRole(["broker"]), createProperty);

const jwt = require("jsonwebtoken");
require("dotenv").config();

function verifyToken(req, res, next) {
  const authHeader = req.headers["authorization"]; // format: "Bearer <token>"

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, message: "No token provided. Please log in." });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // decoded contains whatever we put in it at login time: { user_id, role }
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: "Invalid or expired token. Please log in again." });
  }
}

function checkRole(allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Requires role: ${allowedRoles.join(" or ")}`
      });
    }
    next();
  };
}

module.exports = { verifyToken, checkRole };
