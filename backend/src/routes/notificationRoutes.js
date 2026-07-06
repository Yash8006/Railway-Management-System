import express from 'express';
const router = express.Router();
import Notification from '../models/notificationModel.js';
import { protect } from '../middleware/authMiddleware.js';

/**
 * Educational Context (AGENTS.md Compliance):
 * ==========================================
 * 1. WHAT we are using:
 *    - Express routes to query and update Notification records in MongoDB.
 * 
 * 2. WHY we are using it:
 *    - Allows passengers to query their in-app push alerts history and toggle their read status.
 * 
 * 3. ALTERNATIVES:
 *    - Putting notification endpoints in the booking or user routes.
 * 
 * 4. WHY WE ARE NOT USING ALTERNATIVES:
 *    - Violates route modularity. Notifications represent a distinct domain resource and deserve
 *      an independent controller and router bundle.
 */

// @desc    Get user in-app notifications history
// @route   GET /api/notifications
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    const alerts = await Notification.find({
      user: req.user._id,
      type: 'in_app'
    }).sort({ createdAt: -1 });
    return res.json({ success: true, data: alerts });
  } catch (error) {
    console.error('Fetch notifications error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @desc    Mark a notification as read
// @route   POST /api/notifications/mark-read/:id
// @access  Private
router.post('/mark-read/:id', protect, async (req, res) => {
  try {
    const alert = await Notification.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      { read: true },
      { new: true }
    );
    if (!alert) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }
    return res.json({ success: true, message: 'Notification marked as read', data: alert });
  } catch (error) {
    console.error('Mark read notification error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

export default router;
