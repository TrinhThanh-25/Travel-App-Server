#!/usr/bin/env node
/*
Import Motorbikes.csv and Shops.csv into SQLite tables Motorbikes and Shops.
- Wipes existing data (DELETE FROM ...)
- Maps CSV headers with slashes to normalized DB columns
- Cleans common formatting issues (booleans, numbers, stray quotes/commas)
*/

const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const { parse } = require('csv-parse/sync');

const ROOT = path.resolve(__dirname, '..');
const DB_PATH = path.join(ROOT, 'travel_app.template.db');
const ARCHIVE_DIR = path.join(ROOT, 'scripts', 'db_exports', 'archive');
const MOTORBIKES_CSV = path.join(ARCHIVE_DIR, 'Motorbikes.csv');
const SHOPS_CSV = path.join(ARCHIVE_DIR, 'Shops.csv');

function cleanText(val) {
  if (val == null) return null;
  let s = String(val).trim();
  // remove wrapping quotes and stray trailing commas inside quoted fields
  if (s.startsWith('"') && s.endsWith('"')) s = s.slice(1, -1);
  if (s.endsWith(',')) s = s.slice(0, -1);
  return s;
}

function toBool(val) {
  const s = cleanText(val);
  if (!s) return null;
  if (/^(true|1)$/i.test(s)) return 1;
  if (/^(false|0)$/i.test(s)) return 0;
  return null;
}

function toFloat(val) {
  const s = cleanText(val);
  if (!s) return null;
  const num = parseFloat(s.replace(/,/g, ''));
  return Number.isFinite(num) ? num : null;
}

function toInt(val) {
  const s = cleanText(val);
  if (!s) return null;
  const num = parseInt(s.replace(/,/g, ''), 10);
  return Number.isFinite(num) ? num : null;
}

function readCsv(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return parse(raw, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
    trim: false,
  });
}

function importMotorbikes(db) {
  const rows = readCsv(MOTORBIKES_CSV);
  console.log(`Motorbikes CSV rows: ${rows.length}`);

  // Prepare wipe
  db.run('DELETE FROM Motorbikes');

  const stmt = db.prepare(`
    INSERT INTO Motorbikes (
      id, name, price_per_hour, available, imageUrl,
      brakeType, power, year, engineVolume, licenseRequired, model3dUrl
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET
      name=excluded.name,
      price_per_hour=excluded.price_per_hour,
      available=excluded.available,
      imageUrl=excluded.imageUrl,
      brakeType=excluded.brakeType,
      power=excluded.power,
      year=excluded.year,
      engineVolume=excluded.engineVolume,
      licenseRequired=excluded.licenseRequired,
      model3dUrl=excluded.model3dUrl
  `);

  let inserted = 0;
  for (const r of rows) {
    const id = cleanText(r['motorbikes/id']);
    const name = cleanText(r['motorbikes/name']);
    const pricePerHour = toFloat(r['motorbikes/pricePerHour']);
    const available = toBool(r['motorbikes/available']);
    const imageUrl = cleanText(r['motorbikes/imageUrl']);
    const brakeType = cleanText(r['motorbikes/brakeType']);
    const power = cleanText(r['motorbikes/power']);
    const year = toInt(r['motorbikes/year']);
    const engineVolume = cleanText(r['motorbikes/engineVolume']);
    const licenseRequired = toInt(r['motorbikes/licenseRequired']);
    const model3dUrl = cleanText(r['motorbikes/model3dUrl']);

    if (!id || !name) continue; // minimal sanity

    stmt.run(
      id,
      name,
      pricePerHour,
      available,
      imageUrl,
      brakeType,
      power,
      year,
      engineVolume,
      licenseRequired,
      model3dUrl
    );
    inserted++;
  }
  stmt.finalize();
  console.log(`Inserted Motorbikes: ${inserted}`);
}

