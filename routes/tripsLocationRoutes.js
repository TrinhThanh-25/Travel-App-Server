import express from 'express';
import { listTripLocations } from '../controllers/tripsLocationController.js';

const router = express.Router();

router.get('/', listTripLocations);

export default router;
