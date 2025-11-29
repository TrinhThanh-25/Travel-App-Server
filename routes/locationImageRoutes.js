import express from 'express';
import { listLocationImages, addLocationImage, updateLocationImage, deleteLocationImage } from '../controllers/locationImageController.js';
import { authenticateJWT } from '../middleware/auth.js';

const router = express.Router({ mergeParams: true });

router.get('/', listLocationImages);
router.post('/', authenticateJWT, addLocationImage);
router.patch('/:imageId', authenticateJWT, updateLocationImage);
router.delete('/:imageId', authenticateJWT, deleteLocationImage);

export default router;
