import Station from '../models/stationModel.js';
import Train from '../models/trainModel.js';
import ScheduledRun from '../models/scheduledRunModel.js';

/**
 * Educational Context (AGENTS.md Compliance):
 * ==========================================
 * 1. WHAT we are using:
 *    - Server-side dynamically computed, occupancy-rate-aware fare calculation engine.
 *    - Stripe / Razorpay simulated checkout session generation.
 * 
 * 2. WHY we are using it:
 *    - Placing fare calculation logic strictly on the backend prevents passengers from modifying
 *      the ticket price parameter locally on the client before booking.
 *    - Mocking Stripe and Razorpay checkouts gives a realistic payment flow without requiring
 *      complex SDK installations or live API tokens in development.
 * 
 * 3. ALTERNATIVES:
 *    - Client-side calculated fare passed in request bodies.
 *    - Integrating live, production Stripe checkout libraries.
 * 
 * 4. WHY WE ARE NOT USING ALTERNATIVES:
 *    - Trusting the client with price calculations leads to critical security vulnerabilities (price tampering).
 *    - Live libraries require real developer credentials, webhook configurations, and internet access,
 *      which is excessive for a local verification suite.
 */

// Helper to check segment vacancy for occupancy rates
const isSeatAvailableForSegment = (seat, qStart, qEnd) => {
  return seat.bookedSegments.every(seg => {
    return Math.max(qStart, seg.fromIndex) >= Math.min(qEnd, seg.toIndex);
  });
};

// Core Helper: Computes the itemized ticket fare dynamically
export const calculateFareHelper = (run, fromIndex, toIndex, classType, quota) => {
  const train = run.train;
  const stops = train.route.stops;
  const sortedStops = [...stops].sort((a, b) => a.stopOrder - b.stopOrder);

  const sourceStop = sortedStops[fromIndex];
  const destStop = sortedStops[toIndex];
  const distance = destStop.distanceFromSource - sourceStop.distanceFromSource;

  // 1. Base Fare + Distance-based charge
  const baseFare = 150;
  const distanceRate = 1.25;
  const distanceCharge = distance * distanceRate;

  // 2. Class Surcharge
  let classMultiplier = 1.0;
  if (classType === 'AC 3 Tier') classMultiplier = 2.2;
  else if (classType === 'AC 2 Tier') classMultiplier = 3.2;
  else if (classType === 'First Class') classMultiplier = 4.5;

  // 3. Quota Surcharge (Tatkal TQ has +30% premium)
  let quotaMultiplier = 1.0;
  if (quota === 'TQ') quotaMultiplier = 1.30;

  // 4. Dynamic Occupancy Pricing Surcharge
  // Count seats of this class type
  const classSeats = run.seats.filter(s => s.classType === classType);
  const bookedCount = classSeats.filter(s => !isSeatAvailableForSegment(s, fromIndex, toIndex)).length;
  const occupancyRate = classSeats.length > 0 ? (bookedCount / classSeats.length) : 0;

  let dynamicMultiplier = 1.0;
  if (occupancyRate >= 0.90) dynamicMultiplier = 1.35; // 90%+ occupancy
  else if (occupancyRate >= 0.70) dynamicMultiplier = 1.20; // 70-90% occupancy
  else if (occupancyRate >= 0.50) dynamicMultiplier = 1.10; // 50-70% occupancy

  const rawFare = (baseFare + distanceCharge) * classMultiplier * quotaMultiplier * dynamicMultiplier;
  const finalFare = Math.round(rawFare);

  return {
    baseFare,
    distanceKm: distance,
    distanceCharge: Math.round(distanceCharge),
    classType,
    classMultiplier,
    quota,
    quotaMultiplier,
    occupancyRate,
    dynamicPricingMultiplier: dynamicMultiplier,
    totalFare: finalFare
  };
};

// Helper to parse local midnight dates
const parseLocalDate = (dateStr) => {
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  d.setHours(0,0,0,0);
  return d;
};

