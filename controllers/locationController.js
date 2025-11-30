import db from "../db/connect.js";

export const getAllLocations = (req, res) => {
  const query = req.query.q || '';
  const category = req.query.category || '';
  const type = req.query.type || '';
  const sort_by = req.query.sort_by || 'name-asc';
  const id = req.params.id || null;
  let [column, direction] = sort_by.split('-');
  const userId = (req.user && req.user.id) ? Number(req.user.id) : -1; // -1 means no favorites

  // Chỉ cho phép sort các cột an toàn
  const allowedColumns = ["name", "price", "rating","review_count"];
  if (!allowedColumns.includes(column)) column = "name";
  direction = direction === "desc" ? "DESC" : "ASC";

  // Price range
  let minPrice = 0;
  let maxPrice = 9999999999;
  if (req.query.price) {
    const [range] = req.query.price.split("ps");
    let [min, max] = range.split("-");
    minPrice = parseInt(min) || 0;
    maxPrice = parseInt(max) || 9999999999;
  }

  // Build SQL với điều kiện động
  let conditions = [];
  let params = [];

  if (query) {
    conditions.push("(name LIKE ? OR description LIKE ?)");
    const likeQuery = `%${query}%`;
    params.push(likeQuery, likeQuery);
  }

  if (category) {
    conditions.push("category = ?");
    params.push(category);
  }

  if (type) {
    conditions.push("type = ?");
    params.push(type);
  }

  conditions.push("price BETWEEN ? AND ?");
  params.push(minPrice, maxPrice);

  // Kết hợp điều kiện
  const whereClause = conditions.length > 0 ? "WHERE " + conditions.join(" AND ") : "";

  const sql = `
    SELECT locations.*,
      CASE WHEN ufl.location_id IS NOT NULL THEN 1 ELSE 0 END AS is_favorite
    FROM locations
    LEFT JOIN user_favorite_locations ufl
      ON ufl.location_id = locations.id AND ufl.user_id = ?
    ${whereClause}
    ORDER BY ${column} ${direction}
  `;

  // prepend userId for the JOIN condition
  params = [userId, ...params];
  

  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });

    res.json(rows);
  });
};


