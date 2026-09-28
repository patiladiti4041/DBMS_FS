// server.js
// Entry point of the backend. Run with: npm run dev

require("dotenv").config();
const express = require("express");
const cors = require("cors");

const { testConnection } = require("./config/db");
const authRoutes = require("./routes/authRoutes");
const errorHandler = require("./middleware/errorHandler");

const app = express();

// ---- Global middleware ----
app.use(cors());            // allows the React frontend (different port) to call this API
app.use(express.json());    // parses incoming JSON request bodies into req.body

// ---- Health check route (useful to confirm server is alive) ----
app.get("/api/health", (req, res) => {
  res.json({ success: true, message: "Nestify API is running." });
});

// ---- Feature routes ----
app.use("/api/auth", authRoutes);

// ---- 404 handler (no matching route found) ----
app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route not found." });
});

// ---- Centralized error handler — must be the LAST app.use() ----
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

// Test the DB connection first, then start listening for requests.
testConnection().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Nestify backend running on http://localhost:${PORT}`);
  });
});
