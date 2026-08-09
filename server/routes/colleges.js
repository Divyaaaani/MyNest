const express = require("express");
const db = require("../db");

const router = express.Router();

// GET /api/colleges?q=ycce  -> colleges matching the typed name
router.get("/", async (req, res) => {
  const { q } = req.query;

  if (!q || q.trim() === "") {
    return res.json({ colleges: [] });
  }

  // LIKE + % wildcards = partial match ("ycce" finds "YCCE Nagpur ...").
  // The `?` placeholder keeps the input as DATA, not SQL code.
  const [rows] = await db.query(
    `SELECT id, name, city, latitude, longitude
     FROM colleges
     WHERE name LIKE ?
     ORDER BY name
     LIMIT 10`,
    [`%${q.trim()}%`]
  );

  res.json({ colleges: rows });
});

module.exports = router;
