import db from '../db/connect.js'

export const listMotorbikes = (req, res) => {
  db.all('SELECT * FROM Motorbikes', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message })
    res.json(rows)
  })
}

export const getMotorbike = (req, res) => {
  const { bikeId } = req.params
  db.get('SELECT * FROM Motorbikes WHERE id = ?', [bikeId], (err, row) => {
    if (err) return res.status(500).json({ error: err.message })
    if (!row) return res.status(404).json({ error: 'Not found' })
    res.json(row)
  })
}

export const patchMotorbike = (req, res) => {
  const { bikeId } = req.params
  const { available } = req.body
  if (typeof available === 'undefined') return res.status(400).json({ error: 'Missing available' })
  const val = available ? 1 : 0
  db.run('UPDATE Motorbikes SET available = ? WHERE id = ?', [val, bikeId], function(err){
    if (err) return res.status(500).json({ error: err.message })
    if (this.changes === 0) return res.status(404).json({ error: 'Not found' })
    db.get('SELECT * FROM Motorbikes WHERE id = ?', [bikeId], (e, row) => {
      if (e) return res.status(500).json({ error: e.message })
      res.json(row)
    })
  })
}
