const path = require('path');
const sqlite3 = require('sqlite3');
const dbPath = path.join(__dirname, '..', 'travel_app.template.db');
const db = new sqlite3.Database(dbPath);

function insert(name, description, type, criteria, reward_point, required_checkins){
  return new Promise((resolve, reject) => {
    db.run(`INSERT INTO challenges (name, description, start_date, end_date, reward_point, challenge_type, criteria, required_checkins) VALUES (?,?,?,?,?,?,?,?)`,[
      name,
      description,
      '2025-11-28',
      '2026-06-30',
      reward_point,
      type,
      JSON.stringify(criteria || {}),
      required_checkins || (criteria && criteria.count) || 0
    ], function(err){
      if (err) return reject(err);
      resolve(this.lastID);
    });
  });
}

function linkLocations(challengeId, locationIds){
  return new Promise((resolve,reject)=>{
    if(!Array.isArray(locationIds) || !locationIds.length) return resolve();
    const stmt = db.prepare(`INSERT OR IGNORE INTO challenge_location (challenge_id, location_id) VALUES (?,?)`);
    locationIds.forEach(id=> stmt.run(challengeId,id));
    stmt.finalize(err=> err? reject(err): resolve());
  });
}

(async () => {
  try {
    const defs = [
      {
        name:'Check-in Suoi Tien', desc:'Check-in tại Suoi Tien Amusement Park', type:'checkin', criteria:{target:'checkins', count:1, location_ids:[1]}, reward:20, locations:[1]
      },
      {
        name:'3 Billiards Spots', desc:'Thăm 3 địa điểm billiards', type:'collection', criteria:{target:'distinct_locations', count:3, location_ids:[9,10,11]}, reward:60, locations:[9,10,11]
      },
      {
        name:'Chụp 2 ảnh khu giải trí', desc:'Chụp 2 ảnh tại các địa điểm giải trí', type:'content', criteria:{target:'photo_upload', count:2, category:'entertainment'}, reward:40, locations:[1,2,3]
      },
      {
        name:'Đọc 5 mẹo du lịch', desc:'Đọc 5 mẹo đi bộ phố cổ', type:'content', criteria:{target:'read_tip', count:5}, reward:30
      },
      {
        name:'Xem 3 video review', desc:'Xem 3 video review địa điểm', type:'content', criteria:{target:'watch_video', count:3}, reward:35
      },
      {
        name:'Viết 3 đánh giá', desc:'Viết 3 reviews địa điểm bất kỳ', type:'content', criteria:{target:'reviews_written', count:3}, reward:50
      },
      {
        name:'Đi bộ 2km', desc:'Đi bộ 2km quanh khu du lịch', type:'action', criteria:{target:'distance_meters', meters:2000}, reward:70
      },
      {
        name:'Thu thập 5 huy hiệu archery', desc:'Collect 5 archery badge items', type:'action', criteria:{target:'collect_item', count:5, item_prefix:'archery'}, reward:80, locations:[6,7,8]
      },
      {
        name:'Quiz lịch sử x3', desc:'Trả lời đúng 3 câu hỏi về lịch sử', type:'quiz', criteria:{target:'quiz_correct', count:3}, reward:90
      },
      {
        name:'Mời 2 bạn', desc:'Mời 2 bạn bè tham gia ứng dụng', type:'social', criteria:{target:'invites_completed', count:2}, reward:60
      },
      {
        name:'Chia sẻ 2 trải nghiệm', desc:'Chia sẻ 2 trải nghiệm lên mạng xã hội', type:'social', criteria:{target:'shares', count:2}, reward:40
      },
      {
        name:'Streak 3 ngày', desc:'Check-in liên tục 3 ngày', type:'streak', criteria:{target:'streak_days', count:3}, reward:100
      },
      {
        name:'Level 200 points', desc:'Đạt tổng cộng 200 điểm', type:'level', criteria:{target:'level_points', points:200}, reward:120
      }
    ];

    for (const d of defs) {
      const id = await insert(d.name, d.desc, d.type, d.criteria, d.reward, d.criteria.count || d.criteria.points || d.criteria.meters || 0);
      if (d.locations) await linkLocations(id, d.locations);
      console.log('Inserted challenge', id, d.name);
    }
    console.log('Seeding complete');
    db.close();
  } catch (e) {
    console.error('Seed error', e.message);
    db.close();
    process.exit(1);
  }
})();
