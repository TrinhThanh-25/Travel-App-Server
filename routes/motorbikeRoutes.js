import express from 'express'
import { listMotorbikes, getMotorbike, patchMotorbike } from '../controllers/motorbikeController.js'
import { authenticateJWT } from '../middleware/auth.js'

const router = express.Router()

router.get('/', listMotorbikes)
router.get('/:bikeId', getMotorbike)
router.patch('/:bikeId', authenticateJWT, patchMotorbike)

export default router
