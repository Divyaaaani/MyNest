const express = require("express");
const path = require("path");
const multer = require("multer");
const crypto = require("crypto");
const db = require("../db");
const requireAuth = require("../middleware/auth");

const router = express.Router();

// Multer: handle file uploads. Files land in server/public/uploads with a
// random filename so two owners can't collide. 5 photos max, 5MB each.
const storage = multer.diskStorage({
  destination: path.join(__dirname, "..", "public", "uploads"),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || ".jpg";
    cb(null, crypto.randomBytes(12).toString("hex") + ext);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 5 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only image files are allowed"));
  },
});

router.use(requireAuth);

// POST /api/properties  (multipart/form-data)
// Owner lists a new property: details + up to 5 photos.
// Fields: name, address, city, monthlyRent, capacity, bhk, areaSqft,
//         furnished (0/1), description, latitude, longitude, collegeNearby
//         + files[] (photos)
router.post("/", upload.array("photos", 5), async (req, res) => {
  const [roleRows] = await db.query("SELECT role FROM users WHERE id = ?", [req.userId]);
  if (roleRows.length === 0) return res.status(404).json({ error: "User not found" });
  if (roleRows[0].role !== "owner") return res.status(403).json({ error: "Owners only" });

  const {
    name, address, city, monthlyRent, gender, capacity, bhk, areaSqft,
    furnished, description, latitude, longitude, collegeNearby, collegeId,
  } = req.body;
  // Facilities arrive as one or more checkbox values: "WiFi", "Mess", ...
  const facilities = req.body.facilities
    ? (Array.isArray(req.body.facilities) ? req.body.facilities : [req.body.facilities])
    : [];

  if (!name || !city || !monthlyRent) {
    return res.status(400).json({ error: "name, city and monthlyRent are required" });
  }
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: "Upload at least one photo" });
  }
  if (!latitude || !longitude) {
    return res.status(400).json({ error: "Pin the exact location on the map" });
  }

  try {
    // 1. Insert the listing (photos go in a second table).
    const [result] = await db.query(
    `INSERT INTO pgs
       (name, address, city, college_nearby, college_id, monthly_rent, gender, capacity, bhk, area_sqft, furnished, description, latitude, longitude, owner_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
      [
        name,
        address || "",
        city,
        collegeNearby || null,
        collegeId || null,
        monthlyRent,
        ["male", "female", "any"].includes(gender) ? gender : "any",
        capacity || null,
        bhk || null,
        areaSqft || null,
        furnished === "1" || furnished === true ? true : false,
        description || null,
        latitude,
        longitude,
        req.userId,
      ]
    );

    const pgId = result.insertId;

    // 2. Save each photo row. The URL is served by /api/photo static route.
    //    (This is where Cloudinary would return its URL instead of a local path.)
    for (const file of req.files) {
      await db.query(
        "INSERT INTO photos (pg_id, url) VALUES (?, ?)",
        [pgId, "/api/photo/uploads/" + file.filename]
      );
    }

    // 3. Link the selected facilities to this listing.
    //    Names are looked up so we store the same rows the detail page reads.
    if (facilities.length > 0) {
      const placeholders = facilities.map(() => "?").join(", ");
      const [rows] = await db.query(
        `SELECT id FROM facilities WHERE name IN (${placeholders})`,
        facilities
      );
      for (const f of rows) {
        await db.query(
          "INSERT INTO pg_facilities (pg_id, facility_id) VALUES (?, ?) ON CONFLICT DO NOTHING",
          [pgId, f.id]
        );
      }
    }

    res.status(201).json({ ok: true, id: pgId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

// GET /api/properties/my  -> the owner's own listings (for the dashboard)
router.get("/my", async (req, res) => {
  const [rows] = await db.query(
    `SELECT p.id, p.name, p.city, p.monthly_rent, p.bhk, p.area_sqft, p.furnished
     FROM pgs p WHERE p.owner_id = ? ORDER BY p.id DESC`,
    [req.userId]
  );
  res.json({ properties: rows });
});

module.exports = router;
