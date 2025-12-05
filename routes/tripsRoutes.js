import express from 'express';
import { listTrips, getTrip, createTrip, updateTrip, deleteTrip, getFavoriteTrips, addFavoriteTrip, removeFavoriteTrip } from '../controllers/tripsController.js';
import { authenticateJWT } from '../middleware/auth.js';

const router = express.Router();

router.get('/', listTrips);
router.get('/:id', getTrip);
router.post('/', createTrip);
router.put('/:id', updateTrip);
router.delete('/:id', deleteTrip);
// Favorites endpoints
router.get('/me/favorites', authenticateJWT, getFavoriteTrips);
router.post('/:id/favorite', addFavoriteTrip);
router.delete('/:id/favorite', removeFavoriteTrip);

export default router;
