// Generate and insert trip reviews into travel_app.template.db based on trips.csv and users.csv
import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse';
import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const tripsCsv = path.join(__dirname, 'db_exports', 'archive', 'trips.csv');
const usersCsv = path.join(__dirname, 'db_exports', 'archive', 'users.csv');
const dbPath = fileURLToPath(new URL('../travel_app.template.db', import.meta.url));

function readCsv(filePath) {
  return new Promise((resolve, reject) => {
    const rows = [];
    fs.createReadStream(filePath)
      .pipe(parse({ columns: true, skip_empty_lines: true }))
      .on('data', (row) => rows.push(row))
      .on('end', () => resolve(rows))
      .on('error', (err) => reject(err));
  });
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickRandom(arr, count) {
  const copy = [...arr];
  const picked = [];
  for (let i = 0; i < count && copy.length; i++) {
    const idx = randomInt(0, copy.length - 1);
    picked.push(copy[idx]);
    copy.splice(idx, 1);
  }
  return picked;
}

async function main() {
  console.log('Loading CSVs...');
  const trips = await readCsv(tripsCsv);
  const users = await readCsv(usersCsv);
  console.log(`Trips: ${trips.length}, Users: ${users.length}`);

  const db = new sqlite3.Database(dbPath);
  await new Promise((r) => db.serialize(r));

  db.serialize(() => {
    db.run('PRAGMA foreign_keys = ON;');
    const insertStmt = db.prepare('INSERT INTO trip_reviews (user_id, trip_id, rating, comment) VALUES (?, ?, ?, ?)');

    let totalInserted = 0;
    for (const trip of trips) {
      const tripId = Number(trip.id);
      // For each trip, create between 3 and 8 reviews from random unique users
      const reviewCount = randomInt(3, 8);
      const selectedUsers = pickRandom(users, reviewCount);
      for (const u of selectedUsers) {
        const userId = Number(u.id);
        const rating = randomInt(3, 5); // 3-5 stars
        const commentPool = [
          'Hành trình rất thú vị!',
          'Địa điểm đẹp và đồ ăn ngon.',
          'Sẽ quay lại lần nữa.',
          'Lịch trình hợp lý, giá ổn.',
          'Khá đông vào cuối tuần.',
          'Trải nghiệm tuyệt vời cùng bạn bè.',
        ];
        const comment = commentPool[randomInt(0, commentPool.length - 1)];
        insertStmt.run([userId, tripId, rating, comment]);
        totalInserted++;
      }

      // Recompute aggregates for the trip
      db.get('SELECT AVG(rating) as avg_rating, COUNT(*) as cnt FROM trip_reviews WHERE trip_id = ?', [tripId], (e, row) => {
        if (!e && row) {
          db.run('UPDATE trips SET rating = ?, review_count = ? WHERE id = ?', [row.avg_rating || 0, row.cnt || 0, tripId]);
        }
      });
    }

    insertStmt.finalize((err) => {
      if (err) console.error('Finalize error:', err.message);
      console.log(`Inserted ${totalInserted} trip reviews.`);
      db.close();
    });
  });
}

main().catch((e) => {
  console.error('Failed to import trip reviews:', e);
  process.exit(1);
});
