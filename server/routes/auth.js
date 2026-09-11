const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { z } = require("zod");
const db = require("../db");
const { validate } = require("../middleware/validate");
const { sendOtp } = require("../mailer");

const router = express.Router();

// Strict input contracts: rejects bad emails, short passwords, junk roles
// BEFORE any database work happens.
const registerSchema = z.object({
  name: z.string().trim().min(2, "name must be at least 2 characters").max(100),
  email: z.string().trim().toLowerCase().email("valid email required").max(255),
  password: z.string().min(8, "password must be at least 8 characters").max(128),
  role: z.enum(["student", "owner"]).optional().default("student"),
  phone: z.string().trim().max(20).optional().nullable(),
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("valid email required").max(255),
  password: z.string().min(1, "password is required").max(128),
});

// POST /api/auth/register  body: { name, email, password, role?, phone? }
// role: 'student' (default) or 'owner'.
router.post("/register", validate(registerSchema), async (req, res) => {
  const { name, email, password, role, phone } = req.body;
  const userRole = role === "owner" ? "owner" : "student";

  try {
    // 1. Never let two accounts share an email
    const [existing] = await db.query("SELECT id FROM users WHERE email = ?", [email]);
    if (existing.length > 0) {
      return res.status(409).json({ error: "Email already registered" });
    }

    // 2. Hash the password. "10" = cost factor (salt rounds).
    //    NEVER store the plain password — anyone with DB access could read it.
    const passwordHash = await bcrypt.hash(password, 10);

    // 3. Insert the new user
    const [result] = await db.query(
      "INSERT INTO users (name, email, phone, password_hash, role) VALUES (?, ?, ?, ?, ?) RETURNING id",
      [name, email, phone || null, passwordHash, userRole]
    );

    // 4. Sign a JWT. payload = user id, secret from .env, valid 7 days.
    //    This token is what the client sends on every protected request.
    const token = jwt.sign({ id: result.insertId }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    res.status(201).json({
      token,
      user: { id: result.insertId, name, email, phone: phone || null, role: userRole },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

// POST /api/auth/login  body: { email, password }
router.post("/login", validate(loginSchema), async (req, res) => {
  const { email, password } = req.body;

  try {
    // 1. Find the user by email
    const [rows] = await db.query(
      "SELECT id, name, email, phone, password_hash, role FROM users WHERE email = ?",
      [email]
    );
    if (rows.length === 0) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    const user = rows[0];

    // 2. Check the typed password against the stored hash
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // 3. Sign a fresh JWT
    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

// ---- Forgot password (email OTP) ----

const forgotSchema = z.object({
  email: z.string().trim().toLowerCase().email("valid email required").max(255),
});

const resetSchema = z.object({
  email: z.string().trim().toLowerCase().email("valid email required").max(255),
  otp: z.string().trim().regex(/^\d{6}$/, "6-digit code required"),
  password: z.string().min(8, "password must be at least 8 characters").max(128),
});

// POST /api/auth/forgot  body: { email }
// Sends a 6-digit code (15-min expiry). Always answers ok — never reveals
// whether the email exists. Without SMTP configured, the code is logged
// server-side so flows stay testable (see mailer.js).
router.post("/forgot", validate(forgotSchema), async (req, res) => {
  const { email } = req.body;

  try {
    const [rows] = await db.query("SELECT id FROM users WHERE email = ?", [email]);
    if (rows.length > 0) {
      const otp = String(Math.floor(100000 + Math.random() * 900000));
      const otpHash = await bcrypt.hash(otp, 10);
      await db.query("UPDATE password_resets SET used = true WHERE user_id = ? AND used = false", [
        rows[0].id,
      ]);
      await db.query(
        "INSERT INTO password_resets (user_id, otp_hash, expires_at) VALUES (?, ?, NOW() + INTERVAL '15 minutes')",
        [rows[0].id, otpHash]
      );
      await sendOtp(email, otp);
    }
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

// POST /api/auth/reset  body: { email, otp, password }
router.post("/reset", validate(resetSchema), async (req, res) => {
  const { email, otp, password } = req.body;

  try {
    const [users] = await db.query("SELECT id FROM users WHERE email = ?", [email]);
    if (users.length === 0) return res.status(400).json({ error: "Invalid or expired code" });

    const [resets] = await db.query(
      `SELECT id, otp_hash FROM password_resets
       WHERE user_id = ? AND used = false AND expires_at > NOW()
       ORDER BY id DESC LIMIT 1`,
      [users[0].id]
    );
    if (resets.length === 0) return res.status(400).json({ error: "Invalid or expired code" });

    const match = await bcrypt.compare(otp, resets[0].otp_hash);
    if (!match) return res.status(400).json({ error: "Invalid or expired code" });

    const passwordHash = await bcrypt.hash(password, 10);
    await db.query("UPDATE users SET password_hash = ? WHERE id = ?", [passwordHash, users[0].id]);
    await db.query("UPDATE password_resets SET used = true WHERE id = ?", [resets[0].id]);

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

module.exports = router;
