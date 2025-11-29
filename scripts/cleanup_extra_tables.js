// Script to drop tables not defined in the canonical schema (connect.js)
// Usage: node scripts/cleanup_extra_tables.js
// It will list existing tables, compute extras, drop them (with foreign_keys disabled during drop),
// then print the final remaining tables.

import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';

// Reuse DB path logic similar to connect.js default behavior
const DEFAULT_DB = './travel_app.db';
const dbPath = process.env.DB_PATH || DEFAULT_DB;
if (!fs.existsSync(dbPath)) {
  console.error(`Database file not found at ${dbPath}. Aborting.`);
  process.exit(1);
}

// Whitelist of tables defined in connect.js (schema + migrations expectations)
const allowedTables = new Set([
  'users',
  'locations',
  'Shops',
  'location_images',
  'shop_images',
  'Motorbikes',
  'Rentals',
  'favorites',
  'challenges',
  'rewards',
  'challenge_reward',
  'user_reward',
  'user_location',
  'challenge_location',
  'user_challenge',
  'points_transactions',
  'location_reviews',
  'tour_reviews',
  'tours',
  'tour_locations'
]);

// SQLite internal/system tables we never drop
const internalTables = new Set([
  'sqlite_sequence',
  'sqlite_stat1',
  'sqlite_schema',
  'sqlite_master'
]);

const db = new sqlite3.Database(dbPath);

function getTables() {
  return new Promise((resolve, reject) => {
    db.all("SELECT name FROM sqlite_master WHERE type='table';", (err, rows) => {
      if (err) return reject(err);
      resolve(rows.map(r => r.name));
    });
  });
}

function dropTable(name) {
  return new Promise((resolve) => {
    db.run(`DROP TABLE IF EXISTS ${name};`, (err) => {
      if (err) console.warn(`Failed to drop table ${name}:`, err.message);
      else console.log(`Dropped table: ${name}`);
      resolve();
    });
  });
}

async function run() {
  console.log(`🔍 Checking tables in ${path.resolve(dbPath)}`);
  const tables = await getTables();
  console.log('Existing tables:', tables.join(', '));

  const extras = tables.filter(t => !allowedTables.has(t) && !internalTables.has(t));
  if (extras.length === 0) {
    console.log('✅ No extraneous tables found. Nothing to do.');
    db.close();
    return;
  }

  console.log('⚠️ Extraneous tables to drop:', extras.join(', '));
  console.log('Temporarily disabling foreign key enforcement for safe drops...');
  await new Promise(res => db.run('PRAGMA foreign_keys = OFF;', res));

  for (const tbl of extras) {
    await dropTable(tbl);
  }

  console.log('Re-enabling foreign key enforcement...');
  await new Promise(res => db.run('PRAGMA foreign_keys = ON;', res));

  const remaining = await getTables();
  console.log('Remaining tables:', remaining.join(', '));
  console.log('✅ Cleanup complete.');
  db.close();
}

run().catch(err => {
  console.error('Unexpected error during cleanup:', err);
  db.close();
  process.exit(1);
});
