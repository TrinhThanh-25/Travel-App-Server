import db from "../db/connect.js";
import crypto from "crypto";

// Helper: parse criteria JSON safely
function parseCriteria(str) {
  if (!str) return {};
  try { return JSON.parse(str); } catch { return {}; }
}

// Compute progress for a user on a challenge based on challenge_type + criteria.
function computeProgress(challenge, userId, cb) {
  const type = challenge.challenge_type || '';
  const criteria = parseCriteria(challenge.criteria);
  // default progress = 0
  if (type === 'checkin') {
    // Count user_location checkins. If specific location_ids listed in criteria, only count those.
    let sql = `SELECT COUNT(*) as cnt FROM user_location WHERE user_id = ?`;
    const params = [userId];
    if (Array.isArray(criteria.location_ids) && criteria.location_ids.length) {
      const placeholders = criteria.location_ids.map(() => '?').join(',');
      sql += ` AND location_id IN (${placeholders})`;
      params.push(...criteria.location_ids);
    }
    db.get(sql, params, (err, row) => {
      if (err) return cb(err);
      cb(null, row ? row.cnt : 0);
    });
  } else if (type === 'collection') {
    // Collection of distinct categories or locations; rely on criteria.target === 'distinct_locations' or 'distinct_categories'
    if (criteria.target === 'distinct_locations') {
      db.get(`SELECT COUNT(DISTINCT location_id) as cnt FROM user_location WHERE user_id = ?`, [userId], (err, row) => {
        if (err) return cb(err);
        cb(null, row ? row.cnt : 0);
      });
    } else if (criteria.target === 'distinct_categories') {
      db.get(`SELECT COUNT(DISTINCT l.category) as cnt FROM user_location ul INNER JOIN locations l ON ul.location_id = l.id WHERE ul.user_id = ?`, [userId], (err, row) => {
        if (err) return cb(err);
        cb(null, row ? row.cnt : 0);
      });
    } else {
      cb(null, 0);
    }
  } else if (type === 'content') {
    // Example: number of reviews written at specified locations
    if (criteria.target === 'location_reviews') {
      let sql = `SELECT COUNT(*) as cnt FROM location_reviews WHERE user_id = ?`;
      const params = [userId];
      if (Array.isArray(criteria.location_ids) && criteria.location_ids.length) {
        const placeholders = criteria.location_ids.map(() => '?').join(',');
        sql += ` AND location_id IN (${placeholders})`;
        params.push(...criteria.location_ids);
      }
      db.get(sql, params, (err, row) => {
        if (err) return cb(err);
        cb(null, row ? row.cnt : 0);
      });
    } else {
      cb(null, 0);
    }
  } else if (type === 'streak') {
    // Simplified streak: count distinct days with at least one checkin
    const daysNeeded = criteria.count || 0;
    db.get(`SELECT COUNT(DISTINCT date(checked_in_at)) as cnt FROM user_location WHERE user_id = ?`, [userId], (err, row) => {
      if (err) return cb(err);
      cb(null, row ? Math.min(row.cnt, daysNeeded) : 0);
    });
  } else if (type === 'level') {
    // Level could be based on total_point
    db.get(`SELECT total_point FROM users WHERE id = ?`, [userId], (err, row) => {
      if (err) return cb(err);
      const needed = criteria.points || 0;
      cb(null, row ? Math.min(row.total_point, needed) : 0);
    });
  } else if (type === 'quiz') {
    // Placeholder: quiz progress tracked externally; use stored progress from user_challenge table
    db.get(`SELECT progress FROM user_challenge WHERE user_id = ? AND challenge_id = ?`, [userId, challenge.id], (err, row) => {
      if (err) return cb(err);
      cb(null, row ? row.progress : 0);
    });
  } else if (type === 'action') {
    // Example: walking distance, currently unsupported; returns stored progress
    db.get(`SELECT progress FROM user_challenge WHERE user_id = ? AND challenge_id = ?`, [userId, challenge.id], (err, row) => {
      if (err) return cb(err);
      cb(null, row ? row.progress : 0);
    });
  } else if (type === 'social') {
    // Example: invites count; rely on stored progress
    db.get(`SELECT progress FROM user_challenge WHERE user_id = ? AND challenge_id = ?`, [userId, challenge.id], (err, row) => {
      if (err) return cb(err);
      cb(null, row ? row.progress : 0);
    });
  } else {
    cb(null, 0);
  }
}

