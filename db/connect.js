import sqlite3 from "sqlite3";
import fs from "fs";
import path from "path";
import { fileURLToPath } from 'url';

import dotenv from "dotenv";
// Note: dotenv is loaded from the application entry (`server.js`).
// Avoid calling dotenv.config() here to prevent accidental overriding
// of environment variables when modules are imported directly.

// Enforce use of the template DB file. This repository contains
// `travel_app.template.db` at the project root — always resolve
// an absolute path to that file and use it as the single source of truth
// for database access in this backend.
// Resolve file URL to a proper filesystem path (decode %20 etc.)
const TEMPLATE_DB = fileURLToPath(new URL('../travel_app.template.db', import.meta.url));
const dbPath = TEMPLATE_DB;
console.log('DB connect: forcing DB path to template:', dbPath);

// Ensure directory exists when a nested path is provided (e.g. ./data/travel.db)
try {
  const dir = path.dirname(dbPath);
  if (dir && dir !== "." && !fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
} catch (e) {
  console.warn("⚠️  Could not create DB directory:", e && e.message);
}

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) console.error("❌ Database connection failed:", err.message);
  else console.log(`✅ Connected to SQLite Database at ${dbPath}`);
  
});

db.serialize(() => {
  // Ensure foreign keys are enforced
  db.run(`PRAGMA foreign_keys = ON;`);
  // Drop legacy tour tables (migrating to trips)
  db.run('DROP TABLE IF EXISTS tour_locations');
  db.run('DROP TABLE IF EXISTS tour_reviews');
  db.run('DROP TABLE IF EXISTS tours');
  db.run('DROP TABLE IF EXISTS user_favorite_tours');

  // Users
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      email TEXT UNIQUE,
      password TEXT,
      total_point INTEGER DEFAULT 0,
      avatar_url TEXT,
      dob TEXT,
      gender TEXT,
      phone TEXT
    )
  `);

  // Locations
  db.run(`
    CREATE TABLE IF NOT EXISTS locations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT,
      type TEXT,
      price REAL DEFAULT 0.0,
      description TEXT,
      latitude REAL,
      longitude REAL,
      address TEXT,
      opening_hours TEXT,
      closing_hours TEXT,
      image_url TEXT,
      rating REAL DEFAULT 0.0,
      review_count INTEGER DEFAULT 0,
      qr_code TEXT,
      key_highlights TEXT
    )
  `);

  // Shops table (matches archive/Shops.csv)
  // Create a Shops table that directly matches the CSV header columns (one-to-one)
  // Columns match CSV keys like shops/ratingCount, shops/imageUrl, shops/galleryImages/0, etc.
  db.run(`
    CREATE TABLE IF NOT EXISTS Shops (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      address TEXT,
      latitude REAL,
      longitude REAL,
      rating REAL,
      ratingCount INTEGER,
      imageUrl TEXT,
      galleryImages_0 TEXT,
      galleryImages_1 TEXT,
      owner_id TEXT,
      owner_name TEXT,
      owner_email TEXT,
      owner_phoneNumber TEXT,
      owner_profileImageUrl TEXT,
      motorbikes_0 TEXT,
      motorbikes_1 TEXT,
      motorbikes_2 TEXT,
      motorbikes_3 TEXT,
      motorbikes_4 TEXT,
      motorbikes_5 TEXT,
      motorbikes_6 TEXT,
      description TEXT,
      userReviews_0_userName TEXT,
      userReviews_0_userAvatarUrl TEXT,
      userReviews_0_rating TEXT,
      userReviews_0_comment TEXT,
      userReviews_1_userName TEXT,
      userReviews_1_userAvatarUrl TEXT,
      userReviews_1_rating TEXT,
      userReviews_1_comment TEXT
    )
  `);

  // Trips tables (generated dataset from archive CSVs: trips.csv & tripsLocation.csv)
  db.run(`
    CREATE TABLE IF NOT EXISTS trips (
      id INTEGER PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      rating REAL,
      key_highlight TEXT,
      estimate_price INTEGER,
      total_time INTEGER,
        url_image TEXT,
        review_count INTEGER DEFAULT 0,
        user_id INTEGER,
        created_at TEXT,
        is_post INTEGER DEFAULT 0
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS tripsLocation (
      trip_id INTEGER NOT NULL,
      location_id INTEGER NOT NULL,
      order_index INTEGER,
      PRIMARY KEY (trip_id, location_id),
      FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE,
      FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE CASCADE
    )
  `);
  



  // Images for locations (one-to-many)
  db.run(`
    CREATE TABLE IF NOT EXISTS location_images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      location_id INTEGER NOT NULL,
      url TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0,
      FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE CASCADE
    )
  `);

  // Helpful indexes for location images
  db.run(`CREATE INDEX IF NOT EXISTS idx_location_images_location_id ON location_images(location_id);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_location_images_location_sort ON location_images(location_id, sort_order);`);

  // Images for shops (one-to-many) — shop_id references Shops.id (text)
  db.run(`
    CREATE TABLE IF NOT EXISTS shop_images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shop_id TEXT NOT NULL,
      url TEXT NOT NULL,
      caption TEXT,
      sort_order INTEGER DEFAULT 0,
      FOREIGN KEY (shop_id) REFERENCES Shops(id) ON DELETE CASCADE
    )
  `);

  // Motorbikes table (matches archive/Motorbikes.csv)
  db.run(`
    CREATE TABLE IF NOT EXISTS Motorbikes (
      id TEXT PRIMARY KEY,
      name TEXT,
      price_per_hour REAL,
      available INTEGER,
      imageUrl TEXT,
      brakeType TEXT,
      power TEXT,
      year INTEGER,
      engineVolume TEXT,
      licenseRequired INTEGER,
      model3dUrl TEXT
    )
  `);

  // Rentals table (matches archive/Rentals.csv)
  db.run(`
    CREATE TABLE IF NOT EXISTS Rentals (
      id TEXT PRIMARY KEY,
      userEmail TEXT,
      bikeId TEXT,
      shopId TEXT,
      rentalStart TEXT,
      expectedReturn TEXT,
      isReturned INTEGER,
      actualReturn TEXT,
      totalCost REAL,
      isPaid INTEGER
    )
  `);

  // Favorites table (matches archive/favorites.csv)
  db.run(`
    CREATE TABLE IF NOT EXISTS favorites (
      id TEXT PRIMARY KEY,
      userEmail TEXT,
      itemId TEXT,
      type TEXT,
      createdAt TEXT
    )
  `);

  // Challenges
  db.run(`
    CREATE TABLE IF NOT EXISTS challenges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      start_date TEXT,
      end_date TEXT,
      duration INTEGER,
      reward_point INTEGER DEFAULT 0,
      reward_type TEXT
    )
  `);

  // Rewards
  db.run(`
    CREATE TABLE IF NOT EXISTS rewards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      start_date TEXT,
      end_date TEXT,
      description TEXT,
      cost INTEGER DEFAULT 0,
      expires_at TEXT,
      point_reward INTEGER DEFAULT 0,
      max_uses INTEGER,
      per_user_limit INTEGER DEFAULT 1,
      percent INTEGER DEFAULT 0,
      code TEXT
    )
  `);

  // challenge_reward (challenge -> rewards)
  db.run(`
    CREATE TABLE IF NOT EXISTS challenge_reward (
      challenge_id INTEGER NOT NULL,
      reward_id INTEGER NOT NULL,
      PRIMARY KEY (challenge_id, reward_id),
      FOREIGN KEY (challenge_id) REFERENCES challenges(id) ON DELETE CASCADE,
      FOREIGN KEY (reward_id) REFERENCES rewards(id) ON DELETE CASCADE
    )
  `);

  // NOTE: location_reward removed; rewards are now only associated with challenges.

  // user_reward (which rewards the user has)
  db.run(`
    CREATE TABLE IF NOT EXISTS user_reward (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      reward_id INTEGER NOT NULL,
      obtained_at TEXT DEFAULT (datetime('now')),
      code TEXT,
      status TEXT DEFAULT 'active',
      issued_at TEXT DEFAULT (datetime('now')),
      expires_at TEXT,
      used_at TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (reward_id) REFERENCES rewards(id) ON DELETE CASCADE
    )
  `);

  // user_location (user checkins)
  db.run(`
    CREATE TABLE IF NOT EXISTS user_location (
      user_id INTEGER NOT NULL,
      location_id INTEGER NOT NULL,
      checked_in_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, location_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE CASCADE
    )
  `);

  // challenge_location (which locations are in a challenge)
  db.run(`
    CREATE TABLE IF NOT EXISTS challenge_location (
      challenge_id INTEGER NOT NULL,
      location_id INTEGER NOT NULL,
      PRIMARY KEY (challenge_id, location_id),
      FOREIGN KEY (challenge_id) REFERENCES challenges(id) ON DELETE CASCADE,
      FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE CASCADE
    )
  `);

  // user_challenge (which challenges a user joined)
  db.run(`
    CREATE TABLE IF NOT EXISTS user_challenge (
      user_id INTEGER NOT NULL,
      challenge_id INTEGER NOT NULL,
      joined_at TEXT DEFAULT (datetime('now')),
      status TEXT DEFAULT 'joined',
      PRIMARY KEY (user_id, challenge_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (challenge_id) REFERENCES challenges(id) ON DELETE CASCADE
    )
  `);

  // Generic user activity log to support multiple challenge types (photo uploads, reading tips, watching video, sharing,
  // inviting friends, quiz answers, collecting items, distance sessions, etc.).
  // meta_json can store flexible details: {"meters":1200,"item_key":"archery_badge_1"}
  db.run(`
    CREATE TABLE IF NOT EXISTS user_activity (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      challenge_id INTEGER,
      type TEXT NOT NULL, -- e.g. photo_upload|read_tip|watch_video|share|invite_completed|quiz_correct|collect_item|distance_session
      target_id INTEGER,  -- optional reference (e.g. location_id or content_id)
      meta_json TEXT,     -- arbitrary JSON payload for extensibility
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (challenge_id) REFERENCES challenges(id) ON DELETE SET NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS points_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      reward_id INTEGER,
      points INTEGER NOT NULL,
      type TEXT NOT NULL,
      description TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (reward_id) REFERENCES rewards(id) ON DELETE SET NULL
    )
  `);

  // Refresh tokens for issuing short-lived access tokens (rotatable)
  db.run(`
    CREATE TABLE IF NOT EXISTS user_refresh_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token TEXT NOT NULL UNIQUE,
      expires_at TEXT,
      revoked INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Location reviews table (canonical for location review data)
  db.run(`
    CREATE TABLE IF NOT EXISTS location_reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      location_id INTEGER NOT NULL,
      rating INTEGER NOT NULL,
      comment TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE CASCADE
    )
  `);

  // Favorite trips linking table
  db.run(`
    CREATE TABLE IF NOT EXISTS user_favorite_trips (
      user_id INTEGER NOT NULL,
      trip_id INTEGER NOT NULL,
      PRIMARY KEY (user_id, trip_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE
    )
  `);
  db.run(`CREATE INDEX IF NOT EXISTS idx_user_fav_trips_user ON user_favorite_trips(user_id);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_user_fav_trips_trip ON user_favorite_trips(trip_id);`);

  // Trip reviews table (canonical for trip review data)
  db.run(`
    CREATE TABLE IF NOT EXISTS trip_reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      trip_id INTEGER NOT NULL,
      rating INTEGER NOT NULL,
      comment TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE
    )
  `);

  // Trip images table
  db.run(`
    CREATE TABLE IF NOT EXISTS trip_images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trip_id INTEGER NOT NULL,
      url TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0,
      FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE
    )
  `);

  // (Removed legacy tour_reviews table)

  // Filters feature removed: drop legacy tables if they still exist
  db.all(`SELECT name FROM sqlite_master WHERE type='table' AND name IN ('location_filters','filters')`, (e, rows) => {
    if (!e && rows && rows.length) {
      console.log('Dropping deprecated filter tables...');
      db.run('DROP TABLE IF EXISTS location_filters');
      db.run('DROP TABLE IF EXISTS filters');
    }
  });

  // (Removed legacy tours & tour_locations tables)

  db.run(`
    CREATE TABLE IF NOT EXISTS user_favorite_locations(
      user_id INTEGER NOT NULL,
      location_id INTEGER NOT NULL,
      PRIMARY KEY (user_id, location_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE CASCADE
    )
  `);

  // (Removed legacy user_favorite_tours table)

  // (Removed duplicate legacy tours & tour_locations definitions)

  // Optional indexes for faster lookups
  db.run(`CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_trips_rating ON trips(rating);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_tripsLocation_trip ON tripsLocation(trip_id);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_tripsLocation_trip_order ON tripsLocation(trip_id, order_index);`);
  // Create city index only if city column exists (avoid error on fresh DB without column yet)
  db.all(`PRAGMA table_info(locations);`, (err, cols) => {
    if (!err && Array.isArray(cols) && cols.some(c => c.name === 'city')) {
      db.run(`CREATE INDEX IF NOT EXISTS idx_locations_city ON locations(city);`);
    }
  });
  // Create challenges date index only if the columns exist (backwards-compatible)
  db.all(`PRAGMA table_info(challenges);`, (err, cols) => {
    if (!err && Array.isArray(cols)) {
      const hasStart = cols.some(c => c.name === 'start_date');
      const hasEnd = cols.some(c => c.name === 'end_date');
      if (hasStart && hasEnd) {
        db.run(`CREATE INDEX IF NOT EXISTS idx_challenges_dates ON challenges(start_date, end_date);`);
      }
    }
  });
});

