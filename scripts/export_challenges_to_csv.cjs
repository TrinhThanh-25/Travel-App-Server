const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3');
const dbPath = path.join(__dirname, '..', 'travel_app.template.db');
const outDir = path.join(__dirname, 'db_exports', 'archive');
const outFile = path.join(outDir, 'challenges.csv');

if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('DB open error', err.message);
    process.exit(1);
  }
});

// Duration column not present in current schema; omit if missing.
const header = ['id','name','description','start_date','end_date','reward_point','reward_type','challenge_type','required_checkins','criteria'];

db.all(`SELECT id,name,description,start_date,end_date,reward_point,reward_type,challenge_type,required_checkins,criteria FROM challenges ORDER BY id`, [], (err, rows) => {
  if (err) {
    console.error('Query error', err.message);
    process.exit(1);
  }
  const lines = [header.join(',')];
  for (const r of rows) {
    const criteria = r.criteria ? r.criteria.replace(/"/g,'""') : '';
    const desc = (r.description||'').replace(/"/g,'""');
    const name = (r.name||'').replace(/"/g,'""');
  lines.push([r.id,`"${name}"`,`"${desc}"`,r.start_date,r.end_date,r.reward_point||0,r.reward_type||'',r.challenge_type||'',r.required_checkins||0,`"${criteria}"`].join(','));
  }
  fs.writeFileSync(outFile, lines.join('\n'), 'utf8');
  console.log('Exported', rows.length, 'challenges to', outFile);
  db.close();
});
