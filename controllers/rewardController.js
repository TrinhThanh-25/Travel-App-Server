import db from "../db/connect.js";
import crypto from "crypto";

export const getAllRewards = (req, res) => {
  db.all("SELECT * FROM rewards", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
};

export const addReward = (req, res) => {
  const {
    name,
    start_date,
    end_date,
    description,
    cost,
    expires_at,
    point_reward,
    max_uses,
    per_user_limit,
    metadata,
    percent,
  } = req.body || {};

  db.run(
    `INSERT INTO rewards (name, start_date, end_date, description, cost, expires_at, point_reward, max_uses, per_user_limit, metadata, percent, code)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
    [
      name || null,
      start_date || null,
      end_date || null,
      description || null,
      cost || 0,
      expires_at || null,
      point_reward || 0,
      max_uses || null,
      per_user_limit || 1,
      metadata || null,
      percent || 0,
    ],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID, message: "🎁 New reward added!" });
    }
  );
};

export const redeemReward = (req, res) => {
  const { user_id, reward_id } = req.body || {};
  if (!user_id || !reward_id) return res.status(400).json({ error: "user_id and reward_id required" });

  db.serialize(() => {
    db.get(
      "SELECT id, name, cost, description, expires_at, per_user_limit, max_uses FROM rewards WHERE id = ?",
      [reward_id],
      (err, reward) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!reward) return res.status(400).json({ error: "Reward not found" });

        db.get("SELECT total_point FROM users WHERE id = ?", [user_id], (err2, user) => {
          if (err2) return res.status(500).json({ error: err2.message });
          if (!user) return res.status(400).json({ error: "User not found" });

          const cost = reward.cost || 0;
          const userPoints = user.total_point || 0;
          if (userPoints < cost) return res.status(400).json({ message: "❌ Not enough points" });

          const perUserLimit = reward.per_user_limit || 1;
          const maxUses = reward.max_uses || null;

          const enforceLimits = (next) => {
            db.get(
              `SELECT COUNT(*) as cnt FROM user_reward WHERE user_id = ? AND reward_id = ?`,
              [user_id, reward_id],
              (lErr, cntRow) => {
                if (lErr) return res.status(500).json({ error: lErr.message });
                const userCount = cntRow ? cntRow.cnt : 0;
                if (perUserLimit && userCount >= perUserLimit) {
                  return res.status(400).json({ message: "❌ Per-user limit reached for this reward" });
                }
                if (!maxUses) return next();
                db.get(
                  `SELECT COUNT(*) as cnt FROM user_reward WHERE reward_id = ?`,
                  [reward_id],
                  (gErr, gRow) => {
                    if (gErr) return res.status(500).json({ error: gErr.message });
                    const globalCount = gRow ? gRow.cnt : 0;
                    if (globalCount >= maxUses) {
                      return res.status(400).json({ message: "❌ Reward max uses reached" });
                    }
                    next();
                  }
                );
              }
            );
          };

          enforceLimits(() => {
            const newPoints = userPoints - cost;

            db.run("BEGIN TRANSACTION", (txErr) => {
              if (txErr) return res.status(500).json({ error: txErr.message });

              db.run("UPDATE users SET total_point = ? WHERE id = ?", [newPoints, user_id], function (err3) {
                if (err3) {
                  db.run("ROLLBACK");
                  return res.status(500).json({ error: err3.message });
                }

                const desc = `Redeem reward #${reward_id} - ${reward.name}`;
                db.run(
                  `INSERT INTO points_transactions (user_id, reward_id, points, type, description) VALUES (?,?,?,?,?)`,
                  [user_id, reward_id, cost, "debit", desc],
                  function (ptErr) {
                    if (ptErr) {
                      db.run("ROLLBACK");
                      return res.status(500).json({ error: ptErr.message });
                    }

                    const code = crypto.randomBytes(6).toString("hex").toUpperCase();
                    db.run(
                      "INSERT INTO user_reward (user_id, reward_id, code, status, expires_at) VALUES (?, ?, ?, 'active', ?)",
                      [user_id, reward_id, code, reward.expires_at || null],
                      function (err4) {
                        if (err4) {
                          db.run("ROLLBACK");
                          return res.status(500).json({ error: err4.message });
                        }

                        const voucherId = this.lastID;
                        db.run("COMMIT", (commitErr) => {
                          if (commitErr) {
                            db.run("ROLLBACK");
                            return res.status(500).json({ error: commitErr.message });
                          }
                          const voucher = {
                            id: voucherId,
                            code,
                            name: reward.name,
                            status: "active",
                            expiresAt: reward.expires_at || null,
                          };
                          return res.json({ message: "redeemed", newTotalPoints: newPoints, voucher });
                        });
                      }
                    );
                  }
                );
              });
            });
          });
        });
      }
    );
  });
};

