import Notification from '../models/notificationModel.js';
import Booking from '../models/bookingModel.js';
import User from '../models/userModel.js';
import ScheduledRun from '../models/scheduledRunModel.js';

/**
 * Educational Context (AGENTS.md Compliance):
 * ==========================================
 * 1. WHAT we are using:
 *    - Centralized template generator and console-redirected mock alerter.
 *    - Cross-collection querying to broadcast delay notifications to active passengers.
 * 
 * 2. WHY we are using it:
 *    - Consolidating email/SMS/push construction in a single helper service allows the backend
 *      to easily swap a mock-logging system for a real provider (like Nodemailer, Twilio, or Firebase FCM)
 *      in the future by editing only one file.
 * 
 * 3. ALTERNATIVES:
 *    - Hardcoding Twilio/FCM integrations in controllers.
 * 
 * 4. WHY WE ARE NOT USING ALTERNATIVES:
 *    - Scattering alert templates and API client initializations throughout multiple controller files
 *      creates code redundancy and makes the app fragile to package updates or API credential rotations.
 */

// Basic dispatch wrappers that persist log alerts in Mongo
export const sendSMS = async (userId, phone, message, category) => {
  console.log(`[SMS ALERT] [To: ${phone}] [Category: ${category}] -> "${message}"`);
  return await Notification.create({
    user: userId,
    title: 'SMS Alert',
    message,
    type: 'sms',
    category
  });
};

export const sendEmail = async (userId, email, subject, message, category, attachments = []) => {
  const attachmentStr = attachments.length > 0 ? ` (Attached: ${attachments.map(a => a.filename).join(', ')})` : '';
  console.log(`[EMAIL ALERT] [To: ${email}] [Subject: ${subject}]${attachmentStr} -> "${message}"`);
  return await Notification.create({
    user: userId,
    title: subject,
    message,
    type: 'email',
    category
  });
};

export const sendInApp = async (userId, title, message, category) => {
  console.log(`[PUSH IN-APP ALERT] [User: ${userId}] [Category: ${category}] -> ${title}: "${message}"`);
  return await Notification.create({
    user: userId,
    title,
    message,
    type: 'in_app',
    category
  });
};

// @desc    Dispatch booking confirmation alerts (SMS, Email with simulated PDF ticket, In-App push)
export const dispatchBookingNotification = async (booking) => {
  try {
    const user = await User.findById(booking.user);
    if (!user) return;

    const email = user.email;
    const phone = user.phoneNumber || '+919999999999';

    const msg = `Dear Customer, PNR: ${booking.pnr} is booked successfully on Train ${booking.trainNumber} (${booking.trainName}) for journey date ${booking.dateOfJourney.toDateString()}. Status: ${booking.status.toUpperCase()}. Thank you for choosing RMS!`;

    // 1. Send SMS
    await sendSMS(booking.user, phone, msg, 'booking');

    // 2. Send Email with simulated PDF attachment
    const attachments = [{ filename: `Ticket_PNR_${booking.pnr}.pdf`, contentType: 'application/pdf' }];
    await sendEmail(booking.user, email, 'RMS Ticket Booking Confirmation', msg, 'booking', attachments);

    // 3. Send In-App push alert
    await sendInApp(booking.user, 'Booking Confirmed! ✅', `Your ticket PNR ${booking.pnr} has been booked. Check your email for the PDF.`, 'booking');
  } catch (err) {
    console.error('Booking notification error:', err.message);
  }
};

// @desc    Dispatch waitlist queue progression alerts
export const dispatchWaitlistUpgrade = async (booking, oldSeat, newSeat, oldStatus, newStatus) => {
  try {
    const user = await User.findById(booking.user);
    if (!user) return;

    const email = user.email;
    const phone = user.phoneNumber || '+919999999999';

    const msg = `Waitlist Update: Your booking (PNR: ${booking.pnr}) has progressed from ${oldStatus.toUpperCase()} (${oldSeat}) to ${newStatus.toUpperCase()} (${newSeat}).`;

    await sendSMS(booking.user, phone, msg, 'waitlist_upgrade');
    await sendEmail(booking.user, email, 'RMS Waitlist Progression Alert', msg, 'waitlist_upgrade');
    await sendInApp(booking.user, 'Waitlist Upgraded! 📈', `PNR ${booking.pnr} status is now ${newStatus.toUpperCase()}. Assigned seat: ${newSeat}.`, 'waitlist_upgrade');
  } catch (err) {
    console.error('Waitlist upgrade notification error:', err.message);
  }
};

