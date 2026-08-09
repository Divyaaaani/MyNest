// Fallback: assigns free Unsplash room/hostel photos to real PGs fetched from
// Google that have no photos yet (because Google billing withholds photo data).
//
// Run: node scripts/add-fallback-photos.js
// Safe to re-run — skips PGs that already have photos.

require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const db = require("../db");

// Curated room / hostel / apartment photos (Unsplash). All free to use.
const POOL = [
  "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=900&q=70",
  "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=900&q=70",
  "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=900&q=70",
  "https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=900&q=70",
  "https://images.unsplash.com/photo-1493809842364-78817add7ffb?auto=format&fit=crop&w=900&q=70",
  "https://images.unsplash.com/photo-1523217582562-09d0def993a6?auto=format&fit=crop&w=900&q=70",
  "https://images.unsplash.com/photo-1512918728675-ed5a9ecdebfd?auto=format&fit=crop&w=900&q=70",
  "https://images.unsplash.com/photo-1567767292278-a4f21aa2d36e?auto=format&fit=crop&w=900&q=70",
  "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=900&q=70",
  "https://images.unsplash.com/photo-1502005229762-cf1b2da7c5d6?auto=format&fit=crop&w=900&q=70",
];

async function main() {
  const [pgs] = await db.query(
    `SELECT p.id, p.name, p.college_nearby,
            (SELECT COUNT(*) FROM photos ph WHERE ph.pg_id = p.id) AS photo_count
     FROM pgs p`
  );

  let added = 0;
  for (const pg of pgs) {
    if (pg.photo_count > 0) continue; // already has photos

    // Pick 3 photos, offset so each PG looks different.
    const start = (pg.id * 3) % POOL.length;
    for (let i = 0; i < 3; i++) {
      const url = POOL[(start + i) % POOL.length];
      await db.query("INSERT INTO photos (pg_id, url) VALUES (?, ?)", [pg.id, url]);
      added++;
    }
    console.log(`+ 3 photos -> "${pg.name}" (near ${pg.college_nearby})`);
  }

  console.log(`\nDone. Added ${added} fallback photos.`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Script failed:", err);
  process.exit(1);
});
