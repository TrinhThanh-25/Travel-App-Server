const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3');
const dbPath = path.join(__dirname, '..', 'travel_app.template.db');
const outDir = path.join(__dirname, 'db_exports', 'archive');
const outCL = path.join(outDir, 'challenge_location.csv');
const outCR = path.join(outDir, 'challenge_reward.csv');

if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) { console.error('DB open error', err.message); process.exit(1); }
});

function exportTable(sql, header, outfile) {
  return new Promise((resolve, reject) => {
    db.all(sql, [], (err, rows) => {
      if (err) return reject(err);
      const lines = [header.join(',')];
      for (const r of rows) {
        lines.push(header.map(h => r[h]).map(v => {
          if (v == null) return '""';
          const s = String(v).replace(/"/g,'""');
          return `"${s}"`;
        }).join(','));
      }
      fs.writeFileSync(outfile, lines.join('\n'), 'utf8');
      console.log('Exported', rows.length, 'rows to', outfile);
      resolve();
    });
  });
}

(async () => {
  try {
    await exportTable(`SELECT challenge_id, location_id FROM challenge_location ORDER BY challenge_id, location_id`, ['challenge_id','location_id'], outCL);
    await exportTable(`SELECT challenge_id, reward_id FROM challenge_reward ORDER BY challenge_id, reward_id`, ['challenge_id','reward_id'], outCR);
    db.close();
  } catch (e) {
    console.error('Export error', e.message);
    db.close();
    process.exit(1);
  }
})();
