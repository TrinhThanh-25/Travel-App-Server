import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sqlite3 from 'sqlite3';
import { parse } from 'csv-parse/sync';

// Resolve project root (this script lives in scripts/)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Always target the template DB (same logic as db/connect.js)
const dbPath = fileURLToPath(new URL('../travel_app.template.db', import.meta.url));
console.log('ℹ️ Using template DB at', dbPath);

const db = new sqlite3.Database(dbPath);

// CSV file paths (archive exports)
const archiveDir = path.join(rootDir, 'scripts', 'db_exports', 'archive');
const locationsCsv = path.join(archiveDir, 'locations.csv');
const reviewsCsv = path.join(archiveDir, 'location_reviews.csv');
const imagesCsv = path.join(archiveDir, 'location_images.csv');

function safeRead(file) {
  if (!fs.existsSync(file)) throw new Error(`Missing file: ${file}`);
  return fs.readFileSync(file, 'utf8');
}

function parseCsv(content, opts = {}) {
  return parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
    ...opts,
  });
}

function parsePrice(raw) {
  if (!raw) return 0;
  const cleaned = String(raw).replace(/[^0-9.]/g, '');
  if (!cleaned) return 0;
  const val = parseFloat(cleaned);
  return Number.isFinite(val) ? val : 0;
}

function parseFloatOrNull(v) {
  if (v === undefined || v === null || v === '') return null;
  const num = parseFloat(String(v).replace(/\s+/g, ''));
  return Number.isFinite(num) ? num : null;
}

function isValidDateTime(dt) {
  return /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(dt);
}

async function runImport() {
  console.log('🚀 Starting core data overwrite (locations, reviews, images)');
  const locationsRaw = safeRead(locationsCsv);
  const reviewsRaw = safeRead(reviewsCsv);
  const imagesRaw = safeRead(imagesCsv);

  const locationsRows = parseCsv(locationsRaw);
  const reviewRows = parseCsv(reviewsRaw);
  const imageRows = parseCsv(imagesRaw);

  console.log(`📦 Parsed: locations=${locationsRows.length}, reviews=${reviewRows.length}, images=${imageRows.length}`);

  await new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run('BEGIN');

      // Wipe existing rows
      db.run('DELETE FROM location_images');
      db.run('DELETE FROM location_reviews');
      db.run('DELETE FROM locations');

      // Insert locations
      const insertLocation = db.prepare(`INSERT INTO locations (id,name,category,type,price,description,latitude,longitude,address,opening_hours,closing_hours,image_url,rating,review_count) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
      let locInserted = 0, locSkipped = 0;
      for (const r of locationsRows) {
        // CSV headers expected: id,name,category,type,price,description,latitude,longtitude,address,opening_hours,closing_hours,image_url
        const id = parseInt(r.id, 10);
        if (!Number.isFinite(id)) { locSkipped++; continue; }
        const name = r.name && r.name.trim();
        if (!name) { locSkipped++; continue; }
        const latitude = parseFloatOrNull(r.latitude);
        const longitude = parseFloatOrNull(r.longtitude); // map typo column
        const price = parsePrice(r.price);
        insertLocation.run([
          id,
          name,
          r.category || null,
          r.type || null,
          price,
            r.description || null,
          latitude,
          longitude,
          r.address || null,
          r.opening_hours || null,
          r.closing_hours || null,
          r.image_url || null,
          0,
          0,
        ]);
        locInserted++;
      }
      insertLocation.finalize();
      console.log(`✅ Locations inserted=${locInserted}, skipped=${locSkipped}`);

      // Insert reviews (skip malformed lines like id 152, 249 that broke structure)
      const insertReview = db.prepare(`INSERT INTO location_reviews (id,user_id,location_id,rating,comment,created_at) VALUES (?,?,?,?,?,?)`);
      let revInserted = 0, revSkipped = 0;
      for (const r of reviewRows) {
        const id = parseInt(r.id, 10);
        const user_id = parseInt(r.user_id, 10);
        const location_id = parseInt(r.location_id, 10);
        const rating = parseInt(r.rating, 10);
        const comment = r.comment || null;
        const created_at = r.created_at;
        const valid = Number.isFinite(id) && Number.isFinite(user_id) && Number.isFinite(location_id) && Number.isFinite(rating) && rating >= 1 && rating <= 5 && isValidDateTime(created_at);
        if (!valid) { revSkipped++; continue; }
        insertReview.run([id, user_id, location_id, rating, comment, created_at]);
        revInserted++;
      }
      insertReview.finalize();
      console.log(`✅ Reviews inserted=${revInserted}, skipped=${revSkipped}`);

      // Insert images
      const insertImage = db.prepare(`INSERT INTO location_images (location_id,url,sort_order) VALUES (?,?,?)`);
      let imgInserted = 0, imgSkipped = 0;
      let sortTracker = new Map();
      for (const r of imageRows) {
        const location_id = parseInt(r.location_id, 10);
        let url = (r.url || '').trim();
        // Remove trailing comma if present
        if (url.endsWith(',')) url = url.slice(0, -1).trim();
        if (!Number.isFinite(location_id) || !url) { imgSkipped++; continue; }
        const order = sortTracker.get(location_id) || 0;
        insertImage.run([location_id, url, order]);
        sortTracker.set(location_id, order + 1);
        imgInserted++;
      }
      insertImage.finalize();
      console.log(`✅ Images inserted=${imgInserted}, skipped=${imgSkipped}`);

      // Recompute aggregates
      db.run(`UPDATE locations SET rating = COALESCE((SELECT ROUND(AVG(r.rating),2) FROM location_reviews r WHERE r.location_id = locations.id),0), review_count = COALESCE((SELECT COUNT(*) FROM location_reviews r WHERE r.location_id = locations.id),0);`);
      console.log('🔄 Aggregates recomputed (rating, review_count)');

      // Commit transaction
      db.run('COMMIT', (err) => {
        if (err) {
          console.error('❌ Commit failed, rolling back:', err.message);
          db.run('ROLLBACK');
          reject(err);
          return;
        }
        resolve();
      });
    });
  });

  // Basic verification (sample few locations with non-zero reviews)
  await new Promise((resolve) => {
    db.all(`SELECT id, name, rating, review_count FROM locations WHERE review_count > 0 ORDER BY review_count DESC LIMIT 5`, (err, rows) => {
      if (err) console.error('⚠️ Verification query error:', err.message);
      else {
        console.log('🔎 Sample locations with reviews:');
        rows.forEach(r => console.log(` • #${r.id} ${r.name} rating=${r.rating} reviews=${r.review_count}`));
      }
      resolve();
    });
  });

  db.close();
  console.log('✅ Import completed.');
}

runImport().catch(err => {
  console.error('❌ Import script error:', err);
  process.exit(1);
});