// Extended progress calculation for new targets using user_activity table:
// Supports: photo_upload, read_tip, watch_video, reviews_written, distance_meters (sum), collect_item, quiz_correct,
// invites_completed, shares, streak_days (already), level_points (already)
export function computeExtendedProgress(challenge, userId, cb) {
  const criteria = parseCriteria(challenge.criteria);
  const target = criteria.target;
  if (!target) return computeProgress(challenge, userId, cb);

  if (target === 'photo_upload') {
    db.get(`SELECT COUNT(*) as cnt FROM user_activity WHERE user_id = ? AND type = 'photo_upload'`, [userId], (e,r)=> cb(e, r? r.cnt:0));
  } else if (target === 'read_tip') {
    db.get(`SELECT COUNT(*) as cnt FROM user_activity WHERE user_id = ? AND type = 'read_tip'`, [userId], (e,r)=> cb(e, r? r.cnt:0));
  } else if (target === 'watch_video') {
    db.get(`SELECT COUNT(*) as cnt FROM user_activity WHERE user_id = ? AND type = 'watch_video'`, [userId], (e,r)=> cb(e, r? r.cnt:0));
  } else if (target === 'reviews_written') {
    db.get(`SELECT COUNT(*) as cnt FROM location_reviews WHERE user_id = ?`, [userId], (e,r)=> cb(e, r? r.cnt:0));
  } else if (target === 'location_info_reads') {
    // Count number of distinct location info reads (user_activity type 'location_info_read')
    db.get(`SELECT COUNT(*) as cnt FROM user_activity WHERE user_id = ? AND type = 'location_info_read'`, [userId], (e,r)=> cb(e, r? r.cnt:0));
  } else if (target === 'distance_meters') {
    // Sum meters from distance_session meta
    db.get(`SELECT COALESCE(SUM(CAST(json_extract(meta_json,'$.meters') AS INTEGER)),0) as meters FROM user_activity WHERE user_id = ? AND type = 'distance_session'`,[userId],(e,r)=> cb(e, r? r.meters:0));
  } else if (target === 'collect_item') {
    const prefix = criteria.item_prefix || '';
    db.get(`SELECT COUNT(DISTINCT json_extract(meta_json,'$.item_key')) as cnt FROM user_activity WHERE user_id = ? AND type = 'collect_item' AND json_extract(meta_json,'$.item_key') LIKE ?`, [userId, `${prefix}%`], (e,r)=> cb(e, r? r.cnt:0));
  } else if (target === 'quiz_correct') {
    db.get(`SELECT COUNT(*) as cnt FROM user_activity WHERE user_id = ? AND type = 'quiz_correct'`, [userId], (e,r)=> cb(e, r? r.cnt:0));
  } else if (target === 'reward_redemptions') {
    // Prefer user_activity records type 'reward_redeemed'; fallback to user_reward rows with status 'redeemed'
    db.get(`SELECT COUNT(*) as cnt FROM user_activity WHERE user_id = ? AND type = 'reward_redeemed'`, [userId], (e,r)=> {
      if (e) return cb(e);
      if (r && r.cnt > 0) return cb(null, r.cnt);
      db.get(`SELECT COUNT(*) as cnt FROM user_reward WHERE user_id = ? AND status = 'redeemed'`, [userId], (e2,r2)=> cb(e2, r2? r2.cnt:0));
    });
  } else if (target === 'invites_completed') {
    db.get(`SELECT COUNT(*) as cnt FROM user_activity WHERE user_id = ? AND type = 'invite_completed'`, [userId], (e,r)=> cb(e, r? r.cnt:0));
  } else if (target === 'shares') {
    db.get(`SELECT COUNT(*) as cnt FROM user_activity WHERE user_id = ? AND type = 'share'`, [userId], (e,r)=> cb(e, r? r.cnt:0));
  } else if (target === 'streak_days' || target === 'level_points' || target === 'distinct_locations' || target === 'distinct_categories' || target === 'location_reviews') {
    // delegate to original logic
    computeProgress(challenge, userId, cb);
  } else if (target === 'checkins') {
    db.get(`SELECT COUNT(*) as cnt FROM user_location WHERE user_id = ?`, [userId], (e,r)=> cb(e, r? r.cnt:0));
  } else {
    computeProgress(challenge, userId, cb);
  }
}

