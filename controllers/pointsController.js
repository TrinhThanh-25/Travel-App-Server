import db from "../db/connect.js";

export const addTransaction = (req, res) => {
  const actorId = req.user && req.user.id;
  if (!actorId) return res.status(401).json({ error: 'Unauthorized' });
  const { points, type, description, user_id } = req.body;
  const targetUser = user_id || actorId;
  if (typeof points !== 'number' || !type) return res.status(400).json({ error: 'Missing fields' });

  db.run(`INSERT INTO points_transactions (user_id, points, type, description) VALUES (?, ?, ?, ?)`, [targetUser, points, type, description || null], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    // update user's total_point atomically (best-effort in sqlite)
    db.run(`UPDATE users SET total_point = COALESCE(total_point, 0) + ? WHERE id = ?`, [points, targetUser], function (uErr) {
      if (uErr) console.warn('Could not update user points:', uErr.message);
      res.status(201).json({ id: this.lastID, user_id: targetUser, points, type, description });
    });
  });
};

export const listTransactionsForUser = (req, res) => {
  const userId = req.user && req.user.id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  db.all(`SELECT id, user_id, points, type, description, created_at FROM points_transactions WHERE user_id = ? ORDER BY created_at DESC`, [userId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows || []);
  });
};

export default { addTransaction, listTransactionsForUser, getMyPoints };
