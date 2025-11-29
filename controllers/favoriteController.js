import db from '../db/connect.js'
import { v4 as uuidv4 } from 'uuid'

export const listFavorites = (req, res) => {
  const { userEmail, itemId, type } = req.query
  const params = []
  let sql = 'SELECT * FROM favorites WHERE 1=1'
  if (userEmail) { sql += ' AND userEmail = ?'; params.push(userEmail) }
  if (itemId) { sql += ' AND itemId = ?'; params.push(itemId) }
  if (type) { sql += ' AND type = ?'; params.push(type) }
  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message })
    res.json(rows)
  })
}

export const createFavorite = (req, res) => {
  const { userEmail, itemId, type } = req.body
  if (!userEmail || !itemId || !type) return res.status(400).json({ error: 'Missing fields' })
  const id = uuidv4()
  const createdAt = new Date().toISOString()
  db.run('INSERT INTO favorites (id, userEmail, itemId, type, createdAt) VALUES (?,?,?,?,?)', [id, userEmail, itemId, type, createdAt], function(err){
    if (err) return res.status(500).json({ error: err.message })
    res.status(201).json({ id, userEmail, itemId, type, createdAt })
  })
}

export const getFavorite = (req, res) => {
  const { userEmail, itemId, type } = req.query
  if (!userEmail && !itemId) return res.status(400).json({ error: 'Provide userEmail or itemId' })
  const params = []
  let sql = 'SELECT * FROM favorites WHERE 1=1'
  if (userEmail) { sql += ' AND userEmail = ?'; params.push(userEmail) }
  if (itemId) { sql += ' AND itemId = ?'; params.push(itemId) }
  if (type) { sql += ' AND type = ?'; params.push(type) }
  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message })
    res.json(rows)
  })
}

export const deleteFavorite = (req, res) => {
  const { id } = req.params
  db.run('DELETE FROM favorites WHERE id = ?', [id], function(err){
    if (err) return res.status(500).json({ error: err.message })
    if (this.changes === 0) return res.status(404).json({ error: 'Not found' })
    res.json({ message: 'Deleted' })
  })
}