// @desc    Dispatch delay alerts to all active passengers on the scheduled run
export const dispatchDelayAlerts = async (runId, delayMinutes) => {
  try {
    const run = await ScheduledRun.findById(runId).populate({
      path: 'train',
      populate: { path: 'route' }
    });
    if (!run) return;

    // Find active bookings (status: confirmed/rac) for this run
    const bookings = await Booking.find({
      trainNumber: run.train.trainNumber,
      dateOfJourney: run.date,
      status: { $in: ['confirmed', 'rac'] }
    });

    const msg = `Running Status Alert: Train ${run.train.trainNumber} (${run.train.trainName}) is running late by ${delayMinutes} minutes on journey date ${run.date.toDateString()}. We apologize for the delay.`;

    for (const b of bookings) {
      const user = await User.findById(b.user);
      if (user) {
        const phone = user.phoneNumber || '+919999999999';
        await sendSMS(b.user, phone, msg, 'delay');
        await sendEmail(b.user, user.email, 'RMS Train Running Status Update', msg, 'delay');
        await sendInApp(b.user, 'Train Delay Alert ⚠️', `Train ${run.train.trainNumber} is delayed by ${delayMinutes} mins.`, 'delay');
      }
    }
  } catch (err) {
    console.error('Delay notification error:', err.message);
  }
};

// @desc    Dispatch cancellation alerts to all booked passengers on the scheduled run
export const dispatchCancellationAlerts = async (runId) => {
  try {
    const run = await ScheduledRun.findById(runId).populate({
      path: 'train',
      populate: { path: 'route' }
    });
    if (!run) return;

    // Find all bookings for this run
    const bookings = await Booking.find({
      trainNumber: run.train.trainNumber,
      dateOfJourney: run.date,
      status: { $ne: 'cancelled' }
    });

    for (const b of bookings) {
      const user = await User.findById(b.user);
      if (user) {
        const msg = `URGENT ALERT: Train ${run.train.trainNumber} (${run.train.trainName}) scheduled for journey on ${run.date.toDateString()} has been CANCELLED due to weather/maintenance. A full refund of INR ${b.fare} has been credited to your RMS Wallet.`;
        const phone = user.phoneNumber || '+919999999999';
        await sendSMS(b.user, phone, msg, 'cancellation');
        await sendEmail(b.user, user.email, 'URGENT: RMS Train Cancellation Alert', msg, 'cancellation');
        await sendInApp(b.user, 'Train Cancelled 🚨', `Train ${run.train.trainNumber} scheduled for today has been cancelled. Full refund issued.`, 'cancellation');
      }
    }
  } catch (err) {
    console.error('Cancellation notification error:', err.message);
  }
};

// @desc    Remind passengers of upcoming journeys within the next 24 hours
export const dispatchUpcomingJourneyAlerts = async () => {
  try {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0,0,0,0);

    const bookings = await Booking.find({
      dateOfJourney: tomorrow,
      status: { $in: ['confirmed', 'rac'] }
    });

    for (const b of bookings) {
      const user = await User.findById(b.user);
      if (user) {
        const msg = `Journey Reminder: Your journey on Train ${b.trainNumber} (${b.trainName}) departures tomorrow. PNR: ${b.pnr}. Have a safe journey!`;
        const phone = user.phoneNumber || '+919999999999';
        await sendSMS(b.user, phone, msg, 'upcoming_journey');
        await sendInApp(b.user, 'Upcoming Journey Tomorrow 🎫', `Ticket PNR ${b.pnr} for tomorrow's journey is ready.`, 'upcoming_journey');
      }
    }
  } catch (err) {
    console.error('Upcoming journey notification error:', err.message);
  }
};