export const getAllChallenges = (req, res) => {
  const sql = `
    SELECT * FROM challenges
  `;
  db.all(sql, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows.map(r => ({ ...r, criteria: parseCriteria(r.criteria) })));
  });
};

export const addChallenge = (req, res) => {
  const { name, description, start_date, end_date, reward_point, location_ids, challenge_type, criteria, required_checkins } = req.body;
  const criteriaStr = criteria ? JSON.stringify(criteria) : null;
  db.run(
    "INSERT INTO challenges (name, description, start_date, end_date, reward_point, challenge_type, criteria, required_checkins) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    [name, description, start_date, end_date, reward_point, challenge_type, criteriaStr, required_checkins || 0],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      const challengeId = this.lastID;
      // derive location links from either explicit location_ids or criteria.location_ids
      const crit = parseCriteria(criteriaStr);
      const critLocs = Array.isArray(crit.location_ids) ? crit.location_ids : [];
      const locUnion = [
        ...(Array.isArray(location_ids) ? location_ids : []),
        ...critLocs
      ].filter((v, i, a) => a.indexOf(v) === i);

      if (locUnion.length) {
        const stmt = db.prepare("INSERT OR IGNORE INTO challenge_location (challenge_id, location_id) VALUES (?, ?)");
        locUnion.forEach((locId) => stmt.run(challengeId, locId));
        stmt.finalize();
      }
      res.json({ id: challengeId, message: "🎯 Challenge created!" });
    }
  );
};

export const joinChallenge = (req, res) => {
  const challengeId = req.params.id;
  const { user_id } = req.body;

  if (!user_id) return res.status(400).json({ error: 'user_id is required' });

  db.run(
    "INSERT OR IGNORE INTO user_challenge (user_id, challenge_id, status) VALUES (?, ?, 'in_progress')",
    [user_id, challengeId],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) {
        return res.status(400).json({ message: "❌ User already joined this challenge" });
      }
      res.json({ message: "✅ Challenge joined!" });
    }
  );
};

export const completeChallenge = (req, res) => {
  const challengeId = req.params.id;
  const { user_id } = req.body;

  if (!user_id) return res.status(400).json({ error: 'user_id is required' });
  getChallengeByIdRaw(challengeId, (err, challenge) => {
    if (err || !challenge) return res.status(400).json({ error: "Challenge not found" });
    computeExtendedProgress(challenge, user_id, (pErr, progress) => {
      if (pErr) return res.status(500).json({ error: pErr.message });
      const criteria = parseCriteria(challenge.criteria);
      const target = (criteria.count) || (criteria.points) || (criteria.meters) || (challenge.required_checkins || 0);
      const percent = target > 0 ? Math.min(100, Math.floor((progress / target) * 100)) : 0;
      if (!target || progress < target) {
        return res.status(400).json({ message: '❌ Not enough progress to complete', progress, target, percent });
      }

      const points = challenge.reward_point || 0;
      db.run("UPDATE users SET total_point = total_point + ? WHERE id = ?", [points, user_id], function (err2) {
        if (err2) return res.status(500).json({ error: err2.message });
        // mark user_challenge as completed with timestamp
        db.run("UPDATE user_challenge SET status = 'completed', completed_at = datetime('now') WHERE user_id = ? AND challenge_id = ?", [user_id, challengeId]);

        // record points credit transaction
        const desc = `Challenge #${challengeId} - ${challenge.name}: +${points} points`;
        db.run(`INSERT INTO points_transactions (user_id, reward_id, points, type, description) VALUES (?,?,?,?,?)`, [user_id, null, points, 'credit', desc]);

        // Award mapped rewards from challenge_reward
        db.all(`SELECT r.* FROM rewards r INNER JOIN challenge_reward cr ON r.id = cr.reward_id WHERE cr.challenge_id = ?`, [challengeId], (rErr, rewards) => {
          if (rErr) return res.status(500).json({ error: rErr.message });
          if (!rewards || !rewards.length) {
            return res.json({ message: `✅ Challenge completed! +${points} points`, progress, target, percent, rewards_issued: [] });
          }
          const issued = [];
          const issueNext = (idx) => {
            if (idx >= rewards.length) return res.json({ message: `✅ Challenge completed! +${points} points`, progress, target, percent, rewards_issued: issued });
            const rw = rewards[idx];
            db.get(`SELECT id FROM user_reward WHERE user_id = ? AND reward_id = ?`, [user_id, rw.id], (chkErr, existsRow) => {
              if (chkErr) return res.status(500).json({ error: chkErr.message });
              if (existsRow) { issued.push({ reward_id: rw.id, code: null, status: 'already_has' }); return issueNext(idx+1); }
              // Always generate a fresh per-user code; reward base code is ignored.
              const code = crypto.randomBytes(6).toString('hex').toUpperCase();
              db.run(`INSERT INTO user_reward (user_id, reward_id, code, status, expires_at) VALUES (?,?,?,?,?)`, [user_id, rw.id, code, 'active', rw.expires_at || null], function (insErr) {
                if (insErr) return res.status(500).json({ error: insErr.message });
                issued.push({ reward_id: rw.id, code, status: 'issued' });
                issueNext(idx+1);
              });
            });
          };
          issueNext(0);
        });
      });
    });
  });
};

