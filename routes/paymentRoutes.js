import express from 'express';
import * as paymentController from '../controllers/paymentController.js';
const router = express.Router();

// Create a payment request
router.post('/', paymentController.createPayment);

// Get payment status
router.get('/:id', paymentController.getPaymentStatus);

// Approve payment (admin action)
router.post('/:id/approve', paymentController.approvePayment);

// Deny payment (admin action)
router.post('/:id/deny', paymentController.denyPayment);

export default router;
