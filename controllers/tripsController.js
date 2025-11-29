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
  const allowedCols = ['rating','estimate_price','total_time','title','id'];
  if (!allowedCols.includes(col)) col = 'rating';
  dir = dir === 'asc' ? 'ASC' : 'DESC';

  const conditions = [];
  const params = [];
  if (q) { conditions.push('(title LIKE ? OR description LIKE ? OR key_highlight LIKE ?)'); const like = `%${q}%`; params.push(like, like, like); }
  if (!Number.isNaN(minRating)) { conditions.push('COALESCE(rating,0) >= ?'); params.push(minRating); }
  if (!Number.isNaN(maxPrice)) { conditions.push('COALESCE(estimate_price,0) <= ?'); params.push(maxPrice); }
  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
  const sql = `SELECT id,title,description,rating,key_highlight,estimate_price,total_time,url_image FROM trips ${where} ORDER BY ${col} ${dir} LIMIT ? OFFSET ?`;
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
  const tripSql = 'SELECT id,title,description,rating,key_highlight,estimate_price,total_time,url_image FROM trips WHERE id = ?';
  db.get(tripSql, [id], (err, trip) => {
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
export const createTrip = (req, res) => res.status(405).json({ error: 'Static dataset. Trip creation disabled.' });
export const updateTrip = (req, res) => res.status(405).json({ error: 'Static dataset. Trip update disabled.' });
export const deleteTrip = (req, res) => res.status(405).json({ error: 'Static dataset. Trip delete disabled.' });

export default { listTrips, getTrip, createTrip, updateTrip, deleteTrip };
