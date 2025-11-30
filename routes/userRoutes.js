import express from "express";
import * as userCtrl from "../controllers/userController.js";
import { validateSchema } from '../middleware/validate.js';
import { addUserSchema, updateUserProfileSchema, updatePasswordSchema, checkInSchema, completeChallengeSchema, avatarSchema } from '../validators/user.js';
import { authenticateJWT } from '../middleware/auth.js';

const router = express.Router();

function handlerOrNotImplemented(name) {
	const fn = userCtrl[name];
	if (typeof fn === 'function') return fn;
	return (req, res) => res.status(501).json({ error: `Handler not implemented: ${name}` });
}

// public list / create users
router.get("/", handlerOrNotImplemented('getAllUsers'));
router.post("/", validateSchema(addUserSchema), handlerOrNotImplemented('addUser'));

// challenge completion
router.post("/complete", validateSchema(completeChallengeSchema), handlerOrNotImplemented('completeChallenge'));

// user profile endpoints (use :id until auth is implemented)
// Use authenticated "me" endpoints instead of path-based user ids
router.get("/me", authenticateJWT, handlerOrNotImplemented('getUserProfile'));
router.get("/:id", handlerOrNotImplemented('getUserProfileById'));
// PATCH /me for safe, partial profile updates
router.patch("/me", authenticateJWT, validateSchema(updateUserProfileSchema), handlerOrNotImplemented('updateUserProfile'));
router.post("/me/avatar", authenticateJWT, validateSchema(avatarSchema), handlerOrNotImplemented('updateUserAvatar'));
router.get("/me/avatar", authenticateJWT, handlerOrNotImplemented('getUserAvatar'));
router.post("/me/password", authenticateJWT, validateSchema(updatePasswordSchema), handlerOrNotImplemented('updateUserPassword'));
router.get("/me/vouchers", authenticateJWT, handlerOrNotImplemented('getUserVouchers'));
router.get("/me/locations", authenticateJWT, handlerOrNotImplemented('getCheckedInLocation'));
router.post("/me/locations", authenticateJWT, validateSchema(checkInSchema), handlerOrNotImplemented('checkInLocation'));
router.get("/me/challenges", authenticateJWT, handlerOrNotImplemented('getUserChallenges'));
router.get("/me/point", authenticateJWT, handlerOrNotImplemented('getUserPoints'));
router.get("/me/point/transactions", authenticateJWT, handlerOrNotImplemented('getUserPointTransactions'));
router.post("/me/point/transactions", authenticateJWT, handlerOrNotImplemented('addUserPointTransaction'));

export default router;
