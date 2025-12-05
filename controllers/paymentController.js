import { v4 as uuidv4 } from 'uuid';

// Simple in-memory store. In production, replace with a database collection.
const payments = new Map();

// Utility to sanitize and validate minimal payload
function validateCreatePayload(body) {
  const errors = [];
  const { amount, currency, userId, description } = body || {};
  if (amount == null || isNaN(Number(amount)) || Number(amount) <= 0) {
    errors.push('amount must be a positive number');
  }
  if (!currency || typeof currency !== 'string') {
    errors.push('currency is required');
  }
  if (!userId || typeof userId !== 'string') {
    errors.push('userId is required');
  }
  if (description && typeof description !== 'string') {
    errors.push('description must be a string');
  }
  return { valid: errors.length === 0, errors, payload: { amount: Number(amount), currency, userId, description } };
}

// POST /api/payments -> create a payment request
export const createPayment = (req, res) => {
  const { valid, errors, payload } = validateCreatePayload(req.body);
  if (!valid) return res.status(400).json({ success: false, errors });

  const id = uuidv4();
  const record = {
    id,
    status: 'pending', // pending | approved | denied
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...payload,
  };
  payments.set(id, record);

  // Return the payment request so client can poll or show status
  return res.status(201).json({ success: true, data: record });
};

// GET /api/payments/:id -> get payment status
export const getPaymentStatus = (req, res) => {
  const { id } = req.params;
  const record = payments.get(id);
  if (!record) return res.status(404).json({ success: false, message: 'Payment not found' });
  return res.json({ success: true, data: record });
};

// POST /api/payments/:id/approve -> admin confirms payment
export const approvePayment = (req, res) => {
  const { id } = req.params;
  const record = payments.get(id);
  if (!record) return res.status(404).json({ success: false, message: 'Payment not found' });
  if (record.status !== 'pending') {
    return res.status(409).json({ success: false, message: `Payment already ${record.status}` });
  }
  record.status = 'approved';
  record.updatedAt = new Date().toISOString();
  payments.set(id, record);
  return res.json({ success: true, data: record });
};

// POST /api/payments/:id/deny -> admin denies payment
export const denyPayment = (req, res) => {
  const { id } = req.params;
  const record = payments.get(id);
  if (!record) return res.status(404).json({ success: false, message: 'Payment not found' });
  if (record.status !== 'pending') {
    return res.status(409).json({ success: false, message: `Payment already ${record.status}` });
  }
  const { reason } = req.body || {};
  record.status = 'denied';
  record.updatedAt = new Date().toISOString();
  if (reason && typeof reason === 'string') record.reason = reason;
  payments.set(id, record);
  return res.json({ success: true, data: record });
};

// Export a helper to inspect current in-memory store (optional)
export const __paymentsStore = payments;
