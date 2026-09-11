const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const path = require("path");

dotenv.config();

const db = require("./db");

const pgsRouter = require("./routes/pgs");
const authRouter = require("./routes/auth");
const groupsRouter = require("./routes/groups");
const collegesRouter = require("./routes/colleges");
const roommatesRouter = require("./routes/roommates");
const communityRouter = require("./routes/community");
const ownerRouter = require("./routes/owner");
const notificationsRouter = require("./routes/notifications");
const propertiesRouter = require("./routes/properties");

const app = express();

// Security headers (XSS filter, MIME sniffing, clickjacking, HSTS, ...).
app.use(helmet());
// HTTP request logging: concise "dev" output locally, Apache-style in prod.
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));
// Brute-force protection on login/register: 50 attempts per 15 min per IP.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts — please try again in 15 minutes" },
});
app.use("/api/auth", authLimiter);

// Production: set CLIENT_URL to the frontend origin
// (e.g. https://mynest.vercel.app). Local dev stays open for Vite proxy.
app.use(cors({ origin: process.env.CLIENT_URL || true }));
app.use(express.json());

app.get("/api/health", async (req, res) => {
  const [rows] = await db.query("SELECT 1 AS ok");
  res.json({ ok: rows[0].ok });
});

// Photos fetched by scripts/fetch-real-pgs.js are stored locally so the
// app never depends on the Google key at runtime.
app.use("/api/photo", express.static(path.join(__dirname, "public", "photos")));
// Owner-uploaded property photos (Add Property flow) live under public/uploads.
app.use("/api/photo/uploads", express.static(path.join(__dirname, "public", "uploads")));

app.use("/api/pgs", pgsRouter);
app.use("/api/auth", authRouter);
app.use("/api/groups", groupsRouter);
app.use("/api/colleges", collegesRouter);
app.use("/api", roommatesRouter);
app.use("/api", communityRouter);
app.use("/api/owner", ownerRouter);
app.use("/api/notifications", notificationsRouter);
app.use("/api/properties", propertiesRouter);

// Unknown API route -> JSON 404 (instead of Express's HTML page).
app.use("/api", (req, res) => {
  res.status(404).json({ error: "Not found" });
});

// Central error handler: logs the stack, never leaks internals to clients.
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: "Something went wrong" });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`MyNest server running on http://localhost:${PORT}`);
});
