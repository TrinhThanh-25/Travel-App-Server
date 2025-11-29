#!/usr/bin/env node
/**
 * Import trips.csv and tripsLocation.csv into the template DB (or DB_PATH) without wiping other tables.
 * Usage:
 *   node scripts/import_trips.js            # import only if trips table empty
 *   node scripts/import_trips.js --force    # delete existing trips/tripsLocation rows then import
 *
 * CSVs expected at: Backend + Database/scripts/db_exports/archive/{trips.csv,tripsLocation.csv}
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sqlite3 from 'sqlite3';

// Resolve backend root relative to this script's location to avoid cwd issues
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const ARCHIVE = path.join(ROOT, 'scripts', 'db_exports', 'archive');
const DEFAULT_DB = path.join(ROOT, 'travel_app.template.db');
const DB_PATH = process.env.DB_PATH || DEFAULT_DB;
const FORCE = process.argv.includes('--force');

function csvPath(name) { return path.join(ARCHIVE, name); }

function parseCSVLine(line) {
  const parts = []; let current = ''; let inQuotes = false;
  for (let i=0;i<line.length;i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i+1] === '"') { current += '"'; i++; } else inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) { parts.push(current); current=''; }
    else current += ch;
  }
  parts.push(current);
  return parts.map(v=>{ v=v.trim(); if(v.startsWith('"')&&v.endsWith('"')) return v.slice(1,-1); return v; });
}

function readCSV(fp) {
  if (!fs.existsSync(fp)) return { header: [], rows: [] };
  const raw = fs.readFileSync(fp,'utf8').replace(/\r/g,'');
  const physical = raw.split(/\n/);
  const records=[]; let buf='';
  const flush=()=>{ const q=(buf.match(/"/g)||[]).length; if(q%2===0){ records.push(buf); buf=''; } };
  for (const line of physical) { if(!buf) buf=line; else buf+='\n'+line; flush(); }
  if (buf) records.push(buf);
  const logical = records.filter(r=>r.trim().length>0);
  if(!logical.length) return { header: [], rows: [] };
  const header = parseCSVLine(logical[0]);
  const rows = logical.slice(1).map(parseCSVLine);
  return { header, rows };
}

function openDb() {
  return new sqlite3.Database(DB_PATH, err => {
    if (err) { console.error('❌ DB open failed:', err.message); process.exit(1); }
  });
}

const db = openDb();
function run(sql, params=[]) { return new Promise((res,rej)=>db.run(sql, params, function(e){ if(e) rej(e); else res(this); })); }
function all(sql, params=[]) { return new Promise((res,rej)=>db.all(sql, params, (e,r)=>{ if(e) rej(e); else res(r); })); }
function get(sql, params=[]) { return new Promise((res,rej)=>db.get(sql, params, (e,r)=>{ if(e) rej(e); else res(r); })); }

async function importTrips() {
  const file = csvPath('trips.csv');
  const { header, rows } = readCSV(file);
  if (!rows.length) { console.warn('⚠️ trips.csv empty or missing'); return 0; }
  const h = Object.fromEntries(header.map((c,i)=>[c,i]));
  const insert = db.prepare('INSERT INTO trips (id,title,description,rating,key_highlight,estimate_price,total_time,url_image) VALUES (?,?,?,?,?,?,?,?)');
  let count=0;
  for (const r of rows) {
    insert.run([
      r[h.id], r[h.title]||null, r[h.description]||null,
      r[h.rating]?Number(r[h.rating]):null,
      r[h.key_highlight]||null,
      r[h.estimate_price]?Number(r[h.estimate_price]):null,
      r[h.total_time]?Number(r[h.total_time]):null,
      r[h.url_image]||null
    ], e=>{ if(e) console.warn('Trip insert failed:', e.message); });
    count++;
  }
  insert.finalize();
  return count;
}

async function importTripsLocations() {
  const file = csvPath('tripsLocation.csv');
  const { header, rows } = readCSV(file);
  if (!rows.length) { console.warn('⚠️ tripsLocation.csv empty or missing'); return 0; }
  const h = Object.fromEntries(header.map((c,i)=>[c,i]));
  // Accept columns: trip_id, location_id, order_index (flexible naming fallback)
  const insert = db.prepare('INSERT INTO tripsLocation (trip_id,location_id,order_index) VALUES (?,?,?)');
  let count=0;
  for (const r of rows) {
    const tripId = r[h.trip_id] ?? r[h['trip_id']] ?? r[h['tripId']];
    const locId = r[h.location_id] ?? r[h['location_id']] ?? r[h['locationId']];
  const orderIdxRaw = r[h.order_index] ?? r[h['order_index']] ?? r[h['orderIndex']] ?? r[h.order];
    if (!tripId || !locId) continue;
    const orderIdx = orderIdxRaw ? Number(orderIdxRaw) : null;
    insert.run([tripId, locId, orderIdx], e=>{ if(e) console.warn('TripsLocation insert failed:', e.message); });
    count++;
  }
  insert.finalize();
  return count;
}

async function main() {
  console.log('🗄  Using DB:', DB_PATH);
  // Ensure tables exist (in case template DB predates trips schema)
  await run(`CREATE TABLE IF NOT EXISTS trips (
    id INTEGER PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    rating REAL,
    key_highlight TEXT,
    estimate_price INTEGER,
    total_time INTEGER,
    url_image TEXT
  )`);
  await run(`CREATE TABLE IF NOT EXISTS tripsLocation (
    trip_id INTEGER NOT NULL,
    location_id INTEGER NOT NULL,
    order_index INTEGER,
    PRIMARY KEY (trip_id, location_id),
    FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE,
    FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE CASCADE
  )`);
  const existing = await get('SELECT COUNT(*) as c FROM trips');
  if (existing.c > 0 && !FORCE) {
    console.log(`ℹ️ trips table already has ${existing.c} rows. Use --force to reimport.`);
    db.close();
    return;
  }
  if (FORCE) {
    console.log('🧹 Clearing existing trips & tripsLocation rows (force)...');
    await run('DELETE FROM tripsLocation');
    await run('DELETE FROM trips');
  }
  console.log('📥 Importing trips...');
  const tripsCount = await importTrips();
  console.log('📥 Importing tripsLocation...');
  const mappingCount = await importTripsLocations();
  console.log('✅ Done. Summary:');
  console.table({ trips: tripsCount, tripsLocation: mappingCount });
  db.close();
}

main().catch(e=>{ console.error('❌ Import failed:', e); db.close(); process.exit(1); });
