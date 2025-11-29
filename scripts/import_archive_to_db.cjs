#!/usr/bin/env node
/*
Import all CSVs from scripts/db_exports/archive into both travel_app.template.db and travel_app.db.
Tables must match CSV headers; rows are upserted or replaced.
*/
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3');
const { parse } = require('csv-parse/sync');

const root = path.resolve(__dirname, '..');
const archiveDir = path.join(__dirname, 'db_exports', 'archive');
const templateDbPath = path.join(root, 'travel_app.template.db');
const mutableDbPath = path.join(root, 'travel_app.db');

function loadCsv(file) {
  const content = fs.readFileSync(file, 'utf8');
  const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
    trim: true
  });
  return records;
}

function openDb(dbPath) {
  return new sqlite3.Database(dbPath);
}

function run(db, sql, params=[]) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err){
      if (err) return reject(err);
      resolve(this);
    });
  });
}

function exec(db, sql) {
  return new Promise((resolve, reject) => db.exec(sql, err => err ? reject(err) : resolve()));
}

async function importTable(db, table, rows) {
  if (!rows.length) return;
  const cols = Object.keys(rows[0]);
  // Ensure table has required columns (add as TEXT if missing)
  const tableInfo = await new Promise((res, rej) => db.all(`PRAGMA table_info(${table});`, (err, rows) => err ? rej(err) : res(rows)));
  const existingCols = new Set((tableInfo || []).map(c => c.name));
  for (const c of cols) {
    if (!existingCols.has(c)) {
      console.log(`Adding missing column ${c} to ${table}`);
      await run(db, `ALTER TABLE ${table} ADD COLUMN ${c} TEXT`);
    }
  }
  const placeholders = cols.map(()=> '?').join(',');
  const insertSQL = `INSERT OR REPLACE INTO ${table} (${cols.join(',')}) VALUES (${placeholders})`;
  await run(db, 'BEGIN');
  try {
    // Clear table before import (overwrite old data)
    await run(db, `DELETE FROM ${table}`);
    const required = {
      location_images: ['url','location_id'],
      locations: ['name'],
      rewards: ['name'],
      challenges: ['name']
    }[table] || [];
    const stmt = db.prepare(insertSQL);
    for (const r of rows) {
      if (required.length && required.some(k => !r[k] || String(r[k]).trim() === '')) {
        continue; // skip invalid rows
      }
      const values = cols.map(c => r[c] === '' ? null : r[c]);
      await new Promise((res, rej) => stmt.run(values, err => err ? rej(err) : res()));
    }
    await new Promise((res, rej) => stmt.finalize(err => err ? rej(err) : res()));
    await run(db, 'COMMIT');
  } catch (e) {
    await run(db, 'ROLLBACK').catch(()=>{});
    throw e;
  }
}

async function main() {
  const files = fs.readdirSync(archiveDir).filter(f => f.endsWith('.csv'));
  const mapping = {
    'users.csv': 'users',
    'locations.csv': 'locations',
    'location_images.csv': 'location_images',
    'rewards.csv': 'rewards',
    'challenges.csv': 'challenges',
    'challenge_location.csv': 'challenge_location',
    'challenge_reward.csv': 'challenge_reward',
    'location_reviews.csv': 'location_reviews',
    'tour_reviews.csv': 'tour_reviews',
    'tours.csv': 'tours',
    'tour_locations.csv': 'tour_locations'
  };

  const dbs = [openDb(templateDbPath), openDb(mutableDbPath)];
  try {
    for (const f of files) {
      const table = mapping[f];
      if (!table) { continue; }
      const full = path.join(archiveDir, f);
      const rows = loadCsv(full);
      for (const db of dbs) {
        await importTable(db, table, rows);
        console.log(`Imported ${rows.length} rows from ${f} into ${path.basename(db.filename)} -> ${table}`);
      }
    }
    console.log('All imports complete.');
  } catch (e) {
    console.error('Import failed:', e.message);
    process.exit(1);
  } finally {
    dbs.forEach(db => db.close());
  }
}

main();
