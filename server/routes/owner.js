const express = require("express");
const db = require("../db");
const requireAuth = require("../middleware/auth");

const router = express.Router();

// Every route below requires a valid JWT
router.use(requireAuth);

// Helper: make sure the current user is an owner.
async function requireOwner(req, res) {
  const [rows] = await db.query("SELECT role FROM users WHERE id = ?", [req.userId]);
  if (rows.length === 0) return res.status(404).json({ error: "User not found" });
  if (rows[0].role !== "owner") return res.status(403).json({ error: "Owners only" });
  return null;
}

// Helper: fetch one PG, ensure the logged-in user owns it.
// Returns { error } or null. On success, also returns the PG row.
async function getOwnedPG(req, res) {
  const pgId = req.params.id;
  const [pgRows] = await db.query(
    "SELECT id, name, owner_id, group_id FROM pgs WHERE id = ?",
    [pgId]
  );
  if (pgRows.length === 0) {
    res.status(404).json({ error: "PG not found" });
    return null;
  }
  if (pgRows[0].owner_id !== req.userId) {
    res.status(403).json({ error: "You do not own this PG" });
    return null;
  }
  return pgRows[0];
}

// Helper: make sure this month's cycle exists for a group, return its id.
async function ensureCycle(groupId) {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

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

// GET /api/owner/pgs  -> every PG I own + headline stats for this month
router.get("/pgs", async (req, res) => {
  const authErr = await requireOwner(req, res);
  if (authErr) return;

  const [rows] = await db.query(
    `SELECT p.id, p.name, p.city, p.monthly_rent, p.capacity,
            p.group_id, g.name AS group_name,
            (SELECT COUNT(*) FROM memberships m WHERE m.group_id = p.group_id) AS tenant_count,
            (SELECT COUNT(*) FROM rent_requests r
               WHERE r.pg_id = p.id AND r.status = 'pending') AS pending_requests
     FROM pgs p
     LEFT JOIN "groups" g ON g.id = p.group_id
     WHERE p.owner_id = ?
     ORDER BY p.name`,
    [req.userId]
  );
  res.json({ pgs: rows });
});

// GET /api/owner/pgs/:id  -> one PG: tenants (with rent/bill status) + pending requests
router.get("/pgs/:id", async (req, res) => {
  const authErr = await requireOwner(req, res);
  if (authErr) return;

  const pg = await getOwnedPG(req, res);
  if (!pg) return;

  // Pending rent requests always apply (even before the PG has a group).
  const [requests] = await db.query(
    `SELECT r.id, r.message, r.created_at, u.id AS user_id, u.name, u.email, u.phone
     FROM rent_requests r
     JOIN users u ON u.id = r.user_id
     WHERE r.pg_id = ? AND r.status = 'pending'
     ORDER BY r.id ASC`,
    [pg.id]
  );

  // No group yet? No tenants yet. Send empty arrays.
  if (!pg.group_id) {
    return res.json({ pg, tenants: [], requests, rentExpected: 0, rentCollected: 0, billCollected: 0 });
  }

  const cycleId = await ensureCycle(pg.group_id);

  // Every tenant + whether they've paid rent and bill this month.
  const [tenants] = await db.query(
    `SELECT m.id AS membership_id, u.name, u.email, m.phone, m.monthly_due, m.rent_due_day, m.bill_due_day,
            (SELECT p.id FROM payments p
               WHERE p.membership_id = m.id AND p.cycle_id = ? AND p.type = 'rent') AS rent_payment_id,
            (SELECT p.amount FROM payments p
               WHERE p.membership_id = m.id AND p.cycle_id = ? AND p.type = 'rent') AS rent_paid_amount,
            (SELECT p.id FROM payments p
               WHERE p.membership_id = m.id AND p.cycle_id = ? AND p.type = 'bill') AS bill_payment_id,
            (SELECT p.amount FROM payments p
               WHERE p.membership_id = m.id AND p.cycle_id = ? AND p.type = 'bill') AS bill_paid_amount
     FROM memberships m
     JOIN users u ON u.id = m.user_id
     WHERE m.group_id = ?
     ORDER BY u.name`,
    [cycleId, cycleId, cycleId, cycleId, pg.group_id]
  );

  const totalDue = tenants.reduce((s, t) => s + Number(t.monthly_due), 0);
  const collected = tenants.reduce(
    (s, t) => s + (t.rent_payment_id ? Number(t.rent_paid_amount) : 0),
    0
  );
  const billCollected = tenants.reduce(
    (s, t) => s + (t.bill_payment_id ? Number(t.bill_paid_amount) : 0),
    0
  );

  res.json({
    pg,
    tenants,
    requests,
    rentExpected: totalDue,
    rentCollected: collected,
    billCollected,
    cycleId,
  });
});

// POST /api/owner/pgs/:id/rent-requests/:requestId/decide  body: { decision, monthlyDue }
// Accept -> the PG gets a group (if none), the student becomes a tenant.
router.post("/pgs/:id/rent-requests/:requestId/decide", async (req, res) => {
  const authErr = await requireOwner(req, res);
  if (authErr) return;

  const pg = await getOwnedPG(req, res);
  if (!pg) return;

  const requestId = req.params.requestId;
  const { decision, monthlyDue } = req.body;

  if (!decision || !["accepted", "rejected"].includes(decision)) {
    return res.status(400).json({ error: "decision must be accepted or rejected" });
  }

  const [requestRows] = await db.query(
    "SELECT id, user_id FROM rent_requests WHERE id = ? AND pg_id = ? AND status = 'pending'",
    [requestId, pg.id]
  );
  if (requestRows.length === 0) {
    return res.status(404).json({ error: "Request not found or already decided" });
  }
  const tenantUserId = requestRows[0].user_id;

  await db.query("UPDATE rent_requests SET status = ? WHERE id = ?", [decision, requestId]);

  const [applicant] = await db.query(
    "SELECT name, phone FROM users WHERE id = ?",
    [tenantUserId]
  );

  if (decision === "accepted") {
    if (!monthlyDue) {
      return res.status(400).json({ error: "monthlyDue is required to accept" });
    }

    // Give the PG a group if it doesn't have one (named after the PG).
    let groupId = pg.group_id;
    if (!groupId) {
      const [grp] = await db.query(
        "INSERT INTO \"groups\" (name, owner_id) VALUES (?, ?) RETURNING id",
        [pg.name, req.userId]
      );
      groupId = grp.insertId;
      await db.query("UPDATE pgs SET group_id = ? WHERE id = ?", [groupId, pg.id]);
    }

    await db.query(
      "INSERT INTO memberships (user_id, group_id, monthly_due, phone) VALUES (?, ?, ?, ?) ON CONFLICT DO NOTHING",
      [tenantUserId, groupId, monthlyDue, applicant[0].phone]
    );

    await db.query(
      "INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, 'request')",
      [tenantUserId, "Rent request accepted", "Your request to rent at " + pg.name + " was accepted!"]
    );
  } else {
    await db.query(
      "INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, 'request')",
      [tenantUserId, "Rent request declined", "Your request to rent at " + pg.name + " was declined."]
    );
  }

  res.json({ ok: true, decision });
});

// POST /api/owner/pgs/:id/tenants  body: { name, phone, monthlyDue, rentDueDay, billDueDay }
// Owner adds a tenant who already lives at the PG (find-or-create user by phone).
router.post("/pgs/:id/tenants", async (req, res) => {
  const authErr = await requireOwner(req, res);
  if (authErr) return;

  const pg = await getOwnedPG(req, res);
  if (!pg) return;

  const { name, phone, monthlyDue, rentDueDay, billDueDay } = req.body;
  if (!name || !monthlyDue) {
    return res.status(400).json({ error: "name and monthlyDue are required" });
  }

  // Find an existing user by phone; if none, create a lightweight student account.
  let [userRows] = await db.query(
    "SELECT id FROM users WHERE phone = ? LIMIT 1",
    [phone || null]
  );
  if (userRows.length === 0 && !phone) {
    return res.status(400).json({ error: "Provide a phone number to find the tenant" });
  }

  let userId;
  if (userRows.length > 0) {
    userId = userRows[0].id;
  } else {
    const [resu] = await db.query(
      "INSERT INTO users (name, email, phone, password_hash, role) VALUES (?, ?, ?, ?, 'student') RETURNING id",
      [name, phone + "@mynest.local", phone, "tenant-onboarding"]
    );
    userId = resu.insertId;
  }

  // Give the PG a group if it doesn't have one.
  let groupId = pg.group_id;
  if (!groupId) {
    const [grp] = await db.query(
      "INSERT INTO \"groups\" (name, owner_id) VALUES (?, ?) RETURNING id",
      [pg.name, req.userId]
    );
    groupId = grp.insertId;
    await db.query("UPDATE pgs SET group_id = ? WHERE id = ?", [groupId, pg.id]);
  }

  await db.query(
    `INSERT INTO memberships (user_id, group_id, monthly_due, phone, rent_due_day, bill_due_day)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT (group_id, user_id) DO UPDATE SET monthly_due = EXCLUDED.monthly_due, phone = EXCLUDED.phone`,
    [userId, groupId, monthlyDue, phone || null, rentDueDay || 1, billDueDay || 1]
  );

  await db.query(
    "INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, 'info')",
    [userId, "You were added to " + pg.name, "Your owner added you as a tenant. Welcome!"]
  );

  res.status(201).json({ ok: true });
});

// POST /api/owner/pgs/:id/members/:membershipId/payment  body: { type, amount }
// Record that a tenant paid their rent (or bill) this month.
router.post("/pgs/:id/members/:membershipId/payment", async (req, res) => {
  const authErr = await requireOwner(req, res);
  if (authErr) return;

  const pg = await getOwnedPG(req, res);
  if (!pg) return;

  const membershipId = req.params.membershipId;
  const { type, amount } = req.body;
  const payType = type === "bill" ? "bill" : "rent";

  if (!amount) return res.status(400).json({ error: "amount is required" });

  // Membership must belong to this PG's group.
  const [membership] = await db.query(
    "SELECT id, user_id FROM memberships WHERE id = ? AND group_id = ?",
    [membershipId, pg.group_id]
  );
  if (membership.length === 0) {
    return res.status(400).json({ error: "Invalid membership for this PG" });
  }

  if (!pg.group_id) {
    return res.status(400).json({ error: "This PG has no tenants yet" });
  }

  const cycleId = await ensureCycle(pg.group_id);

  await db.query(
    `INSERT INTO payments (cycle_id, membership_id, type, amount)
     VALUES (?, ?, ?, ?)
     ON CONFLICT (cycle_id, membership_id, type) DO UPDATE SET amount = EXCLUDED.amount`,
    [cycleId, membershipId, payType, amount]
  );

  const [tenant] = await db.query("SELECT name FROM users WHERE id = ?", [membership[0].user_id]);
  await db.query(
    "INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)",
    [
      membership[0].user_id,
      payType === "rent" ? "Rent received" : "Bill received",
      (payType === "rent" ? "Rent" : "Bill") + " of Rs " + amount + " marked as paid at " + pg.name,
      payType === "rent" ? "rent" : "bill",
    ]
  );

  res.status(201).json({ ok: true });
});

module.exports = router;