// @desc    Get public dynamic ticket fare estimate
// @route   GET /api/payment/fare
// @access  Public
export const getFareEstimate = async (req, res) => {
  try {
    const { trainNumber, date, from, to, classType, quota } = req.query;

    if (!trainNumber || !date || !from || !to || !classType) {
      return res.status(400).json({ success: false, message: 'Please provide trainNumber, date, from, to, and classType' });
    }

    const train = await Train.findOne({ trainNumber }).populate('route');
    if (!train) {
      return res.status(404).json({ success: false, message: `Train number ${trainNumber} not found` });
    }

    const targetDate = parseLocalDate(date);
    const run = await ScheduledRun.findOne({ train: train._id, date: targetDate }).populate({
      path: 'train',
      populate: { path: 'route' }
    });

    if (!run) {
      return res.status(404).json({ success: false, message: `No scheduled run found for Train ${trainNumber} on ${date}` });
    }

    const sourceSt = await Station.findOne({ code: from.toUpperCase() });
    const destSt = await Station.findOne({ code: to.toUpperCase() });

    if (!sourceSt || !destSt) {
      return res.status(404).json({ success: false, message: 'Source or destination station not found' });
    }

    const fromIndex = run.routeStops.findIndex(id => id.toString() === sourceSt._id.toString());
    const toIndex = run.routeStops.findIndex(id => id.toString() === destSt._id.toString());

    if (fromIndex === -1 || toIndex === -1 || fromIndex >= toIndex) {
      return res.status(400).json({ success: false, message: 'Invalid segment stops order for this train run' });
    }

    const fareInfo = calculateFareHelper(run, fromIndex, toIndex, classType, quota || 'GN');
    return res.json({ success: true, data: fareInfo });
  } catch (error) {
    console.error('Get fare estimate error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Create a simulated payment checkout session (UPI, Card, Netbanking)
// @route   POST /api/payment/checkout-session
// @access  Private
export const createCheckoutSession = async (req, res) => {
  try {
    const { trainNumber, date, from, to, classType, quota, passengers, paymentMethod } = req.body;

    if (!trainNumber || !date || !from || !to || !classType || !passengers || !paymentMethod) {
      return res.status(400).json({ success: false, message: 'Provide all checkout parameters' });
    }

    const train = await Train.findOne({ trainNumber }).populate('route');
    if (!train) {
      return res.status(404).json({ success: false, message: `Train number ${trainNumber} not found` });
    }

    const targetDate = parseLocalDate(date);
    const run = await ScheduledRun.findOne({ train: train._id, date: targetDate }).populate({
      path: 'train',
      populate: { path: 'route' }
    });

    if (!run) {
      return res.status(404).json({ success: false, message: 'Scheduled run not found' });
    }

    const sourceSt = await Station.findOne({ code: from.toUpperCase() });
    const destSt = await Station.findOne({ code: to.toUpperCase() });

    const fromIndex = run.routeStops.findIndex(id => id.toString() === sourceSt._id.toString());
    const toIndex = run.routeStops.findIndex(id => id.toString() === destSt._id.toString());

    const itemized = calculateFareHelper(run, fromIndex, toIndex, classType, quota || 'GN');
    const finalPrice = itemized.totalFare * passengers.length;

    // Generate mock external payment sessions
    const transactionId = 'txn_' + Math.random().toString(36).substr(2, 9).toUpperCase();
    const stripeSessionId = 'cs_test_' + Math.random().toString(36).substr(2, 9);
    const razorpayOrderId = 'order_test_' + Math.random().toString(36).substr(2, 9);

    return res.json({
      success: true,
      message: 'Simulated payment checkout session created successfully.',
      data: {
        paymentMethod,
        ticketPrice: itemized.totalFare,
        passengersCount: passengers.length,
        totalFare: finalPrice,
        transactionId,
        providerDetails: paymentMethod === 'card' ? {
          provider: 'Stripe',
          stripeSessionId
        } : {
          provider: 'Razorpay',
          razorpayOrderId
        }
      }
    });
  } catch (error) {
    console.error('Create checkout session error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};