export const getChallengeLocations = (req, res) => {
  const challengeId = req.params.id;
  const sql = `
    SELECT l.*
    FROM locations l
    INNER JOIN challenge_location cl ON l.id = cl.location_id
    WHERE cl.challenge_id = ?
  `;
  db.all(sql, [challengeId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
};

export const getChallengeRewards = (req, res) => {
  const challengeId = req.params.id;
  const sql = `
    SELECT r.*
    FROM rewards r
    INNER JOIN challenge_reward cr ON r.id = cr.reward_id
    WHERE cr.challenge_id = ?
  `;
  db.all(sql, [challengeId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
};

export const getChallengeByIdRaw = (challengeId, callback) => {
  const sql = `
    SELECT 
      c.*,
      l.id AS location_id,
      l.name AS location_name
    FROM challenges c
    LEFT JOIN challenge_location cl ON c.id = cl.challenge_id
    LEFT JOIN locations l ON cl.location_id = l.id
    WHERE c.id = ?
  `;

  db.all(sql, [challengeId], (err, rows) => {
    if (err) return callback(err);
    if (!rows || rows.length === 0) return callback(null, null);

    const challenge = {
      ...rows[0],
      locations: rows
        .filter(r => r.location_id !== null)
        .map(r => ({
          id: r.location_id,
          name: r.location_name
        }))
    };

    callback(null, challenge);
  });
};


export const getChallengeById = (req, res) => {
  const id = req.params.id;
  getChallengeByIdRaw(id, (err, row) => {
    if (err || !row) return res.status(404).json({ error: 'Challenge not found' });
    res.json({ ...row, criteria: parseCriteria(row.criteria) });
  });
};

export const updateChallengeProgress = (req, res) => {
  const challengeId = req.params.id;
  const { user_id } = req.body;
  if (!user_id) return res.status(400).json({ error: 'user_id required' });
  getChallengeByIdRaw(challengeId, (err, challenge) => {
    if (err || !challenge) return res.status(404).json({ error: 'Challenge not found' });
  computeExtendedProgress(challenge, user_id, (cErr, progress) => {
      if (cErr) return res.status(500).json({ error: cErr.message });
      const target = challenge.required_checkins || 0;
      const completed = target > 0 && progress >= target;
      const status = completed ? 'completed' : 'in_progress';
      db.run(`UPDATE user_challenge SET progress = ?, status = ?, completed_at = CASE WHEN ? THEN datetime('now') ELSE completed_at END WHERE user_id = ? AND challenge_id = ?`,
        [progress, status, completed, user_id, challengeId],
        function (uErr) {
          if (uErr) return res.status(500).json({ error: uErr.message });
          res.json({ challenge_id: challengeId, user_id, progress, target, status, completed });
        }
      );
    });
  });
};

export const setManualProgress = (req, res) => {
  const challengeId = req.params.id;
  const { user_id, progress } = req.body;
  if (!user_id || typeof progress !== 'number') return res.status(400).json({ error: 'user_id and numeric progress required' });
  db.run(`UPDATE user_challenge SET progress = ?, status = CASE WHEN progress >= required_checkins THEN 'completed' ELSE status END WHERE user_id = ? AND challenge_id = ?`,
    [progress, user_id, challengeId],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: 'Progress updated', challenge_id: challengeId, user_id, progress });
    });
};

// Log an activity tied to a challenge and recompute progress automatically.
export const logChallengeActivity = (req, res) => {
  const challengeId = req.params.id;
  const { user_id, type, target_id, meta } = req.body;
  if (!user_id || !type) return res.status(400).json({ error: 'user_id and type required' });
  const metaJson = meta ? JSON.stringify(meta) : null;
  db.run(`INSERT INTO user_activity (user_id, challenge_id, type, target_id, meta_json) VALUES (?,?,?,?,?)`,
    [user_id, challengeId, type, target_id || null, metaJson], (err) => {
      if (err) return res.status(500).json({ error: err.message });
      getChallengeByIdRaw(challengeId, (cErr, challenge) => {
        if (cErr || !challenge) return res.status(404).json({ error: 'Challenge not found after logging activity' });
        computeExtendedProgress(challenge, user_id, (pErr, progress) => {
          if (pErr) return res.status(500).json({ error: pErr.message });
          const target = (parseCriteria(challenge.criteria).count) || (challenge.required_checkins || 0);
          const completed = target > 0 && progress >= target;
          db.run(`UPDATE user_challenge SET progress = ?, status = ?, completed_at = CASE WHEN ? THEN datetime('now') ELSE completed_at END WHERE user_id = ? AND challenge_id = ?`,
            [progress, completed ? 'completed' : 'in_progress', completed, user_id, challengeId], (uErr) => {
              if (uErr) return res.status(500).json({ error: uErr.message });
              res.json({ message: 'Activity logged', challenge_id: challengeId, user_id, progress, target, completed });
            });
        });
      });
    });
};

// List user challenges with progress
export const listUserChallenges = (req, res) => {
  const userId = req.params.userId;
  db.all(`SELECT uc.*, c.*, c.id as challenge_id FROM user_challenge uc INNER JOIN challenges c ON uc.challenge_id = c.id WHERE uc.user_id = ?`, [userId], async (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    const promises = rows.map(r => new Promise((resolve) => {
      const crit = parseCriteria(r.criteria);
      const target = crit.count || crit.points || crit.meters || r.required_checkins || 0;
      const base = {
        challenge_id: r.challenge_id,
        name: r.name,
        type: r.challenge_type,
        criteria: crit,
        status: r.status,
        completed_at: r.completed_at
      };
      computeExtendedProgress(r, userId, (pErr, prog) => {
        const progress = pErr ? (r.progress || 0) : prog;
        const percent = target > 0 ? Math.min(100, Math.floor((progress / target) * 100)) : 0;
        resolve({ ...base, progress, target, percent });
      });
    }));
    const result = await Promise.all(promises);
    res.json(result);
  });
};

export const getChallengeProgress = (req, res) => {
  const challengeId = req.params.id;
  const user_id = req.query.user_id || req.body.user_id;
  if (!user_id) return res.status(400).json({ error: 'user_id required' });
  getChallengeByIdRaw(challengeId, (err, challenge) => {
    if (err || !challenge) return res.status(404).json({ error: 'Challenge not found' });
    const crit = parseCriteria(challenge.criteria);
    const target = crit.count || crit.points || crit.meters || challenge.required_checkins || 0;
    computeExtendedProgress(challenge, user_id, (pErr, progress) => {
      if (pErr) return res.status(500).json({ error: pErr.message });
      const percent = target > 0 ? Math.min(100, Math.floor((progress / target) * 100)) : 0;
      res.json({ challenge_id: challengeId, user_id, progress, target, percent });
    });
  });
};
