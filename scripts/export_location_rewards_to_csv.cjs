const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3');
const dbPath = path.join(__dirname, '..', 'travel_app.template.db');
const outDir = path.join(__dirname, 'db_exports', 'archive');
const outFile = path.join(outDir, 'location_reward.csv');

if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) { console.error('DB open error', err.message); process.exit(1); }
});

const header = ['location_id','reward_id'];

db.all(`SELECT location_id, reward_id FROM location_reward ORDER BY location_id, reward_id`, [], (err, rows) => {
  if (err) { console.error('Query error', err.message); process.exit(1); }
  const lines = [header.join(',')];
  for (const r of rows) {
    lines.push([`"${r.location_id}"`,`"${r.reward_id}"`].join(','));
  }
  fs.writeFileSync(outFile, lines.join('\n'), 'utf8');
  console.log('Exported', rows.length, 'location-reward links to', outFile);
  db.close();
});
