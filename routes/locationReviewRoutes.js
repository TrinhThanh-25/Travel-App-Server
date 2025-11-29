import express from 'express';
import { editReview, createReview, listReviewsForLocation, deleteReview } from '../controllers/locationReviewController.js';
import { authenticateJWT } from '../middleware/auth.js';
import { validateSchema } from '../middleware/validate.js';
import Joi from 'joi';

const router = express.Router();

const createSchema = Joi.object({ location_id: Joi.number().required(), rating: Joi.number().min(0).max(5).required(), comment: Joi.string().allow('', null) });

router.post('/', authenticateJWT, validateSchema(createSchema), createReview);
router.get('/location/:locationId', listReviewsForLocation);
router.delete('/:id', authenticateJWT, deleteReview);
router.put('/:id', authenticateJWT, validateSchema(createSchema), editReview);

export default router;
