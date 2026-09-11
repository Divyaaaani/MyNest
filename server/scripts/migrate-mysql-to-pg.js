// One-time move: copies every row from MySQL into PostgreSQL.
// Preserves ids (so all FK links stay intact), converts TINYINT flags to
// booleans, resets SERIAL sequences, and is re-runnable (ON CONFLICT skips).
//
//   cd server && node scripts/migrate-mysql-to-pg.js
//
// Reads MySQL via DB_* in .env, writes Postgres via PG_* in .env.
require("dotenv").config();
const mysql = require("mysql2/promise");
const { Pool } = require("pg");

const my = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

const pg = new Pool({
  host: process.env.PG_HOST || "127.0.0.1",
  port: Number(process.env.PG_PORT || 5432),
  user: process.env.PG_USER || "postgres",
  password: process.env.PG_PASSWORD,
  database: process.env.PG_DATABASE || "mynest",
});

const BOOL = (v) => (v === true || v === 1 || v === "1" ? true : false);

// [table, columns, bool column indexes] — table is the Postgres name;
// the loop derives the MySQL name (quoted groups table).
// Q = backtick character, built by code to keep this file backtick-free.
const Q = String.fromCharCode(96);
const TABLES = [
  ["users", ["id", "name", "email", "phone", "password_hash", "role", "created_at"], []],
  ['"groups"', ["id", "name", "owner_id", "created_at"], []],
  ["memberships", ["id", "user_id", "group_id", "monthly_due", "phone", "rent_due_day", "bill_due_day"], []],
  ["monthly_cycles", ["id", "group_id", "month", "year"], []],
  ["payments", ["id", "cycle_id", "membership_id", "type", "amount", "paid_at"], []],
  ["colleges", ["id", "name", "city", "latitude", "longitude"], []],
  ["pgs", ["id", "name", "address", "city", "college_nearby", "college_id", "monthly_rent", "gender", "capacity", "bhk", "area_sqft", "furnished", "description", "latitude", "longitude", "owner_id", "group_id"], [11]],
  ["photos", ["id", "pg_id", "url"], []],
  ["facilities", ["id", "name"], []],
  ["pg_facilities", ["pg_id", "facility_id"], []],
  ["roommate_requests", ["id", "pg_id", "user_id", "message", "slots", "created_at"], []],
  ["roommate_applicants", ["id", "request_id", "user_id", "message", "status", "created_at"], []],
  ["roommate_posts", ["id", "user_id", "title", "message", "city", "budget_max", "created_at"], []],
  ["roommate_post_comments", ["id", "post_id", "user_id", "message", "created_at"], []],
  ["group_join_requests", ["id", "group_id", "user_id", "message", "status", "created_at"], []],
  ["rent_requests", ["id", "pg_id", "user_id", "message", "status", "created_at"], []],
  ["notifications", ["id", "user_id", "title", "message", "type", "is_read", "created_at"], [5]],
];

async function main() {
  let total = 0;
  for (const [table, cols, boolIdx] of TABLES) {
    const myTable = table === '"groups"' ? Q + "groups" + Q : table;
    const [rows] = await my.query(`SELECT ${cols.join(", ")} FROM ${myTable}`);
    if (rows.length === 0) {
      console.log(`- ${table}: 0 rows, skipped`);
      continue;
    }
    const placeholders = cols.map((_, i) => `$${i + 1}`).join(", ");
    const sql = `INSERT INTO ${table} (${cols.join(", ")}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`;
    let copied = 0;
    for (const r of rows) {
      const vals = cols.map((c, i) => {
        let v = r[c];
        if (v instanceof Date) v = v; // pg accepts JS Dates
        if (boolIdx.includes(i)) return BOOL(v);
        return v === undefined ? null : v;
      });
      const res = await pg.query(sql, vals);
      copied += res.rowCount;
    }
    total += copied;
    console.log(`- ${table}: ${rows.length} read, ${copied} copied`);
  }

  // SERIAL sequences must jump past the preserved ids.
  for (const [table] of TABLES) {
    if (table === "pg_facilities") continue; // composite PK, no sequence
    await pg.query(`SELECT setval(pg_get_serial_sequence('${table}', 'id'), (SELECT COALESCE(MAX(id), 1) FROM ${table}))`);
  }
  console.log(`\nDone. ${total} rows copied. Sequences reset.`);
  await my.end();
  await pg.end();
}

main().catch((err) => {
  console.error("Migration failed:", err.message);
  process.exit(1);
});
