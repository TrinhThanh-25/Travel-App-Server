import db from "../db/connect.js";
import { authenticateJWT } from "../middleware/auth.js";

export const listLocationImages = (req, res) => {
  const locationId = req.params.locationId || req.query.location_id;
  if (!locationId) return res.status(400).json({ error: 'locationId required' });
  db.all(
    'SELECT id, url, caption, sort_order FROM location_images WHERE location_id = ? ORDER BY sort_order ASC, id ASC',
    [locationId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows || []);
    }
  );
};

export const addLocationImage = (req, res) => {
  const locationId = req.params.locationId || req.body.location_id;
  const { url_image, sort_order, caption } = req.body;
  if (!locationId || !url_image) return res.status(400).json({ error: 'location_id and url_image required' });
  db.run(
    'INSERT INTO location_images (location_id, url_image, sort_order, caption) VALUES (?, ?, ?, ?)',
    [locationId, url_image, sort_order || 0, caption || null],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ id: this.lastID, location_id: locationId, url_image, sort_order: sort_order || 0, caption: caption || null });
    }
  );
};

export const updateLocationImage = (req, res) => {
  const imageId = req.params.imageId;
  const { url_image, sort_order, caption } = req.body;
  const fields = [];
  const params = [];
  if (typeof url_image !== 'undefined') { fields.push('url_image = ?'); params.push(url_image); }
  if (typeof sort_order !== 'undefined') { fields.push('sort_order = ?'); params.push(sort_order); }
  if (typeof caption !== 'undefined') { fields.push('caption = ?'); params.push(caption); }
  if (!fields.length) return res.status(400).json({ error: 'Nothing to update' });
  params.push(imageId);
  const sql = `UPDATE location_images SET ${fields.join(', ')} WHERE id = ?`;
  db.run(sql, params, function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, changes: this.changes });
  });
};

export const deleteLocationImage = (req, res) => {
  const imageId = req.params.imageId;
  db.run('DELETE FROM location_images WHERE id = ?', [imageId], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, changes: this.changes });
  });
};

export default { listLocationImages, addLocationImage, updateLocationImage, deleteLocationImage };
