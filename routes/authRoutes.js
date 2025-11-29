import express from 'express';
import { register, login, logout, me, refresh } from '../controllers/authController.js';
import { authenticateJWT } from '../middleware/auth.js';
import rateLimit from 'express-rate-limit';
import { validateSchema } from '../middleware/validate.js';
import { registerSchema, loginSchema } from '../validators/auth.js';

const router = express.Router();

// stricter rate limit for auth endpoints to mitigate brute-force
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false });

router.post('/register', authLimiter, validateSchema(registerSchema), register);
router.post('/login', authLimiter, validateSchema(loginSchema), login);
router.post('/logout', logout);
router.post('/refresh', refresh);
router.get('/me', authenticateJWT, me);

export default router;
