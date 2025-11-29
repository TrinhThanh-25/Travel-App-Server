const path = require('path');
const sqlite3 = require('sqlite3');
const dbPath = path.join(__dirname, '..', 'travel_app.template.db');
const db = new sqlite3.Database(dbPath);

function addReward({name, description, cost=0, percent=0, code=null, start_date=null, end_date=null, expires_at=null, point_reward=0, max_uses=null, per_user_limit=1, metadata=null}){
  return new Promise((resolve, reject) => {
    db.run(`INSERT INTO rewards (name, description, cost, percent, code, start_date, end_date, expires_at, point_reward, max_uses, per_user_limit, metadata) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [name, description, cost, percent, code, start_date, end_date, expires_at, point_reward, max_uses, per_user_limit, metadata],
      function(err){ if(err) return reject(err); resolve(this.lastID); }
    );
  });
}

function linkRewardLocations(rewardId, locIds){
  return new Promise((resolve,reject)=>{
    if(!Array.isArray(locIds) || !locIds.length) return resolve();
    const stmt = db.prepare(`INSERT OR IGNORE INTO location_reward (location_id, reward_id) VALUES (?,?)`);
    locIds.forEach(id=> stmt.run(id, rewardId));
    stmt.finalize(err=> err? reject(err): resolve());
  });
}

(async ()=>{
  try{
    const defs=[
      {name:'Free Coffee @Entertainment', description:'Một ly cà phê miễn phí', cost:0, percent:100, code:'FREECOFFEE', locs:[1,2,3]},
      {name:'10% Off Billiards', description:'Giảm 10% phí billiards', cost:0, percent:10, code:'BIL10', locs:[9,10,11]},
      {name:'20% Archery Discount', description:'Giảm 20% CLB bắn cung', cost:0, percent:20, code:'ARCH20', locs:[6,7,8]},
      {name:'Zoo Ticket - 15% Off', description:'Giảm 15% vé Thảo Cầm Viên', cost:0, percent:15, code:'ZOO15', locs:[12]},
      {name:'Bowling Coupon', description:'Phiếu giảm Bowling 25%', cost:0, percent:25, code:'BOWL25', locs:[20,21,22]},
      {name:'VR Arcade 5%', description:'Giảm 5% khu Arcade & VR', cost:0, percent:5, code:'VR05', locs:[13,14]},
    ];

    for(const d of defs){
      const rid = await addReward(d);
      await linkRewardLocations(rid, d.locs);
      console.log('Inserted reward', rid, d.name, '-> locations', d.locs.join(','));
    }
    console.log('Rewards seeding complete');
    db.close();
  }catch(e){
    console.error('Seed error', e.message);
    db.close();
    process.exit(1);
  }
})();
