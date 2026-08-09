const express = require("express");
const db = require("../db");
const requireAuth = require("../middleware/auth");

const router = express.Router();

// POST /api/pgs/:id/roommates  body: { message, slots }
// A logged-in student living at this PG posts "I need a roommate".
router.post("/pgs/:id/roommates", requireAuth, async (req, res) => {
  const pgId = req.params.id;
  const { message, slots } = req.body;

  if (!message) {
    return res.status(400).json({ error: "message is required" });
  }

  const [result] = await db.query(
    "INSERT INTO roommate_requests (pg_id, user_id, message, slots) VALUES (?, ?, ?, ?)",
    [pgId, req.userId, message, slots || 1]
  );

  res.status(201).json({ id: result.insertId });
});

// POST /api/roommates/:id/apply  body: { message }
// Another student says "I want to join this".
router.post("/roommates/:id/apply", requireAuth, async (req, res) => {
  const requestId = req.params.id;
  const { message } = req.body;

  const [rows] = await db.query(
    "SELECT id, user_id FROM roommate_requests WHERE id = ?",
    [requestId]
  );
  if (rows.length === 0) {
    return res.status(404).json({ error: "Request not found" });
  }
  if (rows[0].user_id === req.userId) {
    return res.status(400).json({ error: "You cannot join your own request" });
  }

  // INSERT IGNORE: the UNIQUE key means a user can apply only once.
  await db.query(
    "INSERT IGNORE INTO roommate_applicants (request_id, user_id, message) VALUES (?, ?, ?)",
    [requestId, req.userId, message || null]
  );

  res.status(201).json({ ok: true });
});

module.exports = router;