export const addLocation = (req, res) => {
  const { name, image_url, description, address, opening_hours, closing_hours, rating, review_count, qr_code } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  const sql = `INSERT INTO locations (name, image_url, description, address, opening_hours, closing_hours, rating, review_count, qr_code) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
  db.run(sql, [name, image_url || null, description || null, address || null, opening_hours || null, closing_hours || null, rating || 0.0, review_count || 0, qr_code || null], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id: this.lastID, message: "📍 New location added!" });
  });
};

export const getLocationById = (req, res) => {
  const id = Number(req.params.id);
  const userId = (req.user && req.user.id) ? Number(req.user.id) : -1;
  if (!id) return res.status(400).json({ error: 'Invalid location id' });
  const sql = `
    SELECT l.*, CASE WHEN ufl.location_id IS NOT NULL THEN 1 ELSE 0 END AS is_favorite
    FROM locations l
    LEFT JOIN user_favorite_locations ufl
      ON ufl.location_id = l.id AND ufl.user_id = ?
    WHERE l.id = ?
  `;
  db.get(sql, [userId, id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Location not found' });
    res.json(row);
  });
};

// GET nearby locations sorted by weighted score of distance and rating
export const nearbyLocations = (req, res) => {
  const lat = parseFloat(req.query.lat);
  const lon = parseFloat(req.query.lon);
  if (Number.isNaN(lat) || Number.isNaN(lon)) return res.status(400).json({ error: 'lat and lon query params required' });
  const userId = (req.user && req.user.id) ? Number(req.user.id) : -1;

  const radius = parseFloat(req.query.radius) || 5; // km
  const limit = parseInt(req.query.limit) || 20;
  // weights: higher means more important. will be normalized to sum=1
  let w_distance = typeof req.query.w_distance !== 'undefined' ? parseFloat(req.query.w_distance) : 0.6;
  let w_rating = typeof req.query.w_rating !== 'undefined' ? parseFloat(req.query.w_rating) : 0.4;
  if (Number.isNaN(w_distance) || Number.isNaN(w_rating)) { w_distance = 0.6; w_rating = 0.4; }
  const wSum = Math.abs(w_distance) + Math.abs(w_rating) || 1;
  w_distance = Math.abs(w_distance) / wSum;
  w_rating = Math.abs(w_rating) / wSum;

  // Haversine-ish distance using acos formula. convert degrees to radians multiplier:
  const DEG2RAD = 0.017453292519943295; // Math.PI/180
  // We'll compute distance in a subquery then compute a score combining normalized distance and normalized rating.
  const distanceExpr = `(
    6371 * acos(
      max(-1, min(1,
        cos(? * ${DEG2RAD}) * cos(latitude * ${DEG2RAD}) * cos((longitude * ${DEG2RAD}) - (? * ${DEG2RAD})) +
        sin(? * ${DEG2RAD}) * sin(latitude * ${DEG2RAD})
      ))
    )
  )`;

  // Build SQL: compute distance per row in a subquery so we can reference it in score calculation
  const sql = `SELECT l.*, l.distance as distance_km,
    (
      ? * (IFNULL(l.rating,0) / 5.0) +
      ? * (CASE WHEN l.distance > ? THEN 0 ELSE (1.0 - (l.distance / ?)) END)
    ) AS score
    , CASE WHEN ufl.location_id IS NOT NULL THEN 1 ELSE 0 END AS is_favorite
    FROM (
      SELECT *, ${distanceExpr} AS distance FROM locations
    ) l
    LEFT JOIN user_favorite_locations ufl
      ON ufl.location_id = l.id AND ufl.user_id = ?
    ${radius ? 'WHERE l.distance <= ?' : ''}
    ORDER BY score DESC, IFNULL(l.rating,0) DESC, l.distance ASC
    LIMIT ?`;

  const params = [lat, lon, lat, // distanceExpr args: ?, ?, ? (lat, lon, lat)
    w_rating, w_distance, radius, radius, userId];

  if (radius) params.push(radius);
  params.push(limit);

  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows.map(r => ({
      id: r.id,
      name: r.name,
      address: r.address,
      city: r.city,
      rating: r.rating || 0,
      review_count: r.review_count || 0,
      distance_km: Number(r.distance_km).toFixed(3),
      score: Number(r.score).toFixed(4)
    })));
  });
};

export const getFavoriteLocations = (req, res) => {
  const userId = req.user && req.user.id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const sql = `
    SELECT l.*,
    CASE WHEN ufl.location_id IS NOT NULL THEN 1 ELSE 0 END AS is_favorite
    FROM locations l
    JOIN user_favorite_locations ufl ON l.id = ufl.location_id
    WHERE ufl.user_id = ?
  `;
  db.all(sql, [userId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
};

export const addFavoriteLocation = (req, res) => {
  const userId = req.user && req.user.id;
  const locationId = Number(req.params.id);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  if (!locationId) return res.status(400).json({ error: 'Invalid location id' });

  db.run(`INSERT OR IGNORE INTO user_favorite_locations (user_id, location_id) VALUES (?, ?)`, [userId, locationId], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) {
      return res.status(400).json({ message: '❌ Location already in favorites' });
    }
    res.json({ message: '✅ Location added to favorites' });
  });
};

export const removeFavoriteLocation = (req, res) => {
  const userId = req.user && req.user.id;
  const locationId = Number(req.params.id);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  if (!locationId) return res.status(400).json({ error: 'Invalid location id' });

  db.run(`DELETE FROM user_favorite_locations WHERE user_id = ? AND location_id = ?`, [userId, locationId], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) {
      return res.status(400).json({ message: '❌ Location not in favorites' });
    }
    res.json({ message: '✅ Location removed from favorites' });
  });
};
