import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse';
import { stringify } from 'csv-stringify';

function toNumber(val) {
  if (val == null) return '';
  let s = String(val).trim();
  if (s === '') return '';
  s = s.replace(/[\,\s]/g, '');
  s = s.replace(/[^0-9.-]/g, '');
  const firstDot = s.indexOf('.');
  if (firstDot !== -1) {
    const before = s.slice(0, firstDot + 1);
    const after = s.slice(firstDot + 1).replace(/\./g, '');
    s = before + after;
  }
  const num = Number(s);
  return Number.isFinite(num) ? num : '';
}

function toCoord(val, type) {
  if (val == null) return '';
  let s = String(val).trim();
  if (s === '') return '';
  s = s.replace(',', '.');
  s = s.replace(/\s+/g, '');
  const num = Number(s);
  if (!Number.isFinite(num)) return '';
  if (type === 'lat' && (num < -90 || num > 90)) return '';
  if (type === 'lon' && (num < -180 || num > 180)) return '';
  return num;
}

function normalizeImageUrl(val) {
  if (!val) return '';
  let s = String(val).trim().replace(/^"|"$/g, '');
  if (s === '') return '';
  if (/^https?:\/\//i.test(s)) return s;
  s = s.replace(/^\.\//, '');
  s = s.replace(/^images\//, '');
  return `/images/${s}`;
}

const inputPath = path.resolve('scripts/db_exports/archive/locations.csv');
const outputPath = inputPath;

async function main() {
  const parser = fs.createReadStream(inputPath).pipe(parse({ columns: true, skip_empty_lines: true }));
  const rows = [];
  for await (const record of parser) {
    const rec = { ...record };

    // Address cleanup
    if ('address' in rec || 'Address' in rec) {
      const key = 'address' in rec ? 'address' : 'Address';
      let address = String(rec[key] ?? '').replace(/\bViet\s?Nam\b/gi, '').replace(/\bVietnam\b/gi, '').trim();
      address = address.replace(/[\s,]+$/g, '');
      rec[key] = address;
    }

    // Latitude
    for (const k of ['latitude','lat','Latitude']) if (k in rec) rec[k] = toCoord(rec[k], 'lat');

    // Longitude including misspelling
    for (const k of ['longitude','lon','Longitude','longtitude','Longtitude']) if (k in rec) rec[k] = toCoord(rec[k], 'lon');
    if (!('longitude' in rec) && ('longtitude' in rec)) rec['longitude'] = rec['longtitude'];

    // Cost/Price
    for (const k of ['cost','price','Cost','Price']) if (k in rec) rec[k] = toNumber(rec[k]);

    // Image URL
    for (const k of ['imageUrl','image_url','ImageUrl','Image']) if (k in rec) rec[k] = normalizeImageUrl(rec[k]);

    // Preserve original key order, then add new standard keys
    const ordered = {};
    for (const k of Object.keys(record)) ordered[k] = rec[k];
    for (const extra of ['latitude','longitude','imageUrl']) {
      if (extra in rec && !(extra in ordered)) ordered[extra] = rec[extra];
    }
    rows.push(ordered);
  }

  await new Promise((resolve, reject) => {
    stringify(rows, { header: true }, (err, output) => {
      if (err) return reject(err);
      fs.writeFile(outputPath, output, (e) => (e ? reject(e) : resolve()));
    });
  });
  console.log('✅ Fixed and formatted locations in-place at', outputPath);
}

main().catch(e => { console.error(e); process.exit(1); });
