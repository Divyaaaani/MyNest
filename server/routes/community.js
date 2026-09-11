const express = require("express");
const db = require("../db");
const requireAuth = require("../middleware/auth");

const router = express.Router();

// GET /api/community/posts -> all personals, newest first, with comment count
router.get("/community/posts", async (req, res) => {
  const [rows] = await db.query(
    `SELECT p.id, p.title, p.message, p.city, p.budget_max, p.created_at,
            u.name AS author_name,
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
    `SELECT c.id, c.message, c.created_at, u.name AS author_name
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

module.exports = router;
