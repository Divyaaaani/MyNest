// Fetches REAL PG/hostel listings from the Google Places API (New) for every
// college in the DB, downloads their photos to server/public/photos/,
// and inserts them into the `pgs` + `photos` tables.
//
// NOTE: Google has no rent/capacity/facility data, so those fields get
// sensible defaults (edit manually in the DB afterwards).
//
// HOW TO RUN (after adding your key):
//   1. Set GOOGLE_PLACES_KEY in server/.env
//   2. cd server && node scripts/fetch-real-pgs.js
//
// Prices: change DEFAULT_RENT / DEFAULT_CAPACITY below.

require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

const fs = require("fs");
const path = require("path");
const https = require("https");
const db = require("../db");

const KEY = process.env.GOOGLE_PLACES_KEY;
const PHOTOS_DIR = path.join(__dirname, "..", "public", "photos");
const PHOTOS_PER_PG = 3;        // how many photos to download per PG
const RESULTS_PER_COLLEGE = 4;  // how many PGs to keep per college

const DEFAULT_RENT = 6000.00;   // Google doesn't expose rents
const DEFAULT_CAPACITY = 4;
const OWNER_ID = 1;             // owner of the seeded PGs

if (!KEY) {
  console.error("No GOOGLE_PLACES_KEY in server/.env — add it then re-run.");
  console.error("Get one at https://console.cloud.google.com/apis (enable Places API).");
  process.exit(1);
}

fs.mkdirSync(PHOTOS_DIR, { recursive: true });

function httpGet(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        let body = "";
        res.on("data", (c) => (body += c));
        res.on("end", () => {
          try {
            resolve(JSON.parse(body));
          } catch (err) {
            reject(err);
          }
        });
      })
      .on("error", reject);
  });
}

// New Places API text search (POST with a field mask header).
function textSearch(textQuery, lat, lng) {
  const body = JSON.stringify({
    textQuery,
    locationBias: {
      circle: { center: { latitude: lat, longitude: lng }, radius: 3000 },
    },
  });

  return new Promise((resolve, reject) => {
    const req = https.request(
      "https://places.googleapis.com/v1/places:searchText",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": KEY,
          "X-Goog-FieldMask":
            "places.id,places.displayName,places.formattedAddress,places.location,places.photos",
        },
      },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          try {
            resolve(JSON.parse(data));
          } catch (err) {
            reject(err);
          }
        });
      }
    );
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

// New Places API photo bytes endpoint:
// GET https://places.googleapis.com/v1/{photo.name}/media?maxHeightPx=900&key=KEY
function photoUrl(photoName) {
  const clean = photoName.replace(/^\/+/, "");
  return `https://places.googleapis.com/v1/${clean}/media?maxHeightPx=900&key=${KEY}`;
}

function download(url, dest, redirects = 5) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https
      .get(url, (res) => {
        // Google's photo endpoint answers 302 -> follow it (https.get won't).
        if ([301, 302, 303, 307, 308].includes(res.statusCode)) {
          if (!res.headers.location || redirects === 0) {
            file.close();
            fs.unlinkSync(dest);
            return reject(new Error("HTTP " + res.statusCode));
          }
          res.resume(); // drain before recursing
          file.close();
          fs.unlinkSync(dest, () => {});
          return resolve(download(res.headers.location, dest, redirects - 1));
        }
        if (res.statusCode !== 200) {
          file.close();
          fs.unlinkSync(dest);
          return reject(new Error("HTTP " + res.statusCode));
        }
        res.pipe(file);
        file.on("finish", () => file.close(resolve));
      })
      .on("error", (err) => {
        file.close();
        fs.unlinkSync(dest, () => {});
        reject(err);
      });
  });
}

async function main() {
  const [colleges] = await db.query("SELECT id, name, city, latitude, longitude FROM colleges");

  let added = 0;
  let photosAdded = 0;

  for (const college of colleges) {
    console.log(`\n=== ${college.name} ===`);

    const query = `PG hostel accommodation students near ${college.name} ${college.city}`;
    const data = await textSearch(query, college.latitude, college.longitude);

    if (data.error) {
      console.error(`  Places API error: ${data.error.code} ${data.error.message}`);
      continue;
    }

    const results = (data.places || []).slice(0, RESULTS_PER_COLLEGE);
    console.log(`  found ${data.places ? data.places.length : 0}, keeping ${results.length}`);

    for (const place of results) {
      const name = place.displayName && place.displayName.text ? place.displayName.text : "Unknown";
      const address = place.formattedAddress || "Address not available";
      const lat = place.location ? place.location.latitude : null;
      const lng = place.location ? place.location.longitude : null;
      if (!lat || !lng) {
        console.log(`  skip "${name}" (no coordinates)`);
        continue;
      }

      // Skip obvious non-PGs (hotels, schools, trusts...). Real hostels stay.
      if (/hotel|school|trust|restaurant|hospital|banquet|mall/i.test(name)) {
        console.log(`  skip "${name}" (not a PG/hostel)`);
        continue;
      }

      // Skip if we already added this exact PG (same name + college).
      const [dup] = await db.query(
        "SELECT id FROM pgs WHERE name = ? AND college_nearby = ?",
        [name, college.name]
      );
      if (dup.length > 0) {
        console.log(`  skip "${name}" (already added)`);
        continue;
      }

      const [insert] = await db.query(
        `INSERT INTO pgs
           (name, address, city, college_nearby, monthly_rent, capacity,
            latitude, longitude, owner_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
        [
          name.slice(0, 150),
          address.slice(0, 255),
          college.city,
          college.name,
          DEFAULT_RENT,
          DEFAULT_CAPACITY,
          lat,
          lng,
          OWNER_ID,
        ]
      );
      const pgId = insert.insertId;
      added++;
      console.log(`  + added "${name}" (id ${pgId})`);

      // New API photo names look like: places/PLACE_ID/photos/PHOTO_REF
      const photoNames = (place.photos || []).slice(0, PHOTOS_PER_PG).map((p) => p.name);
      let kept = 0;
      for (let i = 0; i < photoNames.length; i++) {
        const file = `${pgId}-${i + 1}.jpg`;
        const dest = path.join(PHOTOS_DIR, file);
        try {
          await download(photoUrl(photoNames[i]), dest);
          await db.query("INSERT INTO photos (pg_id, url) VALUES (?, ?)", [
            pgId,
            `/api/photo/${file}`,
          ]);
          photosAdded++;
          kept++;
        } catch (err) {
          console.log(`  photo ${i + 1} failed (${err.message}) — skipped`);
        }
      }
      if (kept === 0) {
        console.log(`  (no photos for "${name}")`);
      }
    }

    // Be polite to the free tier.
    await new Promise((r) => setTimeout(r, 500));
  }

  console.log(`\nDone. Added ${added} PGs and ${photosAdded} photos.`);
  console.log(`Photos saved to: ${PHOTOS_DIR}`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Script failed:", err);
  process.exit(1);
});
