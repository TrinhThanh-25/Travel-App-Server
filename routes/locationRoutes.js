import express from "express";
import { getAllLocations, addLocation, getLocationById, getFavoriteLocations, addFavoriteLocation, removeFavoriteLocation, nearbyLocations } from "../controllers/locationController.js";
import { authenticateJWT } from '../middleware/auth.js';

const router = express.Router();

// Collection + special endpoints first
router.get("/", getAllLocations);
router.get("/nearby", nearbyLocations);
// Authenticated favorites endpoints (user-scoped)
router.get("/me/favorites", authenticateJWT, getFavoriteLocations);
router.post("/:id/favorite", authenticateJWT, addFavoriteLocation);
router.delete("/:id/favorite", authenticateJWT, removeFavoriteLocation);
// Single-location resource by id last
router.get("/:id", getLocationById);
router.post("/", addLocation);

export default router;
