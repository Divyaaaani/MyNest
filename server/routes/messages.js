const express = require("express");
const db = require("../db");
const requireAuth = require("../middleware/auth");

const router = express.Router();

// Every route below requires a valid JWT
router.use(requireAuth);

// GET /api/chats  -> my conversations: partner, last message, unread count
router.get("/", async (req, res) => {
  const me = req.userId;
  const [rows] = await db.query(
    `SELECT c.id,
            CASE WHEN c.user_a_id = ? THEN c.user_b_id ELSE c.user_a_id END AS partner_id,
            u.name AS partner_name, u.role AS partner_role,
            (SELECT m.body FROM messages m
              WHERE m.conversation_id = c.id ORDER BY m.id DESC LIMIT 1) AS last_body,
            (SELECT m.created_at FROM messages m
              WHERE m.conversation_id = c.id ORDER BY m.id DESC LIMIT 1) AS last_at,
            (SELECT COUNT(*) FROM messages m
              WHERE m.conversation_id = c.id AND m.sender_id != ?
                AND m.is_read = false) AS unread_count
     FROM conversations c
     JOIN users u ON u.id = CASE WHEN c.user_a_id = ? THEN c.user_b_id ELSE c.user_a_id END
     WHERE c.user_a_id = ? OR c.user_b_id = ?
     ORDER BY last_at DESC NULLS LAST`,
    [me, me, me, me, me]
  );
  res.json({
    conversations: rows.map((c) => ({ ...c, unread_count: Number(c.unread_count) })),
  });
});

// GET /api/chats/unread  -> total unread DMs (for the navbar badge)
router.get("/unread", async (req, res) => {
  const [rows] = await db.query(
    `SELECT COUNT(*) AS c FROM messages m
     JOIN conversations c2 ON c2.id = m.conversation_id
     WHERE (c2.user_a_id = ? OR c2.user_b_id = ?)
       AND m.sender_id != ? AND m.is_read = false`,
    [req.userId, req.userId, req.userId]
  );
  res.json({ unread: Number(rows[0].c) });
});

// POST /api/chats/open  body: { userId, postId? }
// Find-or-create the 1-on-1 thread with another user. Never with yourself.
router.post("/open", async (req, res) => {
  const otherId = Number(req.body.userId);
  if (!otherId || otherId === req.userId) {
    return res.status(400).json({ error: "Invalid user" });
  }
  const [target] = await db.query("SELECT id FROM users WHERE id = ?", [otherId]);
  if (target.length === 0) return res.status(404).json({ error: "User not found" });

  const a = Math.min(req.userId, otherId);
  const b = Math.max(req.userId, otherId);
  await db.query(
    "INSERT INTO conversations (user_a_id, user_b_id, post_id) VALUES (?, ?, ?) ON CONFLICT DO NOTHING",
    [a, b, req.body.postId || null]
  );
  const [rows] = await db.query(
    "SELECT id FROM conversations WHERE user_a_id = ? AND user_b_id = ?",
    [a, b]
  );
  res.json({ id: rows[0].id });
});

// GET /api/chats/:id/messages  -> thread (marks partner's messages read)
router.get("/:id/messages", async (req, res) => {
  const convoId = req.params.id;
  const [mine] = await db.query(
    "SELECT id FROM conversations WHERE id = ? AND (user_a_id = ? OR user_b_id = ?)",
    [convoId, req.userId, req.userId]
  );
  if (mine.length === 0) return res.status(404).json({ error: "Chat not found" });

  await db.query(
    "UPDATE messages SET is_read = true WHERE conversation_id = ? AND sender_id != ?",
    [convoId, req.userId]
  );
  const [msgs] = await db.query(
    `SELECT m.id, m.body, m.created_at, m.sender_id,
            (m.sender_id = ?) AS mine
     FROM messages m
     WHERE m.conversation_id = ?
     ORDER BY m.id ASC
     LIMIT 200`,
    [req.userId, convoId]
  );
  res.json({ messages: msgs.map((m) => ({ ...m, mine: !!m.mine })) });
});

// POST /api/chats/:id/messages  body: { body }
// Send a message + notify the partner (dashboard notification).
router.post("/:id/messages", async (req, res) => {
  const convoId = req.params.id;
  const body = (req.body.body || "").trim();
  if (!body) return res.status(400).json({ error: "Message is empty" });
  if (body.length > 2000) return res.status(400).json({ error: "Message too long" });

  const [mine] = await db.query(
    `SELECT c.id,
            CASE WHEN c.user_a_id = ? THEN c.user_b_id ELSE c.user_a_id END AS partner_id
     FROM conversations c
     WHERE c.id = ? AND (c.user_a_id = ? OR c.user_b_id = ?)`,
    [req.userId, convoId, req.userId, req.userId]
  );
  if (mine.length === 0) return res.status(404).json({ error: "Chat not found" });

  const [ins] = await db.query(
    "INSERT INTO messages (conversation_id, sender_id, body) VALUES (?, ?, ?) RETURNING id, created_at",
    [convoId, req.userId, body]
  );
  const [me] = await db.query("SELECT name FROM users WHERE id = ?", [req.userId]);
  await db.query(
    "INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, 'info')",
    [mine[0].partner_id, "New message", `${me.length ? me[0].name : "Someone"}: ${body.slice(0, 120)}`]
  );

  res.status(201).json({ id: ins.insertId });
});

module.exports = router;
