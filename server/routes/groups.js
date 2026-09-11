const express = require("express");
const db = require("../db");
const requireAuth = require("../middleware/auth");

const router = express.Router();

// Every route below requires a valid JWT
router.use(requireAuth);

// Helper: make sure this month's cycle exists for a group, return its id.
async function ensureCycle(groupId) {
  const now = new Date();
  const month = now.getMonth() + 1; // JS months are 0-11, so +1
  const year = now.getFullYear();

  // ON CONFLICT DO NOTHING: if the cycle already exists, it does nothing (that's the UNIQUE key)
  await db.query(
    "INSERT INTO monthly_cycles (group_id, month, year) VALUES (?, ?, ?) ON CONFLICT DO NOTHING",
    [groupId, month, year]
  );

  const [rows] = await db.query(
    "SELECT id FROM monthly_cycles WHERE group_id = ? AND month = ? AND year = ?",
    [groupId, month, year]
  );
  return rows[0].id;
}

// GET /api/groups/mine  -> the logged-in user's groups
router.get("/mine", async (req, res) => {
  const [rows] = await db.query(
    `SELECT g.id, g.name, g.owner_id, m.monthly_due, g.created_at,
            (SELECT COUNT(*) FROM memberships m2 WHERE m2.group_id = g.id) AS member_count
     FROM memberships m
     JOIN "groups" g ON g.id = m.group_id
     WHERE m.user_id = ?
     ORDER BY g.created_at DESC`,
    [req.userId]
  );
  res.json({ groups: rows });
});

// GET /api/groups/mine/dues  -> what the CURRENT USER owes this month, per group.
// Drives the "Rent Online" section of the dashboard.
router.get("/mine/dues", async (req, res) => {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  // Make sure this month's cycle exists for every group the user is in.
  await db.query(
    `INSERT INTO monthly_cycles (group_id, month, year)
     SELECT m.group_id, ?, ? FROM memberships m WHERE m.user_id = ?
     ON CONFLICT DO NOTHING`,
    [month, year, req.userId]
  );

  // paid = does a payment row exist for this user in this month's cycle?
  const [rows] = await db.query(
    `SELECT g.id AS groupId, g.name AS groupName, m.id AS membershipId,
            m.monthly_due AS monthlyDue,
            (SELECT p.id FROM payments p
               JOIN monthly_cycles mc ON mc.id = p.cycle_id
              WHERE p.membership_id = m.id AND mc.group_id = g.id
                AND mc.month = ? AND mc.year = ?) AS payment_id
     FROM memberships m
     JOIN "groups" g ON g.id = m.group_id
     WHERE m.user_id = ?
     ORDER BY g.created_at DESC`,
    [month, year, req.userId]
  );

  res.json({
    month,
    year,
    dues: rows.map((r) => ({
      groupId: r.groupId,
      groupName: r.groupName,
      membershipId: r.membershipId,
      monthlyDue: r.monthlyDue,
      paid: r.payment_id !== null,
    })),
  });
});

// GET /api/groups/:id  -> one group: members + this month's payment status
router.get("/:id", async (req, res) => {
  const groupId = req.params.id;

  const [membership] = await db.query(
    "SELECT id FROM memberships WHERE group_id = ? AND user_id = ?",
    [groupId, req.userId]
  );
  if (membership.length === 0) {
    return res.status(403).json({ error: "You are not a member of this group" });
  }

  const cycleId = await ensureCycle(groupId);

  const [groupRows] = await db.query(
    "SELECT id, name, owner_id FROM \"groups\" WHERE id = ?",
    [groupId]
  );
  const group = groupRows[0];

  // LEFT JOIN payments: members without a payment get NULL -> means "owes".
  const [members] = await db.query(
    `SELECT m.id, u.name, u.email, m.monthly_due,
            p.id AS payment_id, p.amount, p.paid_at
     FROM memberships m
     JOIN users u ON u.id = m.user_id
     LEFT JOIN payments p ON p.membership_id = m.id AND p.cycle_id = ?
     WHERE m.group_id = ?`,
    [cycleId, groupId]
  );

  res.json({
    group: { id: group.id, name: group.name, ownerId: group.owner_id },
    cycleId,
    members: members.map((m) => ({
      membershipId: m.id,
      name: m.name,
      email: m.email,
      monthlyDue: m.monthly_due,
      paid: m.payment_id !== null,
      paidAmount: m.amount,
    })),
  });
});

// ---- Join requests (student asks to join a group, owner approves) ----

