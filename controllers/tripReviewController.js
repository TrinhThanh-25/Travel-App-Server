import db from '../db/connect.js';

export const createReview = (req, res) => {
  const userId = req.user && req.user.id;
  const { trip_id, rating, comment } = req.body;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  if (!trip_id || typeof rating !== 'number') return res.status(400).json({ error: 'Missing fields' });

  db.run(
    `INSERT INTO trip_reviews (user_id, trip_id, rating, comment) VALUES (?, ?, ?, ?)`,
    [userId, trip_id, rating, comment || null],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      const reviewId = this.lastID;
      // Recompute trip aggregates (average rating and count)
      db.get(`SELECT AVG(rating) as avg_rating, COUNT(*) as cnt FROM trip_reviews WHERE trip_id = ?`, [trip_id], (e, row) => {
        if (!e && row) {
          db.run(`UPDATE trips SET rating = ?, review_count = ? WHERE id = ?`, [row.avg_rating || 0, row.cnt || 0, trip_id]);
        }
        res.status(201).json({ id: reviewId, user_id: userId, trip_id, rating, comment });
      });
    }
  );
};

export const listReviewsForTrip = (req, res) => {
  const tripId = req.params.tripId;
  db.all(`SELECT r.id, r.user_id, r.rating, r.comment, r.created_at, u.username FROM trip_reviews r LEFT JOIN users u ON u.id = r.user_id WHERE r.trip_id = ? ORDER BY r.created_at DESC`, [tripId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows || []);
  });
};

export const deleteReview = (req, res) => {
  const userId = req.user && req.user.id;
  const reviewId = req.params.id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  // Only allow owner to delete
  db.get(`SELECT * FROM trip_reviews WHERE id = ?`, [reviewId], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Review not found' });
    if (row.user_id !== userId) return res.status(403).json({ error: 'Forbidden' });
    db.run(`DELETE FROM trip_reviews WHERE id = ?`, [reviewId], function (dErr) {
      if (dErr) return res.status(500).json({ error: dErr.message });
      // recompute aggregates for the trip
      db.get(`SELECT AVG(rating) as avg_rating, COUNT(*) as cnt FROM trip_reviews WHERE trip_id = ?`, [row.trip_id], (e, rrow) => {
        if (!e && rrow) {
          db.run(`UPDATE trips SET rating = ?, review_count = ? WHERE id = ?`, [rrow.avg_rating || 0, rrow.cnt || 0, row.trip_id]);
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
  // Only allow owner to edit
  db.get(`SELECT * FROM trip_reviews WHERE id = ?`, [reviewId], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Review not found' });
    if (row.user_id !== userId) return res.status(403).json({ error: 'Forbidden' });
    db.run(`UPDATE trip_reviews SET rating = ?, comment = ? WHERE id = ?`, [rating, comment || null, reviewId], function (uErr) {
      if (uErr) return res.status(500).json({ error: uErr.message });
      // recompute aggregates for the trip
      db.get(`SELECT AVG(rating) as avg_rating, COUNT(*) as cnt FROM trip_reviews WHERE trip_id = ?`, [row.trip_id], (e, rrow) => {
        if (!e && rrow) {
          db.run(`UPDATE trips SET rating = ?, review_count = ? WHERE id = ?`, [rrow.avg_rating || 0, rrow.cnt || 0, row.trip_id]);
        }
        res.json({ id: reviewId, user_id: userId, trip_id: row.trip_id, rating, comment });
      });
    });
  });
};
