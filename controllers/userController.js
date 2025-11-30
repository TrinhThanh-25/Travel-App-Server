import db from "../db/connect.js";

export const getAllUsers = (req, res) => {
  db.all("SELECT id, username, email, total_point, avatar_url, dob, gender, phone FROM users", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
};

export const addUser = (req, res) => {
  const { username, email, password } = req.body;
  db.run("INSERT INTO users (username, email, password) VALUES (?, ?, ?)", [username, email, password], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: "🧍 New user created!", userId: this.lastID });
  });
};

export const completeChallenge = (req, res) => {
  const { user_id, challenge_id } = req.body;
  db.get("SELECT reward_point FROM challenges WHERE id = ?", [challenge_id], (err, row) => {
    if (err || !row) return res.status(400).json({ error: "Challenge not found" });

    const points = row.reward_point || 0;
    db.run("UPDATE users SET total_point = total_point + ? WHERE id = ?", [points, user_id], function (err2) {
      if (err2) return res.status(500).json({ error: err2.message });
      // mark user_challenge as completed
      db.run("INSERT OR REPLACE INTO user_challenge (user_id, challenge_id, status) VALUES (?, ?, 'completed')", [user_id, challenge_id]);
      res.json({ message: `✅ Challenge completed! +${points} points` });
    });
  });
};


export const getUserProfile = (req, res) => {
  // accept :id or ?id= or body.user_id
  const userId = req.params.id || req.query.id || (req.body && req.body.user_id);
  if (!userId) return res.status(400).json({ error: 'user id required' });
  db.get("SELECT id, username, email, total_point, avatar_url, dob, gender, phone FROM users WHERE id = ?", [userId], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: "User not found" });
    res.json(row);
  });
};

export const updateUserProfile = (req, res) => {
  // Support both legacy id-based calls and authenticated /me calls.
  const paramUserId = req.params.id;
  const authUserId = req.user && req.user.id;
  const userId = authUserId || paramUserId;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  // If authenticated, ensure they're updating their own profile only
  if (authUserId && paramUserId && String(authUserId) !== String(paramUserId)) {
    return res.status(403).json({ error: 'Cannot update another user' });
  }

  const { username, email, avatar_url, dob, gender, phone } = req.body;

  // Validate uniqueness for email and username if provided
  const checks = [];
  if (email) checks.push(new Promise((resolve, reject) => {
    db.get('SELECT id FROM users WHERE email = ? AND id != ?', [email, userId], (err, row) => {
      if (err) return reject(err);
      if (row) return resolve({ field: 'email', exists: true });
      resolve({ field: 'email', exists: false });
    });
  }));
  if (username) checks.push(new Promise((resolve, reject) => {
    db.get('SELECT id FROM users WHERE username = ? AND id != ?', [username, userId], (err, row) => {
      if (err) return reject(err);
      if (row) return resolve({ field: 'username', exists: true });
      resolve({ field: 'username', exists: false });
    });
  }));

  Promise.all(checks).then(results => {
    const conflict = results.find(r => r.exists);
    if (conflict) return res.status(400).json({ error: `${conflict.field} already in use` });

    // Build dynamic partial update
    const fields = [];
    const params = [];
    if (typeof username !== 'undefined') { fields.push('username = ?'); params.push(username); }
    if (typeof email !== 'undefined') { fields.push('email = ?'); params.push(email); }
    if (typeof avatar_url !== 'undefined') { fields.push('avatar_url = ?'); params.push(avatar_url); }
    if (typeof dob !== 'undefined') { fields.push('dob = ?'); params.push(dob); }
    if (typeof gender !== 'undefined') { fields.push('gender = ?'); params.push(gender); }
    if (typeof phone !== 'undefined') { fields.push('phone = ?'); params.push(phone); }

    if (fields.length === 0) return res.status(400).json({ error: 'No updatable fields provided' });

    const sql = `UPDATE users SET ${fields.join(', ')} WHERE id = ?`;
    params.push(userId);

    db.run(sql, params, function (err) {
      if (err) return res.status(500).json({ error: err.message });
      // Return the updated profile row
      db.get('SELECT id, username, email, total_point, avatar_url as avatar, dob, gender, phone FROM users WHERE id = ?', [userId], (e, row) => {
        if (e) return res.status(500).json({ error: e.message });
        res.json({ message: '📝 Profile updated!', user: row });
      });
    });

  }).catch(err => {
    console.error('Profile uniqueness check error', err);
    res.status(500).json({ error: 'Internal error' });
  });
};

export const updateUserAvatar = (req, res) => {
  const userId = req.params.id;
  const { avatar_url } = req.body;
  db.run(
    "UPDATE users SET avatar_url = ? WHERE id = ?",
    [avatar_url, userId],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: "🖼️ Avatar updated!" });
    }
  );
};

export const updateUserPassword = (req, res) => {
  const userId = req.params.id;
  const { old_password, new_password } = req.body;

  db.get("SELECT password FROM users WHERE id = ?", [userId], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: "User not found" });
    if (row.password !== old_password) return res.status(400).json({ error: "Old password is incorrect" });

    db.run(
      "UPDATE users SET password = ? WHERE id = ?",
      [new_password, userId],
      function (err2) {
        if (err2) return res.status(500).json({ error: err2.message });
        res.json({ message: "🔒 Password updated!" });
      }
    );
  });
};

export const getUserVouchers = (req, res) => {
  const userId = req.params.id;
  db.all(
    `SELECT ur.id, r.name, ur.code, ur.status, ur.expires_at
     FROM user_reward ur
     JOIN rewards r ON ur.reward_id = r.id
     WHERE ur.user_id = ?`,
    [userId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
};

// Redeem (use) a voucher code for the authenticated user

export const getUserAvatar = (req, res) => {
  const userId = req.params.id;
  db.get(
    `SELECT avatar_url
     FROM users
     WHERE id = ?`,
    [userId],
    (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(row);
    }
  );
};

export const getCheckedInLocation = (req, res) => {
  const userId = req.params.id;
  db.all(
    `SELECT l.id, l.name, l.image_url, l.description, l.address, l.city, l.opening_hours, l.closing_hours, l.rating, l.review_count, l.qr_code, ul.checked_in_at
     FROM user_location ul
     JOIN locations l ON ul.location_id = l.id
     WHERE ul.user_id = ?`,
    [userId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
};

export const checkInLocation = (req, res) => {
  const userId = req.params.id;
  const { location_id } = req.body;
  const checkedInAt = new Date().toISOString();

  db.run(
    `INSERT INTO user_location (user_id, location_id, checked_in_at)
     VALUES (?, ?, ?)`,
    [userId, location_id, checkedInAt],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: "📍 Location checked in!", checkInId: this.lastID });
    }
  );
};

export const getUserChallenges = (req, res) => {
  const userId = req.params.id;
  db.all(
    `SELECT c.id, c.name, c.description, c.reward_point,
            IFNULL(uc.status, 'not started') AS status
     FROM challenges c
     LEFT JOIN user_challenge uc ON c.id = uc.challenge_id AND uc.user_id = ?
     ORDER BY c.id ASC`,
    [userId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
};