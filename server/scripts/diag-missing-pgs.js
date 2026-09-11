// Temp diagnostic: which MySQL PGs didn't make it into Postgres?
require("dotenv").config();
const mysql = require("mysql2/promise");
const { Pool } = require("pg");

(async () => {
  const my = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });
  const pg = new Pool({
    host: process.env.PG_HOST,
    port: Number(process.env.PG_PORT),
    user: process.env.PG_USER,
    password: process.env.PG_PASSWORD,
    database: process.env.PG_DATABASE,
  });
  const [myRows] = await my.query("SELECT id, name, group_id FROM pgs ORDER BY id");
  const { rows: pgRows } = await pg.query("SELECT id FROM pgs ORDER BY id");
  const pgIds = new Set(pgRows.map((r) => r.id));
  const missing = myRows.filter((r) => !pgIds.has(r.id));
  console.log("mysql pgs: " + myRows.length + ", pg pgs: " + pgRows.length + ", missing: " + missing.length);
  missing.forEach((r) => console.log("  MISSING id=" + r.id + " group=" + r.group_id + " " + r.name));
  const [dup] = await my.query(
    "SELECT group_id, COUNT(*) c FROM pgs WHERE group_id IS NOT NULL GROUP BY group_id HAVING c > 1"
  );
  console.log("shared group_ids: " + JSON.stringify(dup));
  await my.end();
  await pg.end();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
