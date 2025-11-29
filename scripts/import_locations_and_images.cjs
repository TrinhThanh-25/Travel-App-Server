#!/usr/bin/env node
/**
 * Import cleaned locations and location_images into travel_app.template.db, overwriting tables.
 */
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3');

const ROOT = path.resolve(__dirname, '..');
const DB_PATH = path.join(ROOT, 'travel_app.template.db');
const ARCHIVE = path.join(ROOT, 'scripts', 'db_exports', 'archive');
const LOCATIONS = fs.existsSync(path.join(ARCHIVE, 'locations.cleaned.csv'))
  ? path.join(ARCHIVE, 'locations.cleaned.csv')
  : path.join(ARCHIVE, 'locations.csv');
const IMAGES = fs.existsSync(path.join(ARCHIVE, 'location_images.cleaned.csv'))
  ? path.join(ARCHIVE, 'location_images.cleaned.csv')
  : path.join(ARCHIVE, 'location_images.csv');

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

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) { console.error('❌ DB open failed:', err.message); process.exit(1);} else console.log(`✅ Using DB ${DB_PATH}`); });

function run(sql, params=[]) {
  return new Promise((resolve,reject)=>{ db.run(sql, params, function(err){ if(err) reject(err); else resolve(this); }); });
}

(async function main(){
  console.log('🧹 Wiping locations & location_images...');
  await run('DELETE FROM locations');
  await run('DELETE FROM location_images');

  console.log('📥 Importing locations from', path.basename(LOCATIONS));
  let {header, rows} = readCSV(LOCATIONS);
  if (!rows.length) { console.log('No location rows found'); }
  else {
    const h = Object.fromEntries(header.map((c,i)=>[c,i]));
    const insert = db.prepare('INSERT INTO locations (id,name,category,type,price,description,latitude,longitude,address,opening_hours,closing_hours,image_url) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)');
    let count=0; for (const r of rows){ insert.run([
      r[h.id], r[h.name], r[h.category]||null, r[h.type]?.toLowerCase()||null, Number(r[h.price]||0), r[h.description]||null,
      r[h.latitude]?Number(r[h.latitude]):null, r[h.longtitude]?Number(r[h.longtitude]):null, r[h.address]||null, r[h.opening_hours]||null, r[h.closing_hours]||null, r[h.image_url]||null
    ], e=>{ if(e) console.warn('Location insert failed:', e.message);}); count++; }
    insert.finalize(); console.log('Inserted locations:', count);
    try { await run(`UPDATE sqlite_sequence SET seq=(SELECT MAX(id) FROM locations) WHERE name='locations'`); } catch {}
  }

  console.log('📥 Importing location_images from', path.basename(IMAGES));
  ({header, rows} = readCSV(IMAGES));
  if (!rows.length) { console.log('No location_images rows found'); }
  else {
    const h = Object.fromEntries(header.map((c,i)=>[c,i]));
    const insert = db.prepare('INSERT INTO location_images (location_id,url,sort_order) VALUES (?,?,?)');
    let count=0; const orderMap = new Map();
    for (const r of rows){ const locId = r[h.location_id]; let url = (r[h.url]||'').replace(/,+$/,'').trim(); if(!locId||!url) continue; const order = orderMap.get(locId)||0; insert.run([locId,url,order], e=>{ if(e) console.warn('Image insert failed:', e.message);}); orderMap.set(locId, order+1); count++; }
    insert.finalize(); console.log('Inserted images:', count);
  }

  db.close();
  console.log('✅ Done');
})();
