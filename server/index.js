const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
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

app.use(cors());
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

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`MyNest server running on http://localhost:${PORT}`);
});
