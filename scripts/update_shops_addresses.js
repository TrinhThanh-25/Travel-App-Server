// Strip trailing ', Vietnam' from Shops.address in template DB
import db, { ready } from '../db/connect.js';

async function run() {
  await ready;
  console.log('🔧 Updating Shops.address to remove ", Vietnam" suffix...');
  db.run(`UPDATE Shops SET address = REPLACE(address, ', Vietnam', '') WHERE address LIKE '%, Vietnam'`, (err) => {
    if (err) console.error('❌ Update failed:', err.message); else console.log('✅ Address suffix removed');
    db.close();
  });
}

run().catch(e => { console.error('Fatal:', e); db.close(); });