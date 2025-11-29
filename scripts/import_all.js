#!/usr/bin/env node
/**
 * Bulk import all CSV archives into the template DB (travel_app.template.db) overwriting existing data.
 * Uses process.env.DB_PATH if set, otherwise falls back to the template file.
 * Order matters due to foreign keys: base tables first then junction/child tables.
 */
import fs from 'fs';
import path from 'path';
import sqlite3 from 'sqlite3';

const ROOT = path.resolve(process.cwd(), 'Backend + Database');
const DEFAULT_DB = path.join(ROOT, 'travel_app.template.db');
const DB_PATH = process.env.DB_PATH || DEFAULT_DB;
if (!process.env.DB_PATH) {
  console.log('DB_PATH env not set; using template DB:', DB_PATH);
} else {
  console.log('Using DB_PATH from environment:', DB_PATH);
}
const ARCHIVE = path.join(ROOT, 'scripts', 'db_exports', 'archive');

function requireFile(name) {
  const p = path.join(ARCHIVE, name);
  if (!fs.existsSync(p)) {
    console.warn(`⚠️ Missing CSV: ${name}`);
  }
  return p;
}

// Reuse multiline-safe CSV parser (simplified from import_locations.js)
function parseCSVLine(line) {
  const parts = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; } else inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      parts.push(current); current = ''; 
    } else current += ch;
  }
  parts.push(current);
  return parts.map(v => {
    v = v.trim();
    if (v.startsWith('"') && v.endsWith('"')) return v.slice(1,-1);
    return v;
  });
}

