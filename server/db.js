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
  // Hosted Postgres (Neon/Render) requires TLS; local Docker does not.
  // On Render, set PG_SSL=true.
  ssl: process.env.PG_SSL === "true" ? { rejectUnauthorized: false } : undefined,
});

pool.on("error", (err) => console.error("pg pool error:", err.message));

// Self-heal for hosted DBs (Neon) where db/chat.pg.sql was never run —
// creates password_resets/conversations/messages if missing so /api/auth/forgot never 500s.
let _initDone = false;
async function ensureChatTables() {
  if (_initDone) return;
  _initDone = true;
  const stmts = [
    `CREATE TABLE IF NOT EXISTS conversations (
       id SERIAL PRIMARY KEY,
       user_a_id INT NOT NULL,
       user_b_id INT NOT NULL,
       post_id INT NULL,
       created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
       CONSTRAINT uq_conversation UNIQUE (user_a_id, user_b_id),
       CONSTRAINT fk_conv_a FOREIGN KEY (user_a_id) REFERENCES users(id) ON DELETE CASCADE,
       CONSTRAINT fk_conv_b FOREIGN KEY (user_b_id) REFERENCES users(id) ON DELETE CASCADE,
       CONSTRAINT fk_conv_post FOREIGN KEY (post_id) REFERENCES roommate_posts(id) ON DELETE SET NULL
     )`,
    `CREATE TABLE IF NOT EXISTS messages (
       id SERIAL PRIMARY KEY,
       conversation_id INT NOT NULL,
       sender_id INT NOT NULL,
       body VARCHAR(2000) NOT NULL,
       is_read BOOLEAN NOT NULL DEFAULT false,
       created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
       CONSTRAINT fk_msg_conv FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
       CONSTRAINT fk_msg_sender FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
     )`,
    `CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id, id)`,
    `CREATE TABLE IF NOT EXISTS password_resets (
       id SERIAL PRIMARY KEY,
       user_id INT NOT NULL,
       otp_hash VARCHAR(255) NOT NULL,
       expires_at TIMESTAMP NOT NULL,
       used BOOLEAN NOT NULL DEFAULT false,
       created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
       CONSTRAINT fk_pr_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
     )`,
  ];
  for (const sql of stmts) {
    try { await pool.query(sql); } catch (e) { console.warn("[db] ensure table failed:", e.message); }
  }
}
ensureChatTables().catch(e => console.warn("[db] init failed:", e.message));

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
