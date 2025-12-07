import express from 'express';
import { getUserTrip, listTrips, getTrip, createTrip, updateTrip, deleteTrip, getFavoriteTrips, addFavoriteTrip, removeFavoriteTrip, publishTrip, unpublishTrip } from '../controllers/tripsController.js';
import { authenticateJWT } from '../middleware/auth.js';

const router = express.Router();

router.get('/', listTrips);
router.get('/:id', getTrip);
router.post('/', authenticateJWT, createTrip);
router.put('/:id',authenticateJWT, updateTrip);
router.delete('/:id',authenticateJWT, deleteTrip);
// Publish / unpublish a user's own trip
router.post('/:id/publish', authenticateJWT, publishTrip);
router.post('/:id/unpublish', authenticateJWT, unpublishTrip);
// Favorites endpoints
router.get('/me', authenticateJWT, getUserTrip);
router.get('/me/favorites', authenticateJWT, getFavoriteTrips);
router.post('/:id/favorite',authenticateJWT, addFavoriteTrip);
router.delete('/:id/favorite',authenticateJWT, removeFavoriteTrip);

export default router;
