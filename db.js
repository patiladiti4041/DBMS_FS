// config/db.js
// This file creates ONE connection pool that the whole backend reuses.
// A "pool" is better than opening a fresh connection per request —
// it keeps a set of ready-to-use connections and hands them out as needed.

const mysql = require("mysql2/promise");
require("dotenv").config();

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10, // max simultaneous connections in the pool
  queueLimit: 0
});

// Quick self-test function we call once when the server starts,
// so we find out immediately if the DB credentials are wrong
// instead of discovering it on the first API request.
async function testConnection() {
  try {
    const connection = await pool.getConnection();
    console.log("✅ MySQL connected successfully to database:", process.env.DB_NAME);
    connection.release();
  } catch (err) {
    console.error("❌ MySQL connection failed:", err.message);
    process.exit(1); // stop the server — no point running without a DB
  }
}

module.exports = { pool, testConnection };
