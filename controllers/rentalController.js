import db from '../db/connect.js'
import { v4 as uuidv4 } from 'uuid'

export const createRental = (req, res) => {
  const payload = req.body || {}
  const id = payload.id || uuidv4()
  const { userEmail, bikeId, shopId, rentalStart, expectedReturn, isReturned, actualReturn, totalCost, isPaid } = payload
  db.run('INSERT INTO Rentals (id, userEmail, bikeId, shopId, rentalStart, expectedReturn, isReturned, actualReturn, totalCost, isPaid) VALUES (?,?,?,?,?,?,?,?,?,?)',
    [id, userEmail, bikeId, shopId, rentalStart || new Date().toISOString(), expectedReturn || null, isReturned ? 1 : 0, actualReturn || null, totalCost || null, isPaid ? 1 : 0], function(err){
      if (err) return res.status(500).json({ error: err.message })
      db.get('SELECT * FROM Rentals WHERE id = ?', [id], (e, row) => {
        if (e) return res.status(500).json({ error: e.message })
        res.status(201).json(row)
      })
    })
}

export const findRental = (req, res) => {
  // supports query by bikeId and userEmail and isReturned flag
  const { bikeId, userEmail, isReturned } = req.query
  const params = []
  let sql = 'SELECT * FROM Rentals WHERE 1=1'
  if (bikeId) { sql += ' AND bikeId = ?'; params.push(bikeId) }
  if (userEmail) { sql += ' AND userEmail = ?'; params.push(userEmail) }
  if (typeof isReturned !== 'undefined') { sql += ' AND isReturned = ?'; params.push(isReturned === 'true' ? 1 : 0) }
  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message })
    res.json(rows)
  })
}

export const patchRental = (req, res) => {
  const { id } = req.params
  const payload = req.body || {}
  const allowed = ['isReturned','actualReturn','totalCost','isPaid']
  const updates = []
  const vals = []
  for (const k of allowed){
    if (k in payload){
      updates.push(`${k} = ?`)
      let v = payload[k]
      if (k === 'isReturned' || k === 'isPaid') v = v ? 1 : 0
      vals.push(v)
    }
  }
  if (updates.length === 0) return res.status(400).json({ error: 'No update fields provided' })
  vals.push(id)
  const sql = `UPDATE Rentals SET ${updates.join(', ')} WHERE id = ?`
  db.run(sql, vals, function(err){
    if (err) return res.status(500).json({ error: err.message })
    if (this.changes === 0) return res.status(404).json({ error: 'Not found' })
    db.get('SELECT * FROM Rentals WHERE id = ?', [id], (e, row) => {
      if (e) return res.status(500).json({ error: e.message })
      res.json(row)
    })
  })
}

export const listUserOpenRentals = (req, res) => {
  const { userEmail } = req.query
  if (!userEmail) return res.status(400).json({ error: 'userEmail required' })
  db.all('SELECT * FROM Rentals WHERE userEmail = ? AND (isReturned IS NULL OR isReturned = 0)', [userEmail], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message })
    res.json(rows)
  })
}
