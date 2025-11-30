import fs from 'fs';
import path from 'path';
import sqlite3 from 'sqlite3';
import { parse } from 'csv-parse';

function readCsv(filePath) {
  return new Promise((resolve, reject) => {
    const rows = [];
    if (!fs.existsSync(filePath)) return resolve([]);
    fs.createReadStream(filePath)
      .pipe(parse({ columns: true, skip_empty_lines: true, trim: true }))
      .on('data', (row) => rows.push(row))
      .on('error', reject)
      .on('end', () => resolve(rows));
  });
}

function toInt(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = parseInt(String(v).replace(/[^0-9-]/g,''), 10);
  return Number.isNaN(n) ? null : n;
}
function toFloat(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = parseFloat(String(v).replace(/[^0-9+\-.]/g,''));
  return Number.isNaN(n) ? null : n;
}

async function main() {
  const dbPath = path.resolve('travel_app.template.db');
  const db = new sqlite3.Database(dbPath);
  const run = (sql, params=[]) => new Promise((res, rej) => db.run(sql, params, function(err){ err?rej(err):res(this); }));
  const prepareInsert = (sql) => new Promise((res, rej) => {
    const stmt = db.prepare(sql, (err) => err?rej(err):res(stmt));
  });

  console.log('🔄 Starting import into', dbPath);

  const baseDir = path.resolve('scripts/db_exports/archive');
  const challengesCsv = path.join(baseDir, 'challenges.csv');
  const challengeLocCsv = path.join(baseDir, 'challenge_location.csv');
  const challengeRewardCsv = path.join(baseDir, 'challenge_reward.csv');
  const rewardsCsv = path.join(baseDir, 'rewards.csv');
  const shopsCsv = path.join(baseDir, 'Shops.csv');

  const [challengesRows, chLocRows, chRewardRows, rewardsRows, shopsRows] = await Promise.all([
    readCsv(challengesCsv),
    readCsv(challengeLocCsv),
    readCsv(challengeRewardCsv),
    readCsv(rewardsCsv),
    readCsv(shopsCsv)
  ]);

  await run('BEGIN TRANSACTION');
  try {
    // Purge tables
    await run('DELETE FROM challenge_location');
    await run('DELETE FROM challenge_reward');
    await run('DELETE FROM challenges');
    await run('DELETE FROM rewards');
    await run('DELETE FROM Shops');

    // Insert challenges
    if (challengesRows.length) {
      const chStmt = await prepareInsert('INSERT INTO challenges (id,name,description,start_date,end_date,reward_point,reward_type,challenge_type,required_checkins,criteria,rules,metadata) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)');
      for (const r of challengesRows) {
        chStmt.run([
          toInt(r.id),
          r.name || null,
          r.description || null,
          r.start_date || null,
          r.end_date || null,
          toInt(r.reward_point) || 0,
          r.reward_type || null,
          r.challenge_type || null,
          toInt(r.required_checkins) || 0,
          r.criteria || null,
          null,
          null
        ]);
      }
      chStmt.finalize();
    }

    // Insert rewards
    if (rewardsRows.length) {
      const rStmt = await prepareInsert('INSERT INTO rewards (id,name,start_date,end_date,description,cost,expires_at,point_reward,max_uses,per_user_limit,metadata,percent,code) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)');
      for (const r of rewardsRows) {
        rStmt.run([
          toInt(r.id),
          r.name || null,
          r.start_date || null,
          r.end_date || null,
            r.description || null,
          toInt(r.cost) || 0,
          r.expires_at || null,
          toInt(r.point_reward) || 0,
          toInt(r.max_uses) || null,
          toInt(r.per_user_limit) || 1,
          null,
          r.percent || null,
          r.code || null
        ]);
      }
      rStmt.finalize();
    }

    // Insert challenge_reward junction
    if (chRewardRows.length) {
      const crStmt = await prepareInsert('INSERT INTO challenge_reward (challenge_id,reward_id) VALUES (?,?)');
      for (const r of chRewardRows) {
        crStmt.run([toInt(r.challenge_id), toInt(r.reward_id)]);
      }
      crStmt.finalize();
    }

    // Insert challenge_location junction
    if (chLocRows.length) {
      const clStmt = await prepareInsert('INSERT INTO challenge_location (challenge_id,location_id) VALUES (?,?)');
      for (const r of chLocRows) {
        clStmt.run([toInt(r.challenge_id), toInt(r.location_id)]);
      }
      clStmt.finalize();
    }

    // Insert shops
    if (shopsRows.length) {
      const sStmt = await prepareInsert(`INSERT INTO Shops (
        id,name,address,latitude,longitude,rating,ratingCount,imageUrl,galleryImages_0,galleryImages_1,
        owner_id,owner_name,owner_email,owner_phoneNumber,owner_profileImageUrl,
        motorbikes_0,motorbikes_1,motorbikes_2,motorbikes_3,motorbikes_4,motorbikes_5,motorbikes_6,
        description,userReviews_0_userName,userReviews_0_userAvatarUrl,userReviews_0_rating,userReviews_0_comment,
        userReviews_1_userName,userReviews_1_userAvatarUrl,userReviews_1_rating,userReviews_1_comment
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
      for (const r of shopsRows) {
        const val = (k) => r[k] || '';
        sStmt.run([
          val('shops/id'),
          val('shops/name'),
          val('shops/address'),
          toFloat(val('shops/latitude')),
          toFloat(val('shops/longitude')),
          toFloat(val('shops/rating')),
          toInt(val('shops/ratingCount')),
          val('shops/imageUrl'),
          val('shops/galleryImages/0'),
          val('shops/galleryImages/1'),
          val('shops/owner/id'),
          val('shops/owner/name'),
          val('shops/owner/email'),
          val('shops/owner/phoneNumber').replace(/"""?|"/g,'').trim(),
          val('shops/owner/profileImageUrl'),
          val('shops/motorbikes/0'),
          val('shops/motorbikes/1'),
          val('shops/motorbikes/2'),
          val('shops/motorbikes/3'),
          val('shops/motorbikes/4'),
          val('shops/motorbikes/5'),
          val('shops/motorbikes/6'),
          val('shops/description'),
          val('shops/userReviews/0/userName'),
          val('shops/userReviews/0/userAvatarUrl'),
          val('shops/userReviews/0/rating'),
          val('shops/userReviews/0/comment'),
          val('shops/userReviews/1/userName'),
          val('shops/userReviews/1/userAvatarUrl'),
          val('shops/userReviews/1/rating'),
          val('shops/userReviews/1/comment')
        ]);
      }
      sStmt.finalize();
    }

    await run('COMMIT');
    console.log('✅ Import completed successfully');
  } catch (e) {
    console.error('❌ Import failed, rolling back:', e.message);
    await run('ROLLBACK');
    process.exit(1);
  } finally {
    db.close();
  }
}

main().catch(e => { console.error(e); process.exit(1); });
