import express from 'express';
const router = express.Router();
import {
  getFareEstimate,
  createCheckoutSession
} from '../controllers/paymentController.js';
import { protect } from '../middleware/authMiddleware.js';

/**
 * Educational Context (AGENTS.md Compliance):
 * - What: Express payment and fare routes mapping.
 * - Why: Segregates pricing evaluation and simulated Stripe/Razorpay checkouts into an isolated module.
 * - Alternatives: Merging pricing checkouts inside the booking routes.
 * - Why not alternatives: Mixing pricing and external checkouts with core database ticket booking
 *   violates SRP and complicates middleware bindings.
 */

router.get('/fare', getFareEstimate);
router.post('/checkout-session', protect, createCheckoutSession);

export default router;
