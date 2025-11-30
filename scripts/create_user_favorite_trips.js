import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = fileURLToPath(new URL('../travel_app.template.db', import.meta.url));

function run(sql) {
  return new Promise((resolve, reject) => {
    db.run(sql, (err) => (err ? reject(err) : resolve()));
  });
}

const db = new sqlite3.Database(dbPath);

db.serialize(async () => {
  try {
    await run('PRAGMA foreign_keys = ON;');

    // Ensure trips.review_count exists (ignore error if already exists)
    await new Promise((resolve) => {
      db.run("ALTER TABLE trips ADD COLUMN review_count INTEGER DEFAULT 0", () => resolve());
    });

    // Create user_favorite_trips table and indexes
    await run(`CREATE TABLE IF NOT EXISTS user_favorite_trips (
      user_id INTEGER NOT NULL,
      trip_id INTEGER NOT NULL,
      PRIMARY KEY (user_id, trip_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE
    )`);

    await run(`CREATE INDEX IF NOT EXISTS idx_user_fav_trips_user ON user_favorite_trips(user_id);`);
    await run(`CREATE INDEX IF NOT EXISTS idx_user_fav_trips_trip ON user_favorite_trips(trip_id);`);

    console.log('✅ user_favorite_trips ensured in', dbPath);
  } catch (e) {
    console.error('❌ Failed to ensure user_favorite_trips:', e && e.message);
    process.exitCode = 1;
  } finally {
    db.close();
  }
});