// POST /api/groups/:id/join-requests  body: { message }
// A logged-in user (not yet a member) asks to join.
router.post("/:id/join-requests", async (req, res) => {
  const groupId = req.params.id;
  const { message } = req.body;

  const [existing] = await db.query(
    "SELECT id FROM memberships WHERE group_id = ? AND user_id = ?",
    [groupId, req.userId]
  );
  if (existing.length > 0) {
    return res.status(400).json({ error: "You are already a member of this group" });
  }

  // ON CONFLICT DO NOTHING: the UNIQUE key stops duplicate requests.
  const [result] = await db.query(
    "INSERT INTO group_join_requests (group_id, user_id, message) VALUES (?, ?, ?) ON CONFLICT DO NOTHING",
    [groupId, req.userId, message || null]
  );
  if (result.affectedRows === 0) {
    return res.status(400).json({ error: "You already have a pending request" });
  }

  res.status(201).json({ ok: true });
});

// GET /api/groups/:id/join-requests  -> only the owner sees pending requests
router.get("/:id/join-requests", async (req, res) => {
  const groupId = req.params.id;

  const [groupRows] = await db.query(
    "SELECT owner_id FROM \"groups\" WHERE id = ?",
    [groupId]
  );
  if (groupRows.length === 0) return res.status(404).json({ error: "Group not found" });
  if (groupRows[0].owner_id !== req.userId) {
    return res.status(403).json({ error: "Only the group owner can review requests" });
  }

  const [requests] = await db.query(
    `SELECT r.id, r.status, r.created_at, r.message,
            u.id AS user_id, u.name, u.email
     FROM group_join_requests r
     JOIN users u ON u.id = r.user_id
     WHERE r.group_id = ? AND r.status = 'pending'
     ORDER BY r.id ASC`,
    [groupId]
  );

  res.json({ requests });
});

// POST /api/groups/:id/join-requests/:requestId/decide  body: { decision, monthlyDue }
// Owner accepts -> we create a membership (and they owe from this month).
// Owner rejects -> request just marked rejected.
router.post("/:id/join-requests/:requestId/decide", async (req, res) => {
  const groupId = req.params.id;
  const requestId = req.params.requestId;
  const { decision, monthlyDue } = req.body;

  if (!decision || !["accepted", "rejected"].includes(decision)) {
    return res.status(400).json({ error: "decision must be accepted or rejected" });
  }

  const [groupRows] = await db.query(
    "SELECT owner_id FROM \"groups\" WHERE id = ?",
    [groupId]
  );
  if (groupRows.length === 0) return res.status(404).json({ error: "Group not found" });
  if (groupRows[0].owner_id !== req.userId) {
    return res.status(403).json({ error: "Only the group owner can decide" });
  }

  const [requestRows] = await db.query(
    "SELECT id, user_id FROM group_join_requests WHERE id = ? AND group_id = ? AND status = 'pending'",
    [requestId, groupId]
  );
  if (requestRows.length === 0) {
    return res.status(404).json({ error: "Request not found or already decided" });
  }

  // Update the request status first.
  await db.query(
    "UPDATE group_join_requests SET status = ? WHERE id = ?",
    [decision, requestId]
  );

  if (decision === "accepted") {
    if (!monthlyDue) {
      return res.status(400).json({ error: "monthlyDue is required to accept" });
    }
    await db.query(
      "INSERT INTO memberships (user_id, group_id, monthly_due) VALUES (?, ?, ?)",
      [requestRows[0].user_id, groupId, monthlyDue]
    );
  }

  res.json({ ok: true, decision });
});

// GET /api/groups/:id/my-request  -> current user's join status for a group
router.get("/:id/my-request", async (req, res) => {
  const groupId = req.params.id;

  const [membership] = await db.query(
    "SELECT id FROM memberships WHERE group_id = ? AND user_id = ?",
    [groupId, req.userId]
  );

  const [requestRows] = await db.query(
    "SELECT status FROM group_join_requests WHERE group_id = ? AND user_id = ? ORDER BY id DESC LIMIT 1",
    [groupId, req.userId]
  );

  res.json({
    isMember: membership.length > 0,
    request: requestRows.length > 0 ? requestRows[0].status : null,
  });
});

// POST /api/groups/:id/payments  body: { membershipId, amount }
// Marks a member as paid for the current month.
router.post("/:id/payments", async (req, res) => {
  const groupId = req.params.id;
  const { membershipId, amount } = req.body;

  if (!membershipId || !amount) {
    return res.status(400).json({ error: "membershipId and amount are required" });
  }

  const [membership] = await db.query(
    "SELECT id FROM memberships WHERE id = ? AND group_id = ?",
    [membershipId, groupId]
  );
  if (membership.length === 0) {
    return res.status(400).json({ error: "Invalid membership" });
  }

  const cycleId = await ensureCycle(groupId);

  // ON CONFLICT: if they already paid this month, update instead of duplicate.
  await db.query(
    `INSERT INTO payments (cycle_id, membership_id, amount)
     VALUES (?, ?, ?)
     ON CONFLICT (cycle_id, membership_id, type) DO UPDATE SET amount = EXCLUDED.amount`,
    [cycleId, membershipId, amount]
  );

  res.status(201).json({ ok: true, cycleId });
});

module.exports = router;
