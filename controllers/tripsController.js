import db from "../db/connect.js";

// List trips with optional filtering: ?q=, ?min_rating=, ?max_price=, ?limit=, ?offset=
export const listTrips = (req, res) => {
  const q = (req.query.q || '').trim();
  const minRating = req.query.min_rating ? parseFloat(req.query.min_rating) : 0;
  const maxPrice = req.query.max_price ? parseInt(req.query.max_price) : 999999999;
  const limit = parseInt(req.query.limit) || 20;
  const offset = parseInt(req.query.offset) || 0;
  const sort = (req.query.sort || 'rating-desc').toLowerCase();
  let [col, dir] = sort.split('-');
  const allowedCols = ['rating','review_count','estimate_price','total_time','title','id'];
  if (!allowedCols.includes(col)) col = 'rating';
  dir = dir === 'asc' ? 'ASC' : 'DESC';

  const userId = (req.user && req.user.id) ? Number(req.user.id) : -1;

  const conditions = [];
  const params = [];
  if (q) { conditions.push('(title LIKE ? OR description LIKE ? OR key_highlight LIKE ?)'); const like = `%${q}%`; params.push(like, like, like); }
  if (!Number.isNaN(minRating)) { conditions.push('COALESCE(rating,0) >= ?'); params.push(minRating); }
  if (!Number.isNaN(maxPrice)) { conditions.push('COALESCE(estimate_price,0) <= ?'); params.push(maxPrice); }
  // Only list globally posted trips
  conditions.unshift('t.is_post = 1');
  const where = 'WHERE ' + conditions.join(' AND ');
  const sql = `
    SELECT t.id,t.title,t.description,t.rating,t.review_count,t.key_highlight,t.estimate_price,t.total_time,t.url_image,
           CASE WHEN uft.trip_id IS NOT NULL THEN 1 ELSE 0 END AS is_favorite
    FROM trips t
    LEFT JOIN user_favorite_trips uft
      ON uft.trip_id = t.id AND uft.user_id = ?
    ${where}
    ORDER BY ${col} ${dir}
    LIMIT ? OFFSET ?`;
  params.unshift(userId);
  params.push(limit, offset);
  db.all(sql, params, (err, rows) => {
    if (err) {
      console.error('Trips list query failed:', err.message);
      return res.status(500).json({ error: err.message });
    }
    res.json({ data: rows, nextOffset: offset + limit, count: rows.length });
  });
};

// Get a single trip with ordered locations
export const getTrip = (req, res) => {
  const id = parseInt(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid trip id' });
  const userId = (req.user && req.user.id) ? Number(req.user.id) : -1;
  const tripSql = `SELECT t.id,t.title,t.description,t.rating,t.review_count,t.key_highlight,t.estimate_price,t.total_time,t.url_image,
                          CASE WHEN uft.trip_id IS NOT NULL THEN 1 ELSE 0 END AS is_favorite
                   FROM trips t
                   LEFT JOIN user_favorite_trips uft ON uft.trip_id = t.id AND uft.user_id = ?
                   WHERE t.id = ?`;
  db.get(tripSql, [userId, id], (err, trip) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!trip) return res.status(404).json({ error: 'Trip not found' });
  const locSql = `SELECT tl.location_id, tl.order_index, l.name, l.category, l.type, l.price, l.description, l.latitude, l.longitude, l.address, l.image_url, l.rating, l.review_count
                    FROM tripsLocation tl JOIN locations l ON tl.location_id = l.id
                    WHERE tl.trip_id = ? ORDER BY COALESCE(tl.order_index, 9999), tl.location_id`;
    db.all(locSql, [id], (lErr, rows) => {
      if (lErr) {
        console.error('Trip locations query failed:', lErr.message);
        return res.status(500).json({ error: lErr.message });
      }
      trip.locations = rows.map(r => ({
        id: r.location_id,
        order: r.order_index,
        order_index: r.order_index,
        name: r.name,
        category: r.category,
        type: r.type,
        price: r.price,
        description: r.description,
        latitude: r.latitude,
        longitude: r.longitude,
        address: r.address,
        image_url: r.image_url,
        rating: r.rating,
        review_count: r.review_count
      }));
      res.json(trip);
    });
  });
};

// Not allowed for static dataset
export const createTrip = (req, res) => {
  const userId = req.user && Number(req.user.id);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  const { title, description, estimate_price, total_time, url_image, key_highlight } = req.body || {};
  if (!title || typeof title !== 'string') return res.status(400).json({ error: 'title is required' });
  const now = new Date().toISOString();
  const ep = Number.isFinite(Number(estimate_price)) ? Number(estimate_price) : null;
  const tt = Number.isFinite(Number(total_time)) ? Number(total_time) : null;
  const stmt = `INSERT INTO trips (title, description, rating, review_count, key_highlight, estimate_price, total_time, url_image, user_id, created_at, is_post)
                VALUES (?,?,?,?,?,?,?,?,?,?,?)`;
  const params = [title, description || null, null, 0, key_highlight || null, ep, tt, url_image || null, userId, now, 0];
  db.run(stmt, params, function (err) {
    if (err) return res.status(500).json({ error: err.message });
    const id = this.lastID;
    db.get(`SELECT id, title, description, rating, review_count, key_highlight, estimate_price, total_time, url_image, user_id, created_at, is_post FROM trips WHERE id = ?`, [id], (gErr, row) => {
      if (gErr) return res.status(500).json({ error: gErr.message });
      res.status(201).json(row);
    });
  });
};
export const updateTrip = (req, res) => res.status(405).json({ error: 'Static dataset. Trip update disabled.' });
export const deleteTrip = (req, res) => res.status(405).json({ error: 'Static dataset. Trip delete disabled.' });

// Favorites for trips
export const getFavoriteTrips = (req, res) => {
  const userId = req.user && req.user.id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  const sql = `
    SELECT t.*, 1 AS is_favorite
    FROM trips t
    JOIN user_favorite_trips uft ON t.id = uft.trip_id
    WHERE uft.user_id = ?
    ORDER BY COALESCE(t.rating,0) DESC, t.id ASC`;
  db.all(sql, [userId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
};

export const addFavoriteTrip = (req, res) => {
  const userId = req.user && req.user.id;
  const tripId = Number(req.params.id);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  if (!tripId) return res.status(400).json({ error: 'Invalid trip id' });
  db.run(`INSERT OR IGNORE INTO user_favorite_trips (user_id, trip_id) VALUES (?, ?)`, [userId, tripId], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(400).json({ message: '❌ Trip already in favorites' });
    res.json({ message: '✅ Trip added to favorites' });
  });
};

export const removeFavoriteTrip = (req, res) => {
  const userId = req.user && req.user.id;
  const tripId = Number(req.params.id);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  if (!tripId) return res.status(400).json({ error: 'Invalid trip id' });
  db.run(`DELETE FROM user_favorite_trips WHERE user_id = ? AND trip_id = ?`, [userId, tripId], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(400).json({ message: '❌ Trip not in favorites' });
    res.json({ message: '✅ Trip removed from favorites' });
  });
};

export default { listTrips, getTrip, createTrip, updateTrip, deleteTrip, getFavoriteTrips, addFavoriteTrip, removeFavoriteTrip };
