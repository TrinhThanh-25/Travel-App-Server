import db from "../db/connect.js";

// List trip-location mappings. Supports ?trip_id=, ?limit=, ?offset=
export const listTripLocations = (req, res) => {
  const tripId = req.query.trip_id ? parseInt(req.query.trip_id) : null;
  const limit = parseInt(req.query.limit) || 200;
  const offset = parseInt(req.query.offset) || 0;
  const params = [];
  const conditions = [];
  if (tripId) { conditions.push('tl.trip_id = ?'); params.push(tripId); }
  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
  const sql = `SELECT tl.trip_id, tl.location_id, tl.order_index, l.name, l.category, l.type, l.price, l.latitude, l.longitude, l.address, l.image_url
               FROM tripsLocation tl JOIN locations l ON tl.location_id = l.id
               ${where}
               ORDER BY tl.trip_id, COALESCE(tl.order_index, 9999), tl.location_id
               LIMIT ? OFFSET ?`;
  params.push(limit, offset);
  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    const data = rows.map(r => ({
      trip_id: r.trip_id,
      location_id: r.location_id,
      order: r.order_index,
      order_index: r.order_index,
      name: r.name,
      category: r.category,
      type: r.type,
      price: r.price,
      latitude: r.latitude,
      longitude: r.longitude,
      address: r.address,
      image_url: r.image_url,
    }));
    res.json({ data, nextOffset: offset + limit, count: data.length });
  });
};

export default { listTripLocations };