function readCSV(filePath) {
  if (!fs.existsSync(filePath)) return { header: [], rows: [] };
  const raw = fs.readFileSync(filePath, 'utf8').replace(/\r/g,'');
  const physical = raw.split(/\n/);
  const records = [];
  let buf = '';
  const flush = () => { const q = (buf.match(/"/g)||[]).length; if (q % 2 === 0) { records.push(buf); buf=''; } };
  for (const line of physical) { if (!buf) buf = line; else buf += '\n'+line; flush(); }
  if (buf) records.push(buf);
  const logical = records.filter(r => r.trim().length>0);
  if (!logical.length) return { header: [], rows: [] };
  const header = parseCSVLine(logical[0]);
  const rows = logical.slice(1).map(parseCSVLine);
  return { header, rows };
}

function openDb() {
  return new sqlite3.Database(DB_PATH, (err) => {
    if (err) { console.error('❌ DB open failed:', err.message); process.exit(1);} else console.log(`✅ Using DB ${DB_PATH}`); });
}

const db = openDb();

// Helper: run SQL and await completion
function run(sql, params=[]) {
  return new Promise((resolve,reject)=>{ db.run(sql, params, function(err){ if(err) reject(err); else resolve(this); }); });
}
function all(sql, params=[]) {
  return new Promise((resolve,reject)=>{ db.all(sql, params, (err,rows)=>{ if(err) reject(err); else resolve(rows);});});
}
function get(sql, params=[]) { return new Promise((resolve,reject)=>{ db.get(sql, params, (err,row)=>{ if(err) reject(err); else resolve(row);});}); }

async function ensureTables() {
  // Only create if not exists; schema defined in connect.js already covers.
  await run(`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL UNIQUE, email TEXT UNIQUE, password TEXT, total_point INTEGER DEFAULT 0, avatar_url TEXT, dob TEXT, gender TEXT, phone TEXT)`);
  await run(`CREATE TABLE IF NOT EXISTS rewards (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, start_date TEXT, end_date TEXT, description TEXT, cost INTEGER DEFAULT 0, expires_at TEXT, point_reward INTEGER DEFAULT 0, max_uses INTEGER, per_user_limit INTEGER DEFAULT 1)`);
  await run(`CREATE TABLE IF NOT EXISTS challenges (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, description TEXT, start_date TEXT, end_date TEXT, reward_point INTEGER DEFAULT 0, reward_type TEXT)`);
  await run(`CREATE TABLE IF NOT EXISTS Shops (id TEXT PRIMARY KEY, name TEXT NOT NULL, address TEXT, latitude REAL, longitude REAL, rating REAL, ratingCount INTEGER, imageUrl TEXT, galleryImages TEXT, owner_id TEXT, owner_name TEXT, owner_email TEXT, owner_phone TEXT, owner_profile_image_url TEXT, motorbikes TEXT, description TEXT, userReviews TEXT)`);
  await run(`CREATE TABLE IF NOT EXISTS Motorbikes (id TEXT PRIMARY KEY, name TEXT, price_per_hour REAL, available INTEGER, imageUrl TEXT, brakeType TEXT, power TEXT, year INTEGER, engineVolume TEXT, licenseRequired INTEGER, model3dUrl TEXT)`);
  await run(`CREATE TABLE IF NOT EXISTS Rentals (id TEXT PRIMARY KEY, userEmail TEXT, bikeId TEXT, shopId TEXT, rentalStart TEXT, expectedReturn TEXT, isReturned INTEGER, actualReturn TEXT, totalCost REAL, isPaid INTEGER)`);
  await run(`CREATE TABLE IF NOT EXISTS favorites (id TEXT PRIMARY KEY, userEmail TEXT, itemId TEXT, type TEXT, createdAt TEXT)`);
  await run(`CREATE TABLE IF NOT EXISTS locations (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, category TEXT, type TEXT, price REAL DEFAULT 0.0, description TEXT, latitude REAL, longitude REAL, address TEXT, opening_hours TEXT, closing_hours TEXT, image_url TEXT, rating REAL DEFAULT 0.0, review_count INTEGER DEFAULT 0, qr_code TEXT)`);
  await run(`CREATE TABLE IF NOT EXISTS location_images (id INTEGER PRIMARY KEY AUTOINCREMENT, location_id INTEGER NOT NULL, url TEXT NOT NULL, caption TEXT, sort_order INTEGER DEFAULT 0, created_at DATETIME DEFAULT (datetime('now')))`);
  await run(`CREATE TABLE IF NOT EXISTS challenge_reward (challenge_id INTEGER NOT NULL, reward_id INTEGER NOT NULL, PRIMARY KEY (challenge_id,reward_id))`);
  await run(`CREATE TABLE IF NOT EXISTS challenge_location (challenge_id INTEGER NOT NULL, location_id INTEGER NOT NULL, PRIMARY KEY (challenge_id,location_id))`);
  await run(`CREATE TABLE IF NOT EXISTS user_challenge (user_id INTEGER NOT NULL, challenge_id INTEGER NOT NULL, joined_at TEXT, status TEXT, PRIMARY KEY (user_id,challenge_id))`);
  await run(`CREATE TABLE IF NOT EXISTS user_location (user_id INTEGER NOT NULL, location_id INTEGER NOT NULL, checked_in_at TEXT, PRIMARY KEY (user_id,location_id))`);
  // user_reward schema will be managed by connect.js; do not override. Ensure table exists minimally if missing.
  await run(`CREATE TABLE IF NOT EXISTS user_reward (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, reward_id INTEGER NOT NULL, obtained_at TEXT, code TEXT, status TEXT, issued_at TEXT, expires_at TEXT)`);
}

async function wipeTables() {
  const tables = ['user_reward','user_location','user_challenge','challenge_location','challenge_reward','favorites','Rentals','Motorbikes','Shops','locations','location_images','challenges','rewards','users'];
  for (const t of tables) { await run(`DELETE FROM ${t}`); }
}

async function importUsers() {
  const {header, rows} = readCSV(requireFile('users.csv'));
  if (!rows.length) return 0;
  const h = Object.fromEntries(header.map((c,i)=>[c,i]));
  const stmt = await run('BEGIN');
  const insert = db.prepare('INSERT INTO users (id, username, email, password, total_point, avatar_url, dob, gender, phone) VALUES (?,?,?,?,?,?,?,?,?)');
  let count=0;
  for (const r of rows) {
    insert.run([
      r[h.id], r[h.username], r[h.email], r[h.password], r[h.total_point]||0, r[h.avatar_url]||null, r[h.dob]||null, r[h.gender]||null, r[h.phone]||null
    ], err=>{ if(err) console.warn('User insert failed:', err.message); });
    count++;
  }
  insert.finalize();
  await run('COMMIT');
  return count;
}

async function importRewards() {
  const {header, rows} = readCSV(requireFile('rewards.csv'));
  if (!rows.length) return 0;
  const h = Object.fromEntries(header.map((c,i)=>[c,i]));
  const insert = db.prepare('INSERT INTO rewards (id,name,description,cost) VALUES (?,?,?,?)');
  let count=0; for (const r of rows){ insert.run([r[h.id], r[h.name], r[h.description]||null, Number(r[h.cost]||0)], e=>{ if(e) console.warn('Reward insert failed:', e.message);}); count++; }
  insert.finalize(); return count;
}

async function importChallenges() {
  const {header, rows} = readCSV(requireFile('challenges.csv'));
  if (!rows.length) return 0; const h = Object.fromEntries(header.map((c,i)=>[c,i]));
  const insert = db.prepare('INSERT INTO challenges (id,name,description,start_date,end_date,reward_point,reward_type) VALUES (?,?,?,?,?,?,?)');
  let count=0; for (const r of rows){ insert.run([
    r[h.id], r[h.name], r[h.description]||null, r[h.start_date]||null, r[h.end_date]||null, Number(r[h.reward_point]||0), r[h.reward_type]||null
  ], e=>{ if(e) console.warn('Challenge insert failed:', e.message);}); count++; }
  insert.finalize(); return count;
}

async function importLocations() {
  const {header, rows} = readCSV(requireFile('locations.csv'));
  if (!rows.length) return 0; const h = Object.fromEntries(header.map((c,i)=>[c,i]));
  const insert = db.prepare('INSERT INTO locations (id,name,category,type,price,description,latitude,longitude,address,opening_hours,closing_hours,image_url) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)');
  let count=0; for (const r of rows){ insert.run([
    r[h.id], r[h.name], r[h.category]||null, r[h.type]?.toLowerCase()||null, Number(r[h.price]||0), r[h.description]||null,
    r[h.latitude]?Number(r[h.latitude]):null, r[h.longtitude]?Number(r[h.longtitude]):null, r[h.address]||null, r[h.opening_hours]||null, r[h.closing_hours]||null, r[h.image_url]||null
  ], e=>{ if(e) console.warn('Location insert failed:', e.message);}); count++; }
  insert.finalize(); return count;
}

async function importLocationImages() {
  const {header, rows} = readCSV(requireFile('location_images.csv'));
  if (!rows.length) return 0; const h = Object.fromEntries(header.map((c,i)=>[c,i]));
  let orderMap = new Map();
  const insert = db.prepare('INSERT INTO location_images (location_id,url,sort_order) VALUES (?,?,?)');
  let count=0; for (const r of rows){ const locId = r[h.location_id]; let url = r[h.url]; if(!locId||!url) continue; url = url.replace(/,+$/,'').trim(); const order = orderMap.get(locId)||0; insert.run([locId,url,order], e=>{ if(e) console.warn('Image insert failed:', e.message);}); orderMap.set(locId, order+1); count++; }
  insert.finalize(); return count;
}

async function importShops() {
  const {header, rows} = readCSV(requireFile('Shops.csv'));
  if (!rows.length) return 0; const h = Object.fromEntries(header.map((c,i)=>[c,i]));
  // Find dynamic gallery/motorbike/review columns
  const galleryCols = header.filter(c=>/shops\/galleryImages\//.test(c));
  const bikeCols = header.filter(c=>/shops\/motorbikes\//.test(c));
  const reviewGroups = [0,1].map(idx => ({
    userName:`shops/userReviews/${idx}/userName`,
    userAvatarUrl:`shops/userReviews/${idx}/userAvatarUrl`,
    rating:`shops/userReviews/${idx}/rating`,
    comment:`shops/userReviews/${idx}/comment`
  }));
  const insert = db.prepare('INSERT INTO Shops (id,name,address,latitude,longitude,rating,ratingCount,imageUrl,galleryImages,owner_id,owner_name,owner_email,owner_phone,owner_profile_image_url,motorbikes,description,userReviews) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
  let count=0; for (const r of rows){
    const id = r[h['shops/id']]; if(!id) continue;
    const galleryImages = JSON.stringify(galleryCols.map(c=>r[h[c]]).filter(Boolean));
    const motorbikes = JSON.stringify(bikeCols.map(c=>r[h[c]]).filter(Boolean));
    const userReviews = JSON.stringify(reviewGroups.map(g=>({
      userName:r[h[g.userName]], userAvatarUrl:r[h[g.userAvatarUrl]], rating:r[h[g.rating]]?Number(r[h[g.rating]]):null, comment:r[h[g.comment]]
    })).filter(rv=>rv.userName||rv.comment));
    insert.run([
      id,
      r[h['shops/name']]||null,
      r[h['shops/address']]||null,
      r[h['shops/latitude']]?Number(r[h['shops/latitude']]):null,
      r[h['shops/longitude']]?Number(r[h['shops/longitude']]):null,
      r[h['shops/rating']]?Number(r[h['shops/rating']]):null,
      r[h['shops/ratingCount']]?Number(r[h['shops/ratingCount']]):null,
      r[h['shops/imageUrl']]||null,
      galleryImages,
      r[h['shops/owner/id']]||null,
      r[h['shops/owner/name']]||null,
      r[h['shops/owner/email']]||null,
      r[h['shops/owner/phoneNumber']]||null,
      r[h['shops/owner/profileImageUrl']]||null,
      motorbikes,
      r[h['shops/description']]||null,
      userReviews
    ], e=>{ if(e) console.warn('Shop insert failed:', e.message);});
    count++;
  }
  insert.finalize(); return count;
}

async function importMotorbikes() {
  const {header, rows} = readCSV(requireFile('Motorbikes.csv'));
  if (!rows.length) return 0; const h = Object.fromEntries(header.map((c,i)=>[c,i]));
  const insert = db.prepare('INSERT INTO Motorbikes (id,name,price_per_hour,available,imageUrl,brakeType,power,year,engineVolume,licenseRequired,model3dUrl) VALUES (?,?,?,?,?,?,?,?,?,?,?)');
  let count=0; for (const r of rows){
    insert.run([
      r[h['motorbikes/id']], r[h['motorbikes/name']]||null, r[h['motorbikes/pricePerHour']]?Number(r[h['motorbikes/pricePerHour']]):null,
      r[h['motorbikes/available']]? (r[h['motorbikes/available']].toLowerCase()==='true'?1:0):null,
      r[h['motorbikes/imageUrl']]||null,
      r[h['motorbikes/brakeType']]||null,
      r[h['motorbikes/power']]||null,
      r[h['motorbikes/year']]?Number(r[h['motorbikes/year']]):null,
      r[h['motorbikes/engineVolume']]||null,
      r[h['motorbikes/licenseRequired']]? (r[h['motorbikes/licenseRequired']].toLowerCase()==='true'?1:0):null,
      r[h['motorbikes/model3dUrl']]||null
    ], e=>{ if(e) console.warn('Motorbike insert failed:', e.message);}); count++; }
  insert.finalize(); return count;
}

async function importRentals() {
  const {header, rows} = readCSV(requireFile('Rentals.csv'));
  if (!rows.length) return 0; const h = Object.fromEntries(header.map((c,i)=>[c,i]));
  const insert = db.prepare('INSERT INTO Rentals (id,userEmail,bikeId,shopId,rentalStart,expectedReturn,isReturned,actualReturn,totalCost,isPaid) VALUES (?,?,?,?,?,?,?,?,?,?)');
  let count=0; for (const r of rows){
    insert.run([
      r[h['rentals/id']], r[h['rentals/userEmail']]||null, r[h['rentals/bikeId']]||null, r[h['rentals/shopId']]||null,
      r[h['rentals/rentalStart']]||null, r[h['rentals/expectedReturn']]||null,
      r[h['rentals/isReturned']]? (r[h['rentals/isReturned']].toLowerCase()==='true'?1:0):0,
      r[h['rentals/actualReturn']]||null,
      r[h['rentals/totalCost']]?Number(r[h['rentals/totalCost']]):null,
      r[h['rentals/isPaid']]? (r[h['rentals/isPaid']].toLowerCase()==='true'?1:0):0
    ], e=>{ if(e) console.warn('Rental insert failed:', e.message);}); count++; }
  insert.finalize(); return count;
}

async function importFavorites() {
  const {header, rows} = readCSV(requireFile('favorites.csv'));
  if (!rows.length) return 0; const h = Object.fromEntries(header.map((c,i)=>[c,i]));
  const insert = db.prepare('INSERT INTO favorites (id,userEmail,itemId,type,createdAt) VALUES (?,?,?,?,?)');
  let count=0; for (const r of rows){ insert.run([r[h['favorites/id']], r[h['favorites/userEmail']]||null, r[h['favorites/itemId']]||null, r[h['favorites/type']]||null, r[h['favorites/createdAt']]||null], e=>{ if(e) console.warn('Favorite insert failed:', e.message);}); count++; }
  insert.finalize(); return count;
}

async function importChallengeReward() {
  const {header, rows} = readCSV(requireFile('challenge_reward.csv'));
  if (!rows.length) return 0; const h = Object.fromEntries(header.map((c,i)=>[c,i]));
  const insert = db.prepare('INSERT INTO challenge_reward (challenge_id,reward_id) VALUES (?,?)');
  let count=0; for (const r of rows){ insert.run([r[h.challenge_id], r[h.reward_id]], e=>{ if(e) console.warn('Challenge_reward insert failed:', e.message);}); count++; }
  insert.finalize(); return count;
}

async function importChallengeLocation() {
  const {header, rows} = readCSV(requireFile('challenge_location.csv'));
  if (!rows.length) return 0; const h = Object.fromEntries(header.map((c,i)=>[c,i]));
  const insert = db.prepare('INSERT INTO challenge_location (challenge_id,location_id) VALUES (?,?)');
  let count=0; for (const r of rows){ insert.run([r[h.challenge_id], r[h.location_id]], e=>{ if(e) console.warn('Challenge_location insert failed:', e.message);}); count++; }
  insert.finalize(); return count;
}

async function importUserChallenge() {
  const {header, rows} = readCSV(requireFile('user_challenge.csv'));
  if (!rows.length) return 0; const h = Object.fromEntries(header.map((c,i)=>[c,i]));
  const insert = db.prepare('INSERT INTO user_challenge (user_id,challenge_id,joined_at,status) VALUES (?,?,?,?)');
  let count=0; for (const r of rows){ insert.run([r[h.user_id], r[h.challenge_id], r[h.joined_at]||null, r[h.status]||null], e=>{ if(e) console.warn('User_challenge insert failed:', e.message);}); count++; }
  insert.finalize(); return count;
}

async function importUserLocation() {
  const {header, rows} = readCSV(requireFile('user_location.csv'));
  if (!rows.length) return 0; const h = Object.fromEntries(header.map((c,i)=>[c,i]));
  const insert = db.prepare('INSERT INTO user_location (user_id,location_id,checked_in_at) VALUES (?,?,?)');
  let count=0; for (const r of rows){ insert.run([r[h.user_id], r[h.location_id], r[h.checked_in_at]||null], e=>{ if(e) console.warn('User_location insert failed:', e.message);}); count++; }
  insert.finalize(); return count;
}

async function importUserReward() {
  const {header, rows} = readCSV(requireFile('user_reward.csv'));
  if (!rows.length) return 0; const h = Object.fromEntries(header.map((c,i)=>[c,i]));
  // Existing schema (connect.js) uses obtained_at instead of claimed_at and has extra columns; only set obtained_at.
  // If table lacks obtained_at, fall back to claimed_at column name.
  const cols = await all('PRAGMA table_info(user_reward);');
  const hasObtained = cols.some(c=>c.name==='obtained_at');
  const targetCol = hasObtained ? 'obtained_at' : 'claimed_at';
  const insert = db.prepare(`INSERT OR IGNORE INTO user_reward (user_id,reward_id,${targetCol}) VALUES (?,?,?)`);
  let count=0; for (const r of rows){ insert.run([r[h.user_id], r[h.reward_id], r[h.claimed_at]||null], e=>{ if(e) console.warn('User_reward insert failed:', e.message);}); count++; }
  insert.finalize(); return count;
}

async function updateSequences() {
  const autoincrementTables = ['users','rewards','challenges','locations'];
  for (const t of autoincrementTables) {
    try {
      const row = await get(`SELECT MAX(id) as maxId FROM ${t}`);
      if (row && row.maxId) await run(`UPDATE sqlite_sequence SET seq=? WHERE name=?`, [row.maxId, t]);
    } catch (e) { /* ignore if sqlite_sequence missing */ }
  }
}

async function main() {
  console.log('🔧 Ensuring tables exist...');
  await ensureTables();
  console.log('🧹 Wiping old data...');
  await wipeTables();
  console.log('📥 Importing base tables...');
  const users = await importUsers();
  const rewards = await importRewards();
  const challenges = await importChallenges();
  const locations = await importLocations();
  const images = await importLocationImages();
  const shops = await importShops();
  const motorbikes = await importMotorbikes();
  console.log('📥 Importing relational tables...');
  const rentals = await importRentals();
  const favorites = await importFavorites();
  const cr = await importChallengeReward();
  const cl = await importChallengeLocation();
  const uc = await importUserChallenge();
  const ul = await importUserLocation();
  const ur = await importUserReward();
  await updateSequences();
  console.log('✅ Done. Summary:');
  console.table({users,rewards,challenges,locations,images,shops,motorbikes,rentals,favorites,challenge_reward:cr,challenge_location:cl,user_challenge:uc,user_location:ul,user_reward:ur});
  db.close();
}

main().catch(e=>{ console.error('❌ Import failed:', e); db.close(); process.exit(1); });
