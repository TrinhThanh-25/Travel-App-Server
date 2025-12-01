import express from "express";
import { getRewardById, getAllRewards, addReward, redeemReward, getEligibleCatalog, getUserInventory, useUserReward, getUserTransactions, getUserVoucherCode, useUserRewardByCode } from "../controllers/rewardController.js";
import { authenticateJWT } from "../middleware/auth.js";
const router = express.Router();

// Order: static and multi-segment routes first to avoid :id capturing them
router.get("/", getAllRewards);
router.get("/catalog", getEligibleCatalog);
router.get("/user/:userId/transactions", getUserTransactions);
router.get("/user/:userId/voucher/:userRewardId", getUserVoucherCode);
router.get("/:id", getRewardById);
router.post("/", addReward);
router.post("/redeem", redeemReward);
router.post("/use/:userRewardId", authenticateJWT, useUserReward);
router.post("/use-code", authenticateJWT, useUserRewardByCode);
export default router;