export default db;

// --- Lightweight migration helpers: add missing columns if DB was created with older schema ---
function ensureColumn(table, column, definition) {
  return new Promise((resolve) => {
    db.all(`PRAGMA table_info(${table});`, (err, rows) => {
      if (err || !rows) return resolve();
      const exists = rows.some(r => r.name === column);
      if (!exists) {
        console.log(`Migrating: adding column ${column} to ${table}`);
        // SQLite does not allow adding a UNIQUE constraint as part of ALTER TABLE ADD COLUMN.
        // Stour UNIQUE from the definition for the ALTER, then create a UNIQUE INDEX if requested.
        const hasUnique = /\bUNIQUE\b/i.test(definition);
        // Remove UNIQUE keyword for ALTER TABLE
        const sanitizedDef = definition.replace(/\bUNIQUE\b/ig, '').trim();
        db.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${sanitizedDef};`, (e) => {
          if (e) {
            console.warn(`Could not add column ${column} to ${table}:`, e.message);
            return resolve();
          }

          if (hasUnique) {
            // Create a unique index to emulate UNIQUE column constraint
            const idxName = `ux_${table}_${column}`;
            db.run(`CREATE UNIQUE INDEX IF NOT EXISTS ${idxName} ON ${table}(${column});`, (iErr) => {
              if (iErr) console.warn(`Could not create unique index ${idxName}:`, iErr.message);
              resolve();
            });
          } else {
            resolve();
          }
        });
      } else resolve();
    });
  });
}

async function runMigrations() {
  // Users
  await ensureColumn('users', 'email', 'TEXT UNIQUE');
  await ensureColumn('users', 'password', 'TEXT');
  await ensureColumn('users', 'total_point', 'INTEGER DEFAULT 0');
  await ensureColumn('users', 'avatar_url', 'TEXT');
  await ensureColumn('users', 'dob', 'TEXT');
  await ensureColumn('users', 'gender', 'TEXT');
  await ensureColumn('users', 'phone', 'TEXT');

  // Locations
  await ensureColumn('locations', 'category', 'TEXT');
  await ensureColumn('locations', 'type', 'TEXT');
  await ensureColumn('locations', 'description', 'TEXT');
  await ensureColumn('locations', 'address', 'TEXT');
  await ensureColumn('locations', 'city', 'TEXT');
  await ensureColumn('locations', 'latitude', 'REAL');
  await ensureColumn('locations', 'longitude', 'REAL');
  await ensureColumn('locations', 'opening_hours', "TEXT");
  await ensureColumn('locations', 'closing_hours', "TEXT");
  await ensureColumn('locations', 'rating', 'REAL DEFAULT 0.0');
  await ensureColumn('locations', 'qr_code', 'TEXT');
  await ensureColumn('locations', 'key_highlights', 'TEXT');

  // (Removed tours ensureColumn migrations)

  // Challenges
  await ensureColumn('challenges', 'name', 'TEXT');
  await ensureColumn('challenges', 'description', 'TEXT');
  await ensureColumn('challenges', 'start_date', 'TEXT');
  await ensureColumn('challenges', 'end_date', 'TEXT');
  await ensureColumn('challenges', 'reward_point', 'INTEGER DEFAULT 0');
  await ensureColumn('challenges', 'rules', 'TEXT');
  await ensureColumn('challenges', 'required_checkins', 'INTEGER DEFAULT 0');
  await ensureColumn('challenges', 'reward_type', 'TEXT');
  await ensureColumn('challenges', 'metadata', 'TEXT');
  // New classification + dynamic criteria columns
  await ensureColumn('challenges', 'challenge_type', 'TEXT'); // e.g. checkin|collection|content|action|social|streak|level|quiz
  await ensureColumn('challenges', 'criteria', 'TEXT'); // JSON string: {"target":"checkins","count":3,"scope":"locations","location_ids":[1,2,3]}

  // User challenge progress tracking enhancements
  await ensureColumn('user_challenge', 'progress', 'INTEGER DEFAULT 0');
  await ensureColumn('user_challenge', 'completed_at', 'TEXT');

  // Challenge classification & dynamic criteria already added earlier
  await ensureColumn('challenges', 'challenge_type', 'TEXT');
  await ensureColumn('challenges', 'criteria', 'TEXT');

  // Rewards
  await ensureColumn('rewards', 'start_date', 'TEXT');
  await ensureColumn('rewards', 'end_date', 'TEXT');
  await ensureColumn('rewards', 'point_reward', 'INTEGER DEFAULT 0');
  await ensureColumn('rewards', 'description', 'TEXT');
  await ensureColumn('rewards', 'cost', 'INTEGER DEFAULT 0');
  await ensureColumn('rewards', 'expires_at', 'TEXT');
  await ensureColumn('rewards', 'max_uses', 'INTEGER');
  await ensureColumn('rewards', 'per_user_limit', 'INTEGER DEFAULT 1');
  await ensureColumn('rewards', 'metadata', 'TEXT');
  await ensureColumn('rewards', 'percent', 'INTEGER DEFAULT 0');
  await ensureColumn('rewards', 'code', 'TEXT');

  // user_reward: ensure voucher-related columns exist so existing DBs get them
  await ensureColumn('user_reward', 'code', 'TEXT');
  await ensureColumn('user_reward', 'status', "TEXT DEFAULT 'active'");
  await ensureColumn('user_reward', 'issued_at', 'TEXT');
  await ensureColumn('user_reward', 'expires_at', 'TEXT');
  // Track when a voucher/reward is actually used (redeemed)
  await ensureColumn('user_reward', 'used_at', 'TEXT');

  // Shops: ensure import-friendly columns exist so archive import can upsert fields
  // Ensure CSV-specific columns (explicit per-index columns matching Shops.csv)
  await ensureColumn('Shops', 'ratingCount', 'INTEGER');
  await ensureColumn('Shops', 'imageUrl', 'TEXT');
  await ensureColumn('Shops', 'galleryImages_0', 'TEXT');
  await ensureColumn('Shops', 'galleryImages_1', 'TEXT');
  await ensureColumn('Shops', 'motorbikes_0', 'TEXT');
  await ensureColumn('Shops', 'motorbikes_1', 'TEXT');
  await ensureColumn('Shops', 'motorbikes_2', 'TEXT');
  await ensureColumn('Shops', 'motorbikes_3', 'TEXT');
  await ensureColumn('Shops', 'motorbikes_4', 'TEXT');
  await ensureColumn('Shops', 'motorbikes_5', 'TEXT');
  await ensureColumn('Shops', 'motorbikes_6', 'TEXT');
  await ensureColumn('Shops', 'description', 'TEXT');
  await ensureColumn('Shops', 'userReviews_0_userName', 'TEXT');
  await ensureColumn('Shops', 'userReviews_0_userAvatarUrl', 'TEXT');
  await ensureColumn('Shops', 'userReviews_0_rating', 'TEXT');
  await ensureColumn('Shops', 'userReviews_0_comment', 'TEXT');
  await ensureColumn('Shops', 'userReviews_1_userName', 'TEXT');
  await ensureColumn('Shops', 'userReviews_1_userAvatarUrl', 'TEXT');
  await ensureColumn('Shops', 'userReviews_1_rating', 'TEXT');
  await ensureColumn('Shops', 'userReviews_1_comment', 'TEXT');
  // owner fields matching CSV
  await ensureColumn('Shops', 'owner_id', 'TEXT');
  await ensureColumn('Shops', 'owner_name', 'TEXT');
  await ensureColumn('Shops', 'owner_email', 'TEXT');
  await ensureColumn('Shops', 'owner_phoneNumber', 'TEXT');
  await ensureColumn('Shops', 'owner_profileImageUrl', 'TEXT');

  // Trips: ensure columns exist (in case DB predates addition)
  await ensureColumn('trips', 'title', 'TEXT');
  await ensureColumn('trips', 'description', 'TEXT');
  await ensureColumn('trips', 'rating', 'REAL');
  await ensureColumn('trips', 'review_count', 'INTEGER DEFAULT 0');
  await ensureColumn('trips', 'key_highlight', 'TEXT');
  await ensureColumn('trips', 'estimate_price', 'INTEGER');
  await ensureColumn('trips', 'total_time', 'INTEGER');
  await ensureColumn('trips', 'url_image', 'TEXT');
    await ensureColumn('trips', 'review_count', 'INTEGER DEFAULT 0');
    await ensureColumn('trips', 'user_id', 'INTEGER');
    await ensureColumn('trips', 'created_at', 'TEXT');
    await ensureColumn('trips', 'is_post', 'INTEGER DEFAULT 0');

  // tripsLocation: ensure columns (composite PK created in table DDL already)
  await ensureColumn('tripsLocation', 'order_index', 'INTEGER');

  console.log('Lightweight migrations finished (if any).');

  // Create helpful indexes if tables exist
  db.run(`CREATE INDEX IF NOT EXISTS idx_rewards_cost ON rewards(cost);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_locations_latlon ON locations(latitude, longitude);`);
  // If the new Shops table exists, create an index on its owner_id column
  db.run(`CREATE INDEX IF NOT EXISTS idx_shops_owner ON Shops(owner_id);`);
  // Ensure voucher codes are unique to avoid collisions (stored on user_reward)
  db.run(`CREATE UNIQUE INDEX IF NOT EXISTS ux_user_reward_code ON user_reward(code);`);
  // If you want to prevent a user from redeeming the same reward multiple times,
  // uncomment the following line to enforce a unique (user_id, reward_id) constraint on `user_reward`:
  // db.run(`CREATE UNIQUE INDEX IF NOT EXISTS ux_user_reward_user_reward ON user_reward(user_id, reward_id);`);

  // Drop deprecated location_reward table if it exists (rewards are only for challenges now)
  db.all(`SELECT name FROM sqlite_master WHERE type='table' AND name='location_reward'`, (e, rows) => {
    if (!e && rows && rows.length) {
      console.log('Dropping deprecated table: location_reward');
      db.run('DROP TABLE IF EXISTS location_reward');
    }
  });
}

// Run migrations asynchronously but don't block export; they operate on the same DB handle.
export const ready = runMigrations().catch(err => console.warn('Migration check failed:', err && err.message));