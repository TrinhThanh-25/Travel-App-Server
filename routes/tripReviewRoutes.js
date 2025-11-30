import express from 'express';
import { editReview, createReview, listReviewsForTrip, deleteReview } from '../controllers/tripReviewController.js';
import { authenticateJWT } from '../middleware/auth.js';
import { validateSchema } from '../middleware/validate.js';
import Joi from 'joi';

const router = express.Router();

const createSchema = Joi.object({ trip_id: Joi.number().required(), rating: Joi.number().min(0).max(5).required(), comment: Joi.string().allow('', null) });

router.post('/', authenticateJWT, validateSchema(createSchema), createReview);
router.get('/trip/:tripId', listReviewsForTrip);
router.delete('/:id', authenticateJWT, deleteReview);
router.put('/:id', authenticateJWT, validateSchema(createSchema), editReview);

export default router;
