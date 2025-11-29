import express from 'express'
import { createRental, findRental, patchRental, listUserOpenRentals } from '../controllers/rentalController.js'
import { authenticateJWT } from '../middleware/auth.js'

const router = express.Router()

// create rental
router.post('/', authenticateJWT, createRental)

// find rental(s) by bikeId/userEmail/isReturned
router.get('/', findRental)

// update rental
router.patch('/:id', authenticateJWT, patchRental)

// list open rentals for a user
router.get('/open', listUserOpenRentals)

export default router
