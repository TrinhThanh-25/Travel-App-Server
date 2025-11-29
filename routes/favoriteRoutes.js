import express from 'express'
import { listFavorites, createFavorite, getFavorite, deleteFavorite } from '../controllers/favoriteController.js'
import { authenticateJWT } from '../middleware/auth.js'

const router = express.Router()

// Public: list favorites by query
router.get('/', listFavorites)

// Find specific favorite (by userEmail,itemId,type)
router.get('/find', getFavorite)

// Create favorite (authenticated preferred but allow body-driven)
router.post('/', authenticateJWT, createFavorite)

// Delete favorite by id
router.delete('/:id', authenticateJWT, deleteFavorite)

export default router
