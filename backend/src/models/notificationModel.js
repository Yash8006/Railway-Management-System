import mongoose from 'mongoose';

/**
 * Educational Context (AGENTS.md Compliance):
 * ==========================================
 * 1. WHAT we are using:
 *    - A central Mongoose schema/model `Notification` storing all notification types.
 * 
 * 2. WHY we are using it:
 *    - Capturing alerts (SMS, emails, in-app notifications) inside a persistent collection allows
 *      passengers to view alert histories on their dashboards and provides auditing trails for alerts.
 * 
 * 3. ALTERNATIVES:
 *    - Directly firing API calls (SMTP, Twilio) without logging them in a database collection.
 * 
 * 4. WHY WE ARE NOT USING ALTERNATIVES:
 *    - Firing and forgetting alerts without a database log makes debugging failing notifications
 *      impossible and prevents in-app alert query lists from functioning.
 */

const notificationSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['sms', 'email', 'in_app'],
    required: true
  },
  category: {
    type: String,
    enum: ['booking', 'waitlist_upgrade', 'delay', 'cancellation', 'upcoming_journey'],
    required: true
  },
  read: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

const Notification = mongoose.model('Notification', notificationSchema);
export default Notification;
