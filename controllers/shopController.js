import db from '../db/connect.js'

export const listShops = (req, res) => {
  db.all('SELECT * FROM Shops', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message })
    try {
      const mapped = rows.map(r => {
        const out = { ...r };
        // parse JSON-like/text fields into arrays/objects if possible
        for (const col of ['galleryImages','motorbikes','userReviews']){
          const v = out[col] || out[col.toLowerCase()];
          if (typeof v === 'string'){
            const trimmed = v.trim();
            if (trimmed === '') out[col] = [];
            else if (trimmed.startsWith('[') || trimmed.startsWith('{')){
              try { out[col] = JSON.parse(trimmed); } catch(e){ out[col] = trimmed.split(/\s*,\s*/); }
            } else if (trimmed.indexOf(',') !== -1){
              out[col] = trimmed.split(/\s*,\s*/);
            } else {
              out[col] = [trimmed];
            }
          } else if (Array.isArray(v)) {
            out[col] = v;
          } else {
            out[col] = v || [];
          }
        }
        // normalize image_url / imageUrl
        out.image_url = out.image_url || out.imageUrl || null;
        out.rating_count = out.rating_count || out.ratingCount || null;
        return out;
      })
      res.json(mapped)
    } catch(e){
      // fallback
      res.json(rows)
    }
  })
}

export const getShop = (req, res) => {
  const { shopId } = req.params
  db.get('SELECT * FROM Shops WHERE id = ?', [shopId], (err, row) => {
    if (err) return res.status(500).json({ error: err.message })
    if (!row) return res.status(404).json({ error: 'Not found' })
    try{
      const out = { ...row };
      for (const col of ['galleryImages','motorbikes','userReviews']){
        const v = out[col] || out[col.toLowerCase()];
        if (typeof v === 'string'){
          const trimmed = v.trim();
          if (trimmed === '') out[col] = [];
          else if (trimmed.startsWith('[') || trimmed.startsWith('{')){
            try{ out[col] = JSON.parse(trimmed); } catch(e){ out[col] = trimmed.split(/\s*,\s*/); }
          } else if (trimmed.indexOf(',') !== -1){
            out[col] = trimmed.split(/\s*,\s*/);
          } else out[col] = [trimmed];
        } else if (Array.isArray(v)) out[col] = v;
        else out[col] = v || [];
      }
      out.image_url = out.image_url || out.imageUrl || null;
      out.rating_count = out.rating_count || out.ratingCount || null;
      res.json(out)
    }catch(e){
      res.json(row)
    }
  })
}