function importShops(db) {
  const rows = readCsv(SHOPS_CSV);
  console.log(`Shops CSV rows: ${rows.length}`);

  db.run('DELETE FROM Shops');

  const stmt = db.prepare(`
    INSERT INTO Shops (
      id, name, address, latitude, longitude, rating, ratingCount, imageUrl,
      galleryImages_0, galleryImages_1,
      owner_id, owner_name, owner_email, owner_phoneNumber, owner_profileImageUrl,
      motorbikes_0, motorbikes_1, motorbikes_2, motorbikes_3, motorbikes_4, motorbikes_5, motorbikes_6,
      description,
      userReviews_0_userName, userReviews_0_userAvatarUrl, userReviews_0_rating, userReviews_0_comment,
      userReviews_1_userName, userReviews_1_userAvatarUrl, userReviews_1_rating, userReviews_1_comment
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET
      name=excluded.name,
      address=excluded.address,
      latitude=excluded.latitude,
      longitude=excluded.longitude,
      rating=excluded.rating,
      ratingCount=excluded.ratingCount,
      imageUrl=excluded.imageUrl,
      galleryImages_0=excluded.galleryImages_0,
      galleryImages_1=excluded.galleryImages_1,
      owner_id=excluded.owner_id,
      owner_name=excluded.owner_name,
      owner_email=excluded.owner_email,
      owner_phoneNumber=excluded.owner_phoneNumber,
      owner_profileImageUrl=excluded.owner_profileImageUrl,
      motorbikes_0=excluded.motorbikes_0,
      motorbikes_1=excluded.motorbikes_1,
      motorbikes_2=excluded.motorbikes_2,
      motorbikes_3=excluded.motorbikes_3,
      motorbikes_4=excluded.motorbikes_4,
      motorbikes_5=excluded.motorbikes_5,
      motorbikes_6=excluded.motorbikes_6,
      description=excluded.description,
      userReviews_0_userName=excluded.userReviews_0_userName,
      userReviews_0_userAvatarUrl=excluded.userReviews_0_userAvatarUrl,
      userReviews_0_rating=excluded.userReviews_0_rating,
      userReviews_0_comment=excluded.userReviews_0_comment,
      userReviews_1_userName=excluded.userReviews_1_userName,
      userReviews_1_userAvatarUrl=excluded.userReviews_1_userAvatarUrl,
      userReviews_1_rating=excluded.userReviews_1_rating,
      userReviews_1_comment=excluded.userReviews_1_comment
  `);

  let inserted = 0;
  for (const r of rows) {
    const id = cleanText(r['shops/id']);
    const name = cleanText(r['shops/name']);
    const address = cleanText(r['shops/address']);
    const latitude = toFloat(r['shops/latitude']);
    const longitude = toFloat(r['shops/longitude']);
    const rating = toFloat(r['shops/rating']);
    const ratingCount = toInt(r['shops/ratingCount']);
    const imageUrl = cleanText(r['shops/imageUrl']);
    const gallery0 = cleanText(r['shops/galleryImages/0']);
    const gallery1 = cleanText(r['shops/galleryImages/1']);
    const owner_id = cleanText(r['shops/owner/id']);
    const owner_name = cleanText(r['shops/owner/name']);
    const owner_email = cleanText(r['shops/owner/email']);
    const owner_phoneNumber = cleanText(r['shops/owner/phoneNumber']);
    const owner_profileImageUrl = cleanText(r['shops/owner/profileImageUrl']);
    const m0 = cleanText(r['shops/motorbikes/0']);
    const m1 = cleanText(r['shops/motorbikes/1']);
    const m2 = cleanText(r['shops/motorbikes/2']);
    const m3 = cleanText(r['shops/motorbikes/3']);
    const m4 = cleanText(r['shops/motorbikes/4']);
    const m5 = cleanText(r['shops/motorbikes/5']);
    const m6 = cleanText(r['shops/motorbikes/6']);
    const description = cleanText(r['shops/description']);
    const ur0_name = cleanText(r['shops/userReviews/0/userName']);
    const ur0_avatar = cleanText(r['shops/userReviews/0/userAvatarUrl']);
    const ur0_rating = toFloat(r['shops/userReviews/0/rating']);
    const ur0_comment = cleanText(r['shops/userReviews/0/comment']);
    const ur1_name = cleanText(r['shops/userReviews/1/userName']);
    const ur1_avatar = cleanText(r['shops/userReviews/1/userAvatarUrl']);
    const ur1_rating = toFloat(r['shops/userReviews/1/rating']);
    const ur1_comment = cleanText(r['shops/userReviews/1/comment']);

    if (!id || !name) continue;

    stmt.run(
      id, name, address, latitude, longitude, rating, ratingCount, imageUrl,
      gallery0, gallery1,
      owner_id, owner_name, owner_email, owner_phoneNumber, owner_profileImageUrl,
      m0, m1, m2, m3, m4, m5, m6,
      description,
      ur0_name, ur0_avatar, ur0_rating, ur0_comment,
      ur1_name, ur1_avatar, ur1_rating, ur1_comment
    );
    inserted++;
  }
  stmt.finalize();
  console.log(`Inserted Shops: ${inserted}`);
}

function main() {
  if (!fs.existsSync(DB_PATH)) {
    console.error(`DB not found at ${DB_PATH}`);
    process.exit(1);
  }
  const db = new sqlite3.Database(DB_PATH);
  db.serialize(() => {
    importMotorbikes(db);
    importShops(db);
    db.get('SELECT COUNT(*) as c FROM Motorbikes', (err, row) => {
      if (!err) console.log(`Motorbikes count: ${row.c}`);
    });
    db.get('SELECT COUNT(*) as c FROM Shops', (err, row) => {
      if (!err) console.log(`Shops count: ${row.c}`);
    });
  });
  db.close((err) => {
    if (err) console.error('Error closing DB:', err.message);
    else console.log('✅ Import done.');
  });
}

main();
