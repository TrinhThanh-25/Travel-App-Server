const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3');
const dbPath = path.join(__dirname, '..', 'travel_app.template.db');
const outDir = path.join(__dirname, 'db_exports', 'archive');
const outFile = path.join(outDir, 'rewards.csv');

if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) { console.error('DB open error', err.message); process.exit(1); }
});

const header = ['id','name','description','cost','percent','code','start_date','end_date','expires_at','point_reward','max_uses','per_user_limit'];

db.all(`SELECT id,name,description,cost,percent,code,start_date,end_date,expires_at,point_reward,max_uses,per_user_limit FROM rewards ORDER BY id`, [], (err, rows) => {
  if (err) { console.error('Query error', err.message); process.exit(1); }
  const lines = [header.join(',')];
  for (const r of rows) {
    function q(s){ if(s==null) return '""'; return `"${String(s).replace(/"/g,'""')}"`; }
    lines.push([
      r.id,
      q(r.name),
      q(r.description),
      r.cost||0,
      r.percent||0,
      q(r.code||''),
      r.start_date||'',
      r.end_date||'',
      r.expires_at||'',
      r.point_reward||0,
      r.max_uses==null? '': r.max_uses,
      r.per_user_limit==null? '': r.per_user_limit
    ].join(','));
  }
  fs.writeFileSync(outFile, lines.join('\n'), 'utf8');
  console.log('Exported', rows.length, 'rewards to', outFile);
  db.close();
});
