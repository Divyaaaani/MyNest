const express = require("express");
const db = require("../db");
const requireAuth = require("../middleware/auth");

const router = express.Router();

// GET /api/community/posts -> all personals, newest first, with comment count
router.get("/community/posts", async (req, res) => {
  const [rows] = await db.query(
    `SELECT p.id, p.title, p.message, p.city, p.budget_max, p.created_at, p.user_id AS author_id,
            u.name AS author_name, u.role AS author_role,
            (SELECT COUNT(*) FROM roommate_post_comments c WHERE c.post_id = p.id) AS comment_count
     FROM roommate_posts p
     JOIN users u ON u.id = p.user_id
     ORDER BY p.id DESC`
  );
  res.json({ posts: rows.map((p) => ({ ...p, comment_count: Number(p.comment_count) })) });
});

// GET /api/community/posts/:id/comments -> all comments on one post, oldest first
router.get("/community/posts/:id/comments", async (req, res) => {
  const [rows] = await db.query(
    `SELECT c.id, c.message, c.created_at, c.user_id AS author_id, u.name AS author_name, u.role AS author_role
     FROM roommate_post_comments c
     JOIN users u ON u.id = c.user_id
     WHERE c.post_id = ?
     ORDER BY c.id ASC`,
    [req.params.id]
  );
  res.json({ comments: rows });
});

// POST /api/community/posts  body: { title, message, city, budgetMax }
// A logged-in user posts a personals ad.
router.post("/community/posts", requireAuth, async (req, res) => {
  const { title, message, city, budgetMax } = req.body;

  if (!title || !message || !city) {
    return res.status(400).json({ error: "title, message and city are required" });
  }

  const [result] = await db.query(
    "INSERT INTO roommate_posts (user_id, title, message, city, budget_max) VALUES (?, ?, ?, ?, ?) RETURNING id",
    [req.userId, title, message, city, budgetMax || null]
  );

  res.status(201).json({ id: result.insertId });
});

// POST /api/community/posts/:id/comments  body: { message }
// Any logged-in user can comment (no DM needed — keeps it simple).
router.post("/community/posts/:id/comments", requireAuth, async (req, res) => {
  const postId = req.params.id;
  const { message } = req.body;

  if (!message || !message.trim()) {
    return res.status(400).json({ error: "message is required" });
  }

  const [result] = await db.query(
    "INSERT INTO roommate_post_comments (post_id, user_id, message) VALUES (?, ?, ?) RETURNING id",
    [postId, req.userId, message.trim()]
  );

  res.status(201).json({ id: result.insertId });
});

// POST /api/community/posts/:id/contact
// "I want to reach this poster" — drops a notification into the author's
// dashboard (the frontend opens Call/WhatsApp right after this call).
router.post("/community/posts/:id/contact", requireAuth, async (req, res) => {
  const postId = req.params.id;

  const [rows] = await db.query("SELECT user_id FROM roommate_posts WHERE id = ?", [postId]);
  if (rows.length === 0) return res.status(404).json({ error: "Post not found" });
  const authorId = rows[0].user_id;
  if (authorId === req.userId) return res.json({ ok: true, self: true }); // no self-pings

  const [me] = await db.query("SELECT name FROM users WHERE id = ?", [req.userId]);
  const title = "Someone wants to reach you";
  const message = `${me.length ? me[0].name : "Someone"} tapped contact on your roommate post.`;

  // One ping per person per post per day — no badge spam from repeat taps.
  const [dup] = await db.query(
    `SELECT id FROM notifications WHERE user_id = ? AND title = ? AND message = ?
     AND created_at > NOW() - INTERVAL '24 hours'`,
    [authorId, title, message]
  );
  if (dup.length === 0) {
    await db.query(
      "INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, 'info')",
      [authorId, title, message]
    );
  }

  res.json({ ok: true });
});

module.exports = router;
