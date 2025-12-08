import express from "express";
import { getRewardById, getAllRewards, addReward, redeemReward, getEligibleCatalog, getUserInventory, addUserReward, deleteUserReward, useUserReward, getUserTransactions, getUserVoucherCode, useUserRewardByCode } from "../controllers/rewardController.js";
import { authenticateJWT } from "../middleware/auth.js";
const router = express.Router();

// Order: static and multi-segment routes first to avoid :id capturing them
router.get("/", getAllRewards);
router.get("/catalog", getEligibleCatalog);
router.get("/user/:userId/transactions", getUserTransactions);
router.get("/user/:userId/voucher/:userRewardId", getUserVoucherCode);
// list all vouchers for a user
router.get("/user/:userId/vouchers", getUserInventory);
router.get("/:id", getRewardById);
router.post("/", addReward);
router.post("/redeem", redeemReward);
// allow redemption by id or code; frontend will supply user_id for verification
router.post("/use/:userRewardId", useUserReward);
router.post("/use-code", useUserRewardByCode);

// admin/system helpers to add/delete a user's voucher
router.post("/user/:userId/voucher", addUserReward);
router.delete("/user/:userId/voucher/:userRewardId", deleteUserReward);
export default router;
