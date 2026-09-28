// controllers/authController.js
// Handles: register, login, and "get my profile" (/me)

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { pool } = require("../config/db");

const SALT_ROUNDS = 10;

// ------------------------------------------------------------
// POST /api/auth/register
// Body: { name, email, password, phone, role, agency_name?, license_number? }
// role must be "buyer" or "broker" — "admin" is rejected here on purpose.
// Admin accounts are seeded directly into the database, never via this API.
// ------------------------------------------------------------
async function register(req, res, next) {
  const { name, email, password, phone, role, agency_name, license_number } = req.body;

  try {
    // ---- basic validation (kept simple and readable) ----
    if (!name || !email || !password || !role) {
      return res.status(400).json({ success: false, message: "name, email, password and role are required." });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, message: "Password must be at least 6 characters." });
    }
    if (!["buyer", "broker"].includes(role)) {
      return res.status(400).json({ success: false, message: "Role must be 'buyer' or 'broker'. Admin accounts cannot self-register." });
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ success: false, message: "Please provide a valid email address." });
    }

    // ---- look up the role_id for the chosen role ----
    const [roleRows] = await pool.query("SELECT role_id FROM Roles WHERE role_name = ?", [role]);
    if (roleRows.length === 0) {
      return res.status(400).json({ success: false, message: "Invalid role." });
    }
    const roleId = roleRows[0].role_id;

    // ---- hash the password, never store plain text ----
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // ---- get one connection to run a TRANSACTION ----
    // Why a transaction? A broker registration writes to TWO tables:
    // Users, then Brokers. If the second insert fails, we must NOT
    // leave a half-created user in the database. The transaction makes
    // both inserts succeed together, or neither happens at all.
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const [userResult] = await connection.query(
        "INSERT INTO Users (name, email, password_hash, phone, role_id) VALUES (?, ?, ?, ?, ?)",
        [name, email, passwordHash, phone || null, roleId]
      );
      const newUserId = userResult.insertId;

      if (role === "broker") {
        await connection.query(
          "INSERT INTO Brokers (user_id, agency_name, license_number) VALUES (?, ?, ?)",
          [newUserId, agency_name || null, license_number || null]
        );
      }

      await connection.commit();
      connection.release();

      return res.status(201).json({
        success: true,
        message: "Registration successful. You can now log in.",
        user_id: newUserId
      });
    } catch (err) {
      await connection.rollback(); // undo the Users insert if Brokers insert failed
      connection.release();
      throw err;
    }
  } catch (err) {
    next(err);
  }
}

// ------------------------------------------------------------
// POST /api/auth/login
// Body: { email, password }
// ------------------------------------------------------------
async function login(req, res, next) {
  const { email, password } = req.body;

  try {
    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Email and password are required." });
    }

    // Join Users -> Roles to get the role name in one query
    const [rows] = await pool.query(
      `SELECT u.user_id, u.name, u.email, u.password_hash, r.role_name
       FROM Users u
       JOIN Roles r ON u.role_id = r.role_id
       WHERE u.email = ?`,
      [email]
    );

    if (rows.length === 0) {
      return res.status(401).json({ success: false, message: "Invalid email or password." });
    }

    const user = rows[0];
    const passwordMatches = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatches) {
      return res.status(401).json({ success: false, message: "Invalid email or password." });
    }

    // If this user is a broker, also fetch their broker_id —
    // the frontend and later routes (e.g. "add property") need it.
    let brokerId = null;
    if (user.role_name === "broker") {
      const [brokerRows] = await pool.query("SELECT broker_id FROM Brokers WHERE user_id = ?", [user.user_id]);
      if (brokerRows.length > 0) brokerId = brokerRows[0].broker_id;
    }

    const token = jwt.sign(
      { user_id: user.user_id, role: user.role_name, broker_id: brokerId },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
    );

    return res.status(200).json({
      success: true,
      message: "Login successful.",
      token,
      user: {
        user_id: user.user_id,
        name: user.name,
        email: user.email,
        role: user.role_name,
        broker_id: brokerId
      }
    });
  } catch (err) {
    next(err);
  }
}

// ------------------------------------------------------------
// GET /api/auth/me
// Protected route — requires a valid token (verifyToken middleware).
// Used by the frontend on page load to check "am I still logged in?"
// ------------------------------------------------------------
async function getMe(req, res, next) {
  try {
    const [rows] = await pool.query(
      `SELECT u.user_id, u.name, u.email, u.phone, r.role_name
       FROM Users u
       JOIN Roles r ON u.role_id = r.role_id
       WHERE u.user_id = ?`,
      [req.user.user_id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    return res.status(200).json({ success: true, user: rows[0] });
  } catch (err) {
    next(err);
  }
}

module.exports = { register, login, getMe };