export const getEligibleCatalog = (req, res) => {
  const userId = (req.user && req.user.id) || req.query.user_id;
  if (!userId) return res.status(400).json({ error: "user_id (or authenticated user) required" });

  db.get("SELECT total_point FROM users WHERE id = ?", [userId], (err, user) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!user) return res.status(400).json({ error: "User not found" });
    const points = user.total_point || 0;
    db.all(
      "SELECT id, name, description, cost, expires_at FROM rewards WHERE cost <= ? ORDER BY cost ASC",
      [points],
      (err2, rows) => {
        if (err2) return res.status(500).json({ error: err2.message });
        res.json(rows);
      }
    );
  });
};

export const getRewardById = (req, res) => {
  const id = req.params.id;
  const sql = `SELECT * FROM rewards WHERE id = ?`;
  db.get(sql, [id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: "Reward not found" });
    res.json(row);
  });
};

// Mark a user reward as used/redeemed (by id)
export const useUserReward = (req, res) => {
  const userRewardId = req.params.userRewardId;
  const { user_id } = req.body || {};
  if (!user_id) return res.status(400).json({ error: "user_id required" });

  db.get(
    `SELECT * FROM user_reward WHERE id = ? AND user_id = ?`,
    [userRewardId, user_id],
    (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!row) return res.status(404).json({ error: "Voucher not found" });
      if (row.status === "used") return res.status(400).json({ message: "Voucher already used" });
      if (row.expires_at && new Date(row.expires_at) < new Date()) return res.status(400).json({ message: "Voucher expired" });

      // Atomically mark used only if currently active
      db.run(
        `UPDATE user_reward SET status = 'used', used_at = datetime('now') WHERE id = ? AND status = 'active'`,
        [userRewardId],
        function (uErr) {
          if (uErr) return res.status(500).json({ error: uErr.message });
          if (this.changes === 0) return res.status(400).json({ message: "Voucher already used or not redeemable" });

          db.run(
            `INSERT INTO user_activity (user_id, type, meta_json) VALUES (?,?,?)`,
            [user_id, "reward_redeemed", JSON.stringify({ user_reward_id: userRewardId, code: row.code, reward_id: row.reward_id })],
            (aErr) => {
              if (aErr) return res.status(500).json({ error: aErr.message });
              res.json({ message: "Voucher marked as used", user_reward_id: userRewardId, code: row.code });
            }
          );
        }
      );
    }
  );
};

export const getUserVoucherCode = (req, res) => {
  const userId = req.params.userId;
  const userRewardId = req.params.userRewardId;
  db.get(
    `SELECT ur.id as user_reward_id, ur.code, ur.status, ur.used_at, ur.expires_at, r.id as reward_id, r.name, r.description, r.percent, ur.user_id as user_id
     FROM user_reward ur INNER JOIN rewards r ON ur.reward_id = r.id
     WHERE ur.user_id = ? AND ur.id = ?`,
    [userId, userRewardId],
    (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!row) return res.status(404).json({ error: "Voucher not found" });
      res.json(row);
    }
  );
};

export const getUserInventory = (req, res) => {
  const userId = req.params.userId;
  db.all(
    `SELECT ur.id as user_reward_id, ur.code, ur.status, ur.used_at, ur.expires_at, ur.created_at, r.id as reward_id, r.name, r.description, r.percent, ur.user_id as user_id
     FROM user_reward ur INNER JOIN rewards r ON ur.reward_id = r.id
     WHERE ur.user_id = ? ORDER BY ur.created_at DESC`,
    [userId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows || []);
    }
  );
};

