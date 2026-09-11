// PostgreSQL connection + a tiny mysql2-compatible wrapper.
//
// All 90 db.query call sites were written for mysql2:
//   - `?` placeholders            -> converted here to $1, $2, ...
//   - `const [rows] = ...`        -> SELECT returns [rows]
//   - `result.affectedRows`       -> mapped from pg's rowCount
//   - `result.insertId`           -> mapped from RETURNING id
//     (every INSERT that needs its id now ends with `RETURNING id`)
const { Pool } = require("pg");
const dotenv = require("dotenv");

dotenv.config();

const pool = new Pool({
  host: process.env.PG_HOST || "127.0.0.1",
  port: Number(process.env.PG_PORT || 5432),
  user: process.env.PG_USER || "postgres",
  password: process.env.PG_PASSWORD,
  database: process.env.PG_DATABASE || "mynest",
});

pool.on("error", (err) => console.error("pg pool error:", err.message));

async function query(text, params = []) {
  let i = 0;
  const pgText = text.replace(/\?/g, () => `$${(i += 1)}`);
  const res = await pool.query(pgText, params);
  if (res.command === "INSERT" || res.command === "UPDATE" || res.command === "DELETE") {
    return [
      {
        affectedRows: res.rowCount,
        insertId: res.rows[0] ? res.rows[0].id : undefined,
      },
    ];
  }
  return [res.rows];
}

module.exports = { query, pool };
