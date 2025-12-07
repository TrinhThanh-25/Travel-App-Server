import express from 'express'
import { createRental, findRental, patchRental, listUserOpenRentals } from '../controllers/rentalController.js'
import { authenticateJWT } from '../middleware/auth.js'

const router = express.Router()

// list open rentals for a user (more specific path)
router.get('/open', listUserOpenRentals)

// find rental(s) by bikeId/userEmail/isReturned
router.get('/', findRental)

// create rental
router.post('/', authenticateJWT, createRental)

// update rental by id
router.patch('/:id', authenticateJWT, patchRental)

export default router
