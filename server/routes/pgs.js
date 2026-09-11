const express = require("express");
const db = require("../db");
const requireAuth = require("../middleware/auth");

const router = express.Router();

// GET /api/pgs?lat=18.5295&lng=73.8569&radius=5&min_rent=5000&max_rent=7000&college=COEP%20Pune&gender=male
// Returns PGs within `radius` km of (lat, lng), optional rent range + gender,
// nearest first.
// When `college` is given, PGs explicitly tagged "near" that college are ALSO
// included even if Google's coordinates put them outside the radius.
router.get("/", async (req, res) => {
  const { lat, lng, radius, min_rent, max_rent, college, gender } = req.query;

  if (!lat || !lng || !radius) {
    return res.status(400).json({ error: "lat, lng and radius are required" });
  }

  try {
    // Build the WHERE clause dynamically. Every value goes in the params array,
    // NEVER into the SQL string (that keeps it injection-proof).
    const conditions = [];
    const params = [lat, lng, lat];

    if (min_rent) {
      conditions.push("p.monthly_rent >= ?");
      params.push(min_rent);
    }
    if (max_rent) {
      conditions.push("p.monthly_rent <= ?");
      params.push(max_rent);
    }
    // gender=male -> only male PGs. gender=female -> only female PGs.
    // 'any' (or unset) -> everyone, but 'any' PGs fit any filter, so when a
    // specific gender is picked we include those + the mixed ('any') ones.
    if (gender === "male" || gender === "female") {
      conditions.push("(p.gender = ? OR p.gender = 'any')");
      params.push(gender);
    }

    // Haversine formula: distance in km between two points on Earth.
    // 6371 = Earth's radius in km.
    // Postgres can't use the SELECT alias (distance_km) in HAVING, so the
    // whole query is wrapped: inner SELECT computes, outer SELECT filters.
    const sql = `
       SELECT * FROM (
         SELECT
           p.id, p.name, p.address, p.city, p.college_nearby, p.college_id, p.monthly_rent, p.gender, p.capacity,
           p.latitude, p.longitude,
           (SELECT ph.url FROM photos ph WHERE ph.pg_id = p.id ORDER BY ph.id LIMIT 1) AS photo_url,
           -- STRING_AGG: Postgres' trick for returning a list inside one row (comma-separated)
           (SELECT STRING_AGG(f.name, ', ' ORDER BY f.id)
              FROM pg_facilities pf JOIN facilities f ON f.id = pf.facility_id
             WHERE pf.pg_id = p.id) AS facilities,
           (6371 * acos(
              cos(radians(?)) * cos(radians(p.latitude)) *
              cos(radians(p.longitude) - radians(?)) +
              sin(radians(?)) * sin(radians(p.latitude))
            )) AS distance_km
         FROM pgs p
         ${conditions.length ? "WHERE " + conditions.join(" AND ") : ""}
       ) AS sub
       WHERE distance_km <= ?
       ${college ? "OR college_id = (SELECT id FROM colleges WHERE name = ?) OR college_nearby = ?" : ""}
       ORDER BY distance_km`;

    params.push(radius);
    if (college) {
      params.push(college);
      params.push(college);
    }
    const [rows] = await db.query(sql, params);

    res.json({ count: rows.length, pgs: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

// GET /api/pgs/:id  -> one PG + its photos + roommate requests
router.get("/:id", async (req, res) => {
  const { id } = req.params;

  const [pgRows] = await db.query(
    `SELECT p.id, p.name, p.address, p.city, p.college_nearby,
            p.monthly_rent, p.gender, p.capacity, p.bhk, p.area_sqft, p.furnished, p.description,
            p.latitude, p.longitude,
            p.group_id, p.owner_id,
            u.name AS owner_name,
            u.phone AS owner_phone,
            (SELECT STRING_AGG(f.name, ', ' ORDER BY f.id)
               FROM pg_facilities pf JOIN facilities f ON f.id = pf.facility_id
              WHERE pf.pg_id = p.id) AS facilities
     FROM pgs p JOIN users u ON u.id = p.owner_id
     WHERE p.id = ?`,
    [id]
  );
  if (pgRows.length === 0) {
    return res.status(404).json({ error: "PG not found" });
  }
  const pg = pgRows[0];

  const [photos] = await db.query("SELECT id, url FROM photos WHERE pg_id = ?", [id]);

  // Each request + who posted it + how many have applied.
  const [requests] = await db.query(
    `SELECT rr.id, rr.message, rr.slots, rr.created_at,
            u.name AS owner_name,
            (SELECT COUNT(*) FROM roommate_applicants ra
              WHERE ra.request_id = rr.id) AS applicant_count
     FROM roommate_requests rr
     JOIN users u ON u.id = rr.user_id
     WHERE rr.pg_id = ?
     ORDER BY rr.created_at DESC`,
    [id]
  );

  res.json({ pg, photos, requests });
});

// ---- Rent a PG online (no roommate needed) ----

// POST /api/pgs/:id/rent-requests  body: { message }
// A logged-in student applies to rent this PG on their own.
router.post("/:id/rent-requests", requireAuth, async (req, res) => {
  const pgId = req.params.id;
  const { message } = req.body;

  const [pgRows] = await db.query(
    "SELECT id, name, owner_id FROM pgs WHERE id = ?",
    [pgId]
  );
  if (pgRows.length === 0) return res.status(404).json({ error: "PG not found" });
  if (pgRows[0].owner_id === req.userId) {
    return res.status(400).json({ error: "You own this PG" });
  }

  // If the PG already has a group, is this user already a tenant there?
  const [membership] = await db.query(
    `SELECT m.id FROM memberships m
     JOIN pgs p ON p.group_id = m.group_id
     WHERE p.id = ? AND m.user_id = ?`,
    [pgId, req.userId]
  );
  if (membership.length > 0) {
    return res.status(400).json({ error: "You are already a tenant of this PG" });
  }

  const [result] = await db.query(
    "INSERT INTO rent_requests (pg_id, user_id, message) VALUES (?, ?, ?) ON CONFLICT DO NOTHING",
    [pgId, req.userId, message || null]
  );
  if (result.affectedRows === 0) {
    return res.status(400).json({ error: "You already have a pending request" });
  }

  // Tell the owner a new rent request arrived.
  await db.query(
    "INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, 'request')",
    [pgRows[0].owner_id, "New rent request", "Someone wants to rent a room at " + pgRows[0].name]
  );

  res.status(201).json({ ok: true });
});

// GET /api/pgs/:id/rent-status  -> is the current user a tenant / did they apply?
router.get("/:id/rent-status", requireAuth, async (req, res) => {
  const pgId = req.params.id;

  const [membership] = await db.query(
    `SELECT m.id FROM memberships m
     JOIN pgs p ON p.group_id = m.group_id
     WHERE p.id = ? AND m.user_id = ?`,
    [pgId, req.userId]
  );

  const [requestRows] = await db.query(
    "SELECT status FROM rent_requests WHERE pg_id = ? AND user_id = ? ORDER BY id DESC LIMIT 1",
    [pgId, req.userId]
  );

  res.json({
    isTenant: membership.length > 0,
    request: requestRows.length > 0 ? requestRows[0].status : null,
  });
});

// GET /api/pgs/my/rent-requests  -> every PG the student applied to, with the
// application status. For accepted ones it also reports whether THIS month's
// rent and bill are paid, so the dashboard can say "rent due" / "bill due".
router.get("/my/rent-requests", requireAuth, async (req, res) => {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  // Which groups this user is a tenant of (from accepted rent requests).
  const [memberships] = await db.query(
    `SELECT m.id AS membership_id, m.group_id, m.monthly_due, m.rent_due_day, m.bill_due_day
     FROM memberships m
     JOIN pgs p ON p.group_id = m.group_id
     JOIN rent_requests rr ON rr.pg_id = p.id AND rr.user_id = m.user_id
     WHERE m.user_id = ? AND rr.status = 'accepted'`,
    [req.userId]
  );
  const membershipByGroup = new Map(memberships.map((m) => [m.group_id, m]));

  // One row per PG this user ever applied to, newest first.
  const [rows] = await db.query(
    `SELECT rr.id AS request_id, rr.status, rr.created_at,
            p.id AS pg_id, p.name, p.monthly_rent,
            (SELECT ph.url FROM photos ph WHERE ph.pg_id = p.id ORDER BY ph.id LIMIT 1) AS photo_url,
            p.group_id
     FROM rent_requests rr
     JOIN pgs p ON p.id = rr.pg_id
     WHERE rr.user_id = ?
     ORDER BY rr.id DESC`,
    [req.userId]
  );

  const applications = [];
  for (const r of rows) {
    const app = {
      requestId: r.request_id,
      pgId: r.pg_id,
      pgName: r.name,
      monthlyRent: r.monthly_rent,
      photoUrl: r.photo_url,
      status: r.status,
      createdAt: r.created_at,
    };

    // Accepted -> find the tenant's membership for this PG's group.
    if (r.status === "accepted" && r.group_id) {
      const mem = membershipByGroup.get(r.group_id);
      if (mem) {
        const [cycleRows] = await db.query(
          `SELECT id FROM monthly_cycles WHERE group_id = ? AND month = ? AND year = ?`,
          [r.group_id, month, year]
        );
        let cycleId;
        if (cycleRows.length > 0) {
          cycleId = cycleRows[0].id;
        } else {
          const [ins] = await db.query(
            "INSERT INTO monthly_cycles (group_id, month, year) VALUES (?, ?, ?) ON CONFLICT DO NOTHING",
            [r.group_id, month, year]
          );
          const [again] = await db.query(
            "SELECT id FROM monthly_cycles WHERE group_id = ? AND month = ? AND year = ?",
            [r.group_id, month, year]
          );
          cycleId = again[0].id;
        }

        const [payments] = await db.query(
          `SELECT type, amount FROM payments
           WHERE cycle_id = ? AND membership_id = ?`,
          [cycleId, mem.membership_id]
        );
        const paymentMap = Object.fromEntries(payments.map((p) => [p.type, p.amount]));

        app.membershipId = mem.membership_id;
        app.groupId = r.group_id;
        app.monthlyDue = mem.monthly_due;
        app.rentDueDay = mem.rent_due_day;
        app.billDueDay = mem.bill_due_day;
        app.rentPaid = "rent" in paymentMap;
        app.billPaid = "bill" in paymentMap;
      }
    }

    applications.push(app);
  }

  res.json({ month, year, applications });
});

module.exports = router;
