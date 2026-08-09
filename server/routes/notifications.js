const express = require("express");
const db = require("../db");
const requireAuth = require("../middleware/auth");

const router = express.Router();

router.use(requireAuth);

// Helper: does this membership have a 'rent' payment for this month's cycle?
async function paidThisMonth(groupId, membershipId, type) {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const [rows] = await db.query(
    `SELECT p.id FROM payments p
     JOIN monthly_cycles mc ON mc.id = p.cycle_id
     WHERE p.membership_id = ? AND p.type = ?
       AND mc.group_id = ? AND mc.month = ? AND mc.year = ?`,
    [membershipId, type, groupId, month, year]
  );
  return rows.length > 0;
}

// GET /api/notifications
// Returns stored notifications + live "rent due soon" reminders computed from
// this user's memberships (due within 5 days -> "5 days to go").
router.get("/", async (req, res) => {
  // 1. Stored notifications (unread first, newest first)
  const [stored] = await db.query(
    `SELECT id, title, message, type, is_read, created_at
     FROM notifications WHERE user_id = ?
     ORDER BY is_read ASC, id DESC
     LIMIT 50`,
    [req.userId]
  );

  const [unreadRows] = await db.query(
    "SELECT COUNT(*) AS c FROM notifications WHERE user_id = ? AND is_read = 0",
    [req.userId]
  );
  const unread = unreadRows[0].c;

  // 2. Live reminders: rent due within the next 5 days.
  //    rent_due_day is a day-of-month, so compute the next occurrence.
  const reminders = [];
  const [memberships] = await db.query(
    `SELECT m.id AS membership_id, m.monthly_due, m.rent_due_day, g.name AS group_name, g.id AS group_id
     FROM memberships m
     JOIN \`groups\` g ON g.id = m.group_id
     WHERE m.user_id = ?`,
    [req.userId]
  );

  const now = new Date();
  const today = now.getDate();
  const month = now.getMonth();
  const year = now.getFullYear();

  for (const m of memberships) {
    if (await paidThisMonth(m.group_id, m.membership_id, "rent")) continue;

    // Next occurrence of rent_due_day: this month if still ahead, else next month.
    const dueThisMonth = new Date(year, month, m.rent_due_day);
    const dueNextMonth = new Date(year, month + 1, m.rent_due_day);
    let due = dueThisMonth >= now ? dueThisMonth : dueNextMonth;
    if (month === 11 && dueNextMonth.getMonth() === 0) {
      // December -> January rollover is handled by JS Date math automatically.
    }

    const daysLeft = Math.ceil((due - now) / (1000 * 60 * 60 * 24));
    if (daysLeft >= 0 && daysLeft <= 5) {
      reminders.push({
        id: "due-" + m.membership_id,
        title: daysLeft === 0 ? "Rent due today" : "Rent due soon",
        message:
          daysLeft === 0
            ? "Rs " + m.monthly_due + " rent for " + m.group_name + " is due today."
            : "Rs " + m.monthly_due + " rent for " + m.group_name + " is due in " + daysLeft + (daysLeft === 1 ? " day" : " days") + ".",
        type: "rent",
        is_read: 0,
        created_at: null,
        daysLeft,
      });
    }
  }

  res.json({ unread: unread + reminders.length, notifications: stored, reminders });
});

// POST /api/notifications/read  -> mark all stored notifications as read
router.post("/read", async (req, res) => {
  await db.query("UPDATE notifications SET is_read = 1 WHERE user_id = ?", [req.userId]);
  res.json({ ok: true });
});

module.exports = router;
