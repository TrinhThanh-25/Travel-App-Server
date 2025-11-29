import express from 'express'
import { listShops, getShop } from '../controllers/shopController.js'

const router = express.Router()

router.get('/', listShops)
router.get('/:shopId', getShop)

export default router
