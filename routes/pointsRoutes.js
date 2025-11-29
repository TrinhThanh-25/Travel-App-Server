import express from 'express';
import { addTransaction, listTransactionsForUser, getMyPoints } from '../controllers/pointsController.js';
import { authenticateJWT } from '../middleware/auth.js';
import Joi from 'joi';
import { validateSchema } from '../middleware/validate.js';

const router = express.Router();

const txSchema = Joi.object({ points: Joi.number().required(), type: Joi.string().required(), description: Joi.string().allow('', null), user_id: Joi.number().optional() });

router.post('/transactions', authenticateJWT, validateSchema(txSchema), addTransaction);
router.get('/transactions', authenticateJWT, listTransactionsForUser);
router.get('/me', authenticateJWT, getMyPoints);

export default router;
