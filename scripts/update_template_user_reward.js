// Script to patch the template DB user_reward table: ensure columns exist and backfill
// codes/status/issued_at for rows missing them. Run with: node scripts/update_template_user_reward.js
import db, { ready } from '../db/connect.js';
import crypto from 'crypto';

async function ensureBackfill() {
  await ready; // run migrations first
  console.log('🔍 Checking user_reward rows for missing codes/status/issued_at...');
  db.serialize(() => {
    // Backfill code
    db.run(`UPDATE user_reward SET code = UPPER(substr(hex(randomblob(6)),1,12)) WHERE code IS NULL OR TRIM(code) = ''`, (e) => {
      if (e) console.warn('Backfill code error:', e.message); else console.log('✅ Codes backfilled');
    });
    // Backfill status
    db.run(`UPDATE user_reward SET status = 'active' WHERE status IS NULL OR status = ''`, (e) => {
      if (e) console.warn('Backfill status error:', e.message); else console.log('✅ Status backfilled');
    });
    // Backfill issued_at from obtained_at if missing
    db.run(`UPDATE user_reward SET issued_at = obtained_at WHERE (issued_at IS NULL OR issued_at = '') AND obtained_at IS NOT NULL`, (e) => {
      if (e) console.warn('Backfill issued_at error:', e.message); else console.log('✅ issued_at backfilled');
    });
    // Normalize used_at blanks to NULL (optional cleanup)
    db.run(`UPDATE user_reward SET used_at = NULL WHERE used_at = ''`, ()=>{});
  });
}

ensureBackfill().then(() => {
  console.log('🏁 Template DB user_reward patch complete.');
  db.close();
}).catch(err => {
  console.error('❌ Patch failed:', err && err.message);
  db.close();
});
