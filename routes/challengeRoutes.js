import express from "express";
import * as challengeCtrl from "../controllers/challengeController.js";

const router = express.Router();

function handlerOrNotImplemented(name) {
	const fn = challengeCtrl[name];
	if (typeof fn === 'function') return fn;
	return (req, res) => res.status(501).json({ error: `Handler not implemented: ${name}` });
}

router.get("/", handlerOrNotImplemented('getAllChallenges'));
router.post("/", handlerOrNotImplemented('addChallenge'));
router.get("/:id", handlerOrNotImplemented('getChallengeById'));
router.post("/:id/join", handlerOrNotImplemented('joinChallenge'));
router.post("/:id/complete", handlerOrNotImplemented('completeChallenge'));
router.post("/:id/progress", handlerOrNotImplemented('updateChallengeProgress'));
router.get("/:id/progress", handlerOrNotImplemented('getChallengeProgress'));
router.post("/:id/progress/manual", handlerOrNotImplemented('setManualProgress'));
router.post("/:id/activity", handlerOrNotImplemented('logChallengeActivity'));
router.get("/user/:userId", handlerOrNotImplemented('listUserChallenges'));
router.get("/:id/locations", handlerOrNotImplemented('getChallengeLocations'));
router.get("/:id/rewards", handlerOrNotImplemented('getChallengeRewards'));

export default router;