export const addUserReward = (req, res) => {
  const userId = req.params.userId;
  const { reward_id, code, expires_at } = req.body || {};
  if (!userId || !reward_id) return res.status(400).json({ error: "userId and reward_id required" });

  const voucherCode = code ? String(code).trim() : crypto.randomBytes(6).toString("hex").toUpperCase();
  db.run(
    `INSERT INTO user_reward (user_id, reward_id, code, status, expires_at, created_at) VALUES (?,?,?,?,?,datetime('now'))`,
    [userId, reward_id, voucherCode, "active", expires_at || null],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      const id = this.lastID;
      db.get(
        `SELECT id as user_reward_id, user_id, reward_id, code, status, expires_at, created_at FROM user_reward WHERE id = ?`,
        [id],
        (gErr, row) => {
          if (gErr) return res.status(500).json({ error: gErr.message });
          res.status(201).json(row);
        }
      );
    }
  );
};

export const deleteUserReward = (req, res) => {
  const userId = req.params.userId;
  const userRewardId = Number(req.params.userRewardId);
  if (!userId || !userRewardId) return res.status(400).json({ error: "userId and userRewardId required" });
  db.run(`DELETE FROM user_reward WHERE id = ? AND user_id = ?`, [userRewardId, userId], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: "Voucher not found or not owned by user" });
    res.json({ message: "Voucher deleted", user_reward_id: userRewardId });
  });
};

export const useUserRewardByCode = (req, res) => {
  const bodyUserId = req.body && req.body.user_id;
  const authUserId = req.user && req.user.id;
  const user_id = authUserId || bodyUserId;
  const { code } = req.body || {};
  if (!user_id || !code) return res.status(400).json({ error: "user_id and code required" });
  if (authUserId && bodyUserId && String(authUserId) !== String(bodyUserId)) {
    return res.status(403).json({ error: "Authenticated user does not match provided user_id" });
  }

  db.get(`SELECT * FROM user_reward WHERE user_id = ? AND code = ?`, [user_id, String(code).trim()], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: "Voucher not found for this user" });
    if (row.status === "used") return res.status(400).json({ message: "Voucher already used" });
    if (row.expires_at && new Date(row.expires_at) < new Date()) return res.status(400).json({ message: "Voucher expired" });

    db.serialize(() => {
      db.run("BEGIN TRANSACTION");

      db.run(
        `UPDATE user_reward SET status = 'used', used_at = datetime('now') WHERE id = ? AND status = 'active'`,
        [row.id],
        function (uErr) {
          if (uErr) {
            db.run("ROLLBACK");
            return res.status(500).json({ error: uErr.message });
          }
          if (this.changes === 0) {
            db.run("ROLLBACK");
            return res.status(400).json({ message: "Voucher already used or not redeemable" });
          }

          db.run(
            `INSERT INTO user_activity (user_id, type, meta_json) VALUES (?,?,?)`,
            [user_id, "reward_redeemed", JSON.stringify({ user_reward_id: row.id, code: row.code, reward_id: row.reward_id })],
            function (aErr) {
              if (aErr) {
                db.run("ROLLBACK");
                return res.status(500).json({ error: aErr.message });
              }

              // Optionally remove voucher from inventory if desired. We'll keep it as 'used' record to retain audit.
              db.run("COMMIT", (cErr) => {
                if (cErr) {
                  db.run("ROLLBACK");
                  return res.status(500).json({ error: cErr.message });
                }
                res.json({ message: "Voucher used", code: row.code });
              });
            }
          );
        }
      );
    });
  });
};

export const getUserTransactions = (req, res) => {
  const userId = req.params.userId;
  const sql = `SELECT id, reward_id, points, type, description, created_at FROM points_transactions WHERE user_id = ? ORDER BY created_at DESC`;
  db.all(sql, [userId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
};
