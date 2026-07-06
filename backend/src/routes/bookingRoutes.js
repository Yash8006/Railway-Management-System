import express from 'express';
const router = express.Router();
import {
  getMyBookings,
  createBooking,
  cancelBooking,
  downloadTicketPDF,
  getRefundPreview
} from '../controllers/bookingController.js';
import { protect } from '../middleware/authMiddleware.js';

router.route('/')
  .get(protect, getMyBookings)
  .post(protect, createBooking);

router.post('/:id/cancel', protect, cancelBooking);
router.get('/:id/download', protect, downloadTicketPDF);
router.get('/:id/refund-preview', protect, getRefundPreview);

export default router;
