import express from "express";
import { getAllLocations, addLocation, getLocationById, getFavoriteLocations, addFavoriteLocation, removeFavoriteLocation, nearbyLocations } from "../controllers/locationController.js";
import { authenticateJWT } from '../middleware/auth.js';

const router = express.Router();

router.get("/", getAllLocations);
// Nearby search must come before the id param route
router.get('/nearby', nearbyLocations);
router.get("/:id", getLocationById);
router.post("/", addLocation);
// Return authenticated user's favorite locations
router.get("/me/favorites", authenticateJWT, getFavoriteLocations);
router.post("/:id/favorite", authenticateJWT, addFavoriteLocation);
router.delete("/:id/favorite", authenticateJWT, removeFavoriteLocation);

export default router;
