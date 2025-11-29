import db from '../db/connect.js';

export const createReview = (req, res) => {
  const userId = req.user && req.user.id;
  const { location_id, rating, comment } = req.body;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  if (!location_id || typeof rating !== 'number') return res.status(400).json({ error: 'Missing fields' });

  db.run(
    `INSERT INTO location_reviews (user_id, location_id, rating, comment) VALUES (?, ?, ?, ?)`,
    [userId, location_id, rating, comment || null],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      const reviewId = this.lastID;
      // Recompute location aggregates (average rating and count)
      db.get(`SELECT AVG(rating) as avg_rating, COUNT(*) as cnt FROM location_reviews WHERE location_id = ?`, [location_id], (e, row) => {
        if (!e && row) {
          db.run(`UPDATE locations SET rating = ?, review_count = ? WHERE id = ?`, [row.avg_rating || 0, row.cnt || 0, location_id]);
        }
        res.status(201).json({ id: reviewId, user_id: userId, location_id, rating, comment });
      });
    }
  );
};

export const listReviewsForLocation = (req, res) => {
  const locationId = req.params.locationId;
  db.all(`SELECT r.id, r.user_id, r.rating, r.comment, r.created_at, u.username FROM location_reviews r LEFT JOIN users u ON u.id = r.user_id WHERE r.location_id = ? ORDER BY r.created_at DESC`, [locationId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows || []);
  });
};

export const deleteReview = (req, res) => {
  const userId = req.user && req.user.id;
  const reviewId = req.params.id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  // Only allow owner to delete (no admin role implemented yet)
  db.get(`SELECT * FROM location_reviews WHERE id = ?`, [reviewId], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Review not found' });
    if (row.user_id !== userId) return res.status(403).json({ error: 'Forbidden' });
    db.run(`DELETE FROM location_reviews WHERE id = ?`, [reviewId], function (dErr) {
      if (dErr) return res.status(500).json({ error: dErr.message });
      // recompute aggregates for the location
      db.get(`SELECT AVG(rating) as avg_rating, COUNT(*) as cnt FROM location_reviews WHERE location_id = ?`, [row.location_id], (e, rrow) => {
        if (!e && rrow) {
          db.run(`UPDATE locations SET rating = ?, review_count = ? WHERE id = ?`, [rrow.avg_rating || 0, rrow.cnt || 0, row.location_id]);
        }
        res.json({ success: true });
      });
    });
  });
};

export const editReview = (req, res) => {
  const userId = req.user && req.user.id;
  const reviewId = req.params.id;
  const { rating, comment } = req.body;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  // Only allow owner to edit (no admin role implemented yet)
  db.get(`SELECT * FROM location_reviews WHERE id = ?`, [reviewId], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Review not found' });
    if (row.user_id !== userId) return res.status(403).json({ error: 'Forbidden' });
    db.run(`UPDATE location_reviews SET rating = ?, comment = ? WHERE id = ?`, [rating, comment || null, reviewId], function (uErr) {
      if (uErr) return res.status(500).json({ error: uErr.message });
      // recompute aggregates for the location
      db.get(`SELECT AVG(rating) as avg_rating, COUNT(*) as cnt FROM location_reviews WHERE location_id = ?`, [row.location_id], (e, rrow) => {
        if (!e && rrow) {
          db.run(`UPDATE locations SET rating = ?, review_count = ? WHERE id = ?`, [rrow.avg_rating || 0, rrow.cnt || 0, row.location_id]);
        }
        res.json({ id: reviewId, user_id: userId, location_id: row.location_id, rating, comment });
      });
    });
  });
};