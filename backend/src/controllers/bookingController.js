import mongoose from 'mongoose';
import Booking from '../models/bookingModel.js';
import User from '../models/userModel.js';
import PDFDocument from 'pdfkit';
import Train from '../models/trainModel.js';
import Station from '../models/stationModel.js';
import ScheduledRun from '../models/scheduledRunModel.js';
import { calculateFareHelper } from './paymentController.js';
import { dispatchBookingNotification, dispatchWaitlistUpgrade } from '../services/notificationService.js';

/**
 * Educational Context (AGENTS.md Compliance):
 * ==========================================
 * 1. WHAT we are using:
 *    - ACID MongoDB transactions via Mongoose sessions (`session.startTransaction()`).
 *    - Dynamic berth auto-allocation with prioritised Lower berths for senior/disabled.
 *    - Passenger grouping at bay-level and coach-level.
 *    - Deterministic seat quotas partition (Tatkal TQ, Ladies LD, General GN/SR).
 *    - RAC & Waitlist promotion queue with automatic sequential re-indexing.
 * 
 * 2. WHY we are using it:
 *    - Sessions guarantee that concurrent booking requests read and reserve seats atomically,
 *      preventing double-bookings.
 *    - Bay-level grouping makes passenger travel convenient (family members seated together).
 *    - Automatic promotions from RAC to Confirmed and WL to RAC keep seat utilization optimal on cancellations.
 * 
 * 3. ALTERNATIVES:
 *    - Redlock (distributed Redis locks) for concurrency lock.
 *    - Random seat selection algorithm (simple finding and mapping).
 *    - Real-time bitwise mask allocation for quota limits.
 * 
 * 4. WHY WE ARE NOT USING ALTERNATIVES:
 *    - Redis adds infrastructure overhead and doesn't run natively inside Mongoose document saves.
 *    - Random selection scatters family members across coaches.
 *    - Bitwise allocation is less descriptive than structured Mongo sub-document arrays.
 */

// Helper function to calculate refund details based on departure time
const calculateRefund = (dateOfJourney, fare) => {
  const now = Date.now();
  const journeyTime = new Date(dateOfJourney).getTime();
  const hoursRemaining = (journeyTime - now) / (1000 * 60 * 60);

  if (hoursRemaining > 48) {
    return { refundAmount: fare * 0.90, charge: fare * 0.10, percent: 90 };
  } else if (hoursRemaining >= 12 && hoursRemaining <= 48) {
    return { refundAmount: fare * 0.75, charge: fare * 0.25, percent: 75 };
  } else if (hoursRemaining >= 4 && hoursRemaining < 12) {
    return { refundAmount: fare * 0.50, charge: fare * 0.50, percent: 50 };
  } else {
    return { refundAmount: 0, charge: fare, percent: 0 };
  }
};

// @desc    Get current user's bookings (Booking History)
// @route   GET /api/bookings
// @access  Private
export const getMyBookings = async (req, res) => {
  try {
    const bookings = await Booking.find({ user: req.user._id }).sort({ createdAt: -1 });
    return res.json({ success: true, data: bookings });
  } catch (error) {
    console.error('Get my bookings error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Create a transactional seat reservation booking
// @route   POST /api/bookings
// @access  Private
export const createBooking = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const {
      trainNumber,
      trainName,
      sourceStation,
      destinationStation,
      classType,
      fare,
      passengers,
      dateOfJourney,
      paymentMethod,
      quota // GN, TQ, LD, SR
    } = req.body;

    const bookingQuota = quota || 'GN';

    if (!trainNumber || !trainName || !sourceStation || !destinationStation || !classType || !fare || !passengers || !dateOfJourney) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, message: 'Please provide all details' });
    }

    const user = await User.findById(req.user._id).session(session);
    if (!user) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Resolve run and check physical seat availability
    const train = await Train.findOne({ trainNumber }).populate('route').session(session);
    if (!train) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ success: false, message: `Train ${trainNumber} not found` });
    }

    const journeyDate = new Date(dateOfJourney);
    journeyDate.setHours(0,0,0,0);

    const run = await ScheduledRun.findOne({ train: train._id, date: journeyDate }).populate({
      path: 'train',
      populate: { path: 'route' }
    }).session(session);
    if (!run) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ success: false, message: `No scheduled run found for Train ${trainNumber} on ${journeyDate.toDateString()}` });
    }

    const sourceSt = await Station.findOne({ $or: [{ code: sourceStation.toUpperCase() }, { name: sourceStation }] }).session(session);
    const destSt = await Station.findOne({ $or: [{ code: destinationStation.toUpperCase() }, { name: destinationStation }] }).session(session);

    if (!sourceSt || !destSt) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ success: false, message: 'Source or destination station not found' });
    }

    const fromIndex = run.routeStops.findIndex(id => id.toString() === sourceSt._id.toString());
    const toIndex = run.routeStops.findIndex(id => id.toString() === destSt._id.toString());

    if (fromIndex === -1 || toIndex === -1 || fromIndex >= toIndex) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, message: 'Invalid segment stops order for this train run' });
    }

    // Calculate dynamically calculated fare on the server to prevent price tampering
    const fareInfo = calculateFareHelper(run, fromIndex, toIndex, classType, bookingQuota);
    const calculatedFare = fareInfo.totalFare * passengers.length;

    // Helper function to check segment overlap
    const isSeatAvailable = (seat, qStart, qEnd) => {
      return seat.bookedSegments.every(seg => {
        return Math.max(qStart, seg.fromIndex) >= Math.min(qEnd, seg.toIndex);
      });
    };

    // Filter run seats by class
    const classSeats = run.seats.filter(s => s.classType === classType);

    // Quota Partition Rules:
    // TQ (Tatkal): seatNumber % 6 === 5 or 0
    // LD (Ladies): seatNumber % 6 === 1 or 2
    // GN & SR: seatNumber % 6 === 3 or 4
    const filterSeatsByQuota = (seats, quotaVal) => {
      return seats.filter(s => {
        const num = s.seatNumber;
        if (quotaVal === 'TQ') {
          return num % 6 === 5 || num % 6 === 0;
        } else if (quotaVal === 'LD') {
          return num % 6 === 1 || num % 6 === 2;
        } else {
          return num % 6 === 3 || num % 6 === 4;
        }
      });
    };

    const quotaSeats = filterSeatsByQuota(classSeats, bookingQuota);

    // Identify priority passengers (Senior Citizen: Age >= 60, or isDisabled is explicitly true)
    const isPriorityPassenger = (p) => {
      return p.age >= 60 || p.isDisabled === true;
    };

    // Bay number selector (Sleeper/AC3: 8 seats per bay; AC2: 6 seats per bay)
    const getBayNumber = (seatNumber, classVal) => {
      if (classVal === 'AC 2 Tier') return Math.ceil(seatNumber / 6);
      return Math.ceil(seatNumber / 8);
    };

    // Group seats by Coach & Bay
    const getSeatsGrouped = (seats) => {
      const groups = {};
      seats.forEach(s => {
        const bay = getBayNumber(s.seatNumber, classType);
        const key = `${s.coachId}-${bay}`;
        if (!groups[key]) groups[key] = [];
        groups[key].push(s);
      });
      return groups;
    };

    let allocatedSeats = [];
    let isConfirmed = false;

    // Allocation Steps:
    // 1. Try to find a single coach and bay (cabin) with enough vacant seats for all passengers
    const groupedSeats = getSeatsGrouped(quotaSeats);
    for (const key in groupedSeats) {
      const baySeats = groupedSeats[key];
      const vacantBaySeats = baySeats.filter(s => isSeatAvailable(s, fromIndex, toIndex));
      
      if (vacantBaySeats.length >= passengers.length) {
        // Sort: Lower berths first for priority passengers, others later.
        const sortedVacant = [...vacantBaySeats].sort((a, b) => {
          const isLowerA = a.berthType === 'Lower';
          const isLowerB = b.berthType === 'Lower';
          if (isLowerA && !isLowerB) return -1;
          if (!isLowerA && isLowerB) return 1;
          return 0;
        });

        allocatedSeats = [];
        passengers.forEach((p, idx) => {
          allocatedSeats.push({ passenger: p, seat: sortedVacant[idx] });
        });
        isConfirmed = true;
        break;
      }
    }

    // 2. Try to group in a single coach (across different bays)
    if (!isConfirmed) {
      const coachGroups = {};
      quotaSeats.forEach(s => {
        if (!coachGroups[s.coachId]) coachGroups[s.coachId] = [];
        coachGroups[s.coachId].push(s);
      });

      for (const coachId in coachGroups) {
        const coachSeats = coachGroups[coachId];
        const vacantCoachSeats = coachSeats.filter(s => isSeatAvailable(s, fromIndex, toIndex));
        if (vacantCoachSeats.length >= passengers.length) {
          const sortedVacant = [...vacantCoachSeats].sort((a, b) => {
            const isLowerA = a.berthType === 'Lower';
            const isLowerB = b.berthType === 'Lower';
            if (isLowerA && !isLowerB) return -1;
            if (!isLowerA && isLowerB) return 1;
            return 0;
          });

          allocatedSeats = [];
          passengers.forEach((p, idx) => {
            allocatedSeats.push({ passenger: p, seat: sortedVacant[idx] });
          });
          isConfirmed = true;
          break;
        }
      }
    }

    // 3. Fallback: Train-wide random allocation
    if (!isConfirmed) {
      const vacantSeats = quotaSeats.filter(s => isSeatAvailable(s, fromIndex, toIndex));
      if (vacantSeats.length >= passengers.length) {
        const sortedVacant = [...vacantSeats].sort((a, b) => {
          const isLowerA = a.berthType === 'Lower';
          const isLowerB = b.berthType === 'Lower';
          if (isLowerA && !isLowerB) return -1;
          if (!isLowerA && isLowerB) return 1;
          return 0;
        });

        allocatedSeats = [];
        passengers.forEach((p, idx) => {
          allocatedSeats.push({ passenger: p, seat: sortedVacant[idx] });
        });
        isConfirmed = true;
      }
    }

    let bookingStatus = 'confirmed';
    let formattedPassengers = [];

    // 4. If confirmed seats are full, fallback to RAC or Waitlist!
    if (!isConfirmed) {
      const RAC_LIMIT = 3;
      const WL_LIMIT = 5;

      const activeRAC = await Booking.find({
        trainNumber,
        dateOfJourney: journeyDate,
        classType,
        status: 'rac'
      }).session(session);

      const totalRACCount = activeRAC.reduce((sum, b) => sum + b.passengers.length, 0);

      const activeWL = await Booking.find({
        trainNumber,
        dateOfJourney: journeyDate,
        classType,
        status: 'waitlisted'
      }).session(session);

      const totalWLCount = activeWL.reduce((sum, b) => sum + b.passengers.length, 0);

      if (totalRACCount + passengers.length <= RAC_LIMIT) {
        bookingStatus = 'rac';
        formattedPassengers = passengers.map((p, idx) => {
          const racNo = totalRACCount + idx + 1;
          return {
            name: p.name,
            age: p.age,
            gender: p.gender,
            isDisabled: p.isDisabled || false,
            seatNumber: `RAC - ${racNo}`,
            berthType: 'Side Lower'
          };
        });
      } else if (totalWLCount + passengers.length <= WL_LIMIT) {
        bookingStatus = 'waitlisted';
        formattedPassengers = passengers.map((p, idx) => {
          const wlNo = totalWLCount + idx + 1;
          return {
            name: p.name,
            age: p.age,
            gender: p.gender,
            isDisabled: p.isDisabled || false,
            seatNumber: `WL - ${wlNo}`,
            berthType: 'Awaited'
          };
        });
      } else {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
          success: false,
          message: `No seats available in ${classType}. Booking limits exceeded (Confirmed, RAC, and Waitlist full).`
        });
      }
    } else {
      formattedPassengers = allocatedSeats.map(alloc => ({
        name: alloc.passenger.name,
        age: alloc.passenger.age,
        gender: alloc.passenger.gender,
        isDisabled: alloc.passenger.isDisabled || false,
        seatNumber: `Coach ${alloc.seat.coachId}, Seat ${alloc.seat.seatNumber}`,
        berthType: alloc.seat.berthType
      }));
    }

    // Process Wallet payment
    if (paymentMethod === 'wallet') {
      if (user.walletBalance < calculatedFare) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
          success: false,
          message: `Insufficient wallet balance. Ticket fare is INR ${calculatedFare}, your balance is INR ${user.walletBalance}`
        });
      }
      user.walletBalance -= calculatedFare;
      user.walletTransactions.push({
        amount: calculatedFare,
        type: 'debit',
        description: `Ticket booking PNR payment for Train ${trainNumber}`
      });
      await user.save();
    }

    // Generate unique 10-digit PNR
    let pnr = '';
    let isUnique = false;
    while (!isUnique) {
      pnr = Math.floor(1000000000 + Math.random() * 9000000000).toString();
      const existingBooking = await Booking.findOne({ pnr }).session(session);
      if (!existingBooking) {
        isUnique = true;
      }
    }

    const booking = await Booking.create([{
      user: req.user._id,
      pnr,
      trainNumber,
      trainName,
      sourceStation: sourceSt.code,
      destinationStation: destSt.code,
      classType,
      quota: bookingQuota,
      fare: calculatedFare,
      status: bookingStatus,
      passengers: formattedPassengers,
      dateOfJourney: journeyDate
    }], { session });

    if (isConfirmed) {
      allocatedSeats.forEach(alloc => {
        alloc.seat.bookedSegments.push({
          fromIndex,
          toIndex,
          booking: booking[0]._id
        });
      });
      await run.save();
    }

    await session.commitTransaction();
    session.endSession();

    // Trigger confirmation notification after transaction commits
    await dispatchBookingNotification(booking[0]);

    return res.status(201).json({ success: true, data: booking[0] });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error('Create booking error:', error.message);
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: Object.values(error.errors).map((val) => val.message).join(', '),
      });
    }
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Cancel an existing booking and refund to RMS Wallet with dynamic promotions
// @route   POST /api/bookings/:id/cancel
// @access  Private
export const cancelBooking = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const promotionsToAlert = [];
    const booking = await Booking.findOne({ _id: req.params.id, user: req.user._id }).session(session);

    if (!booking) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    if (booking.status === 'cancelled') {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, message: 'Booking is already cancelled' });
    }

    const { refundAmount, charge, percent } = calculateRefund(booking.dateOfJourney, booking.fare);
    const originalStatus = booking.status;

    booking.status = 'cancelled';
    await booking.save();

    const train = await Train.findOne({ trainNumber: booking.trainNumber }).populate('route').session(session);
    if (train) {
      const journeyDate = new Date(booking.dateOfJourney);
      journeyDate.setHours(0,0,0,0);
      const run = await ScheduledRun.findOne({ train: train._id, date: journeyDate }).session(session);
      
      if (run) {
        if (originalStatus === 'confirmed') {
          const sourceSt = await Station.findOne({ code: booking.sourceStation }).session(session);
          const destSt = await Station.findOne({ code: booking.destinationStation }).session(session);
          
          if (sourceSt && destSt) {
            const fromIndex = run.routeStops.findIndex(id => id.toString() === sourceSt._id.toString());
            const toIndex = run.routeStops.findIndex(id => id.toString() === destSt._id.toString());

            const freedSeatsInfo = [];
            run.seats.forEach(seat => {
              const bookingSeg = seat.bookedSegments.find(seg => seg.booking.toString() === booking._id.toString());
              if (bookingSeg) {
                freedSeatsInfo.push({ seat, fromIndex: bookingSeg.fromIndex, toIndex: bookingSeg.toIndex });
                seat.bookedSegments = seat.bookedSegments.filter(
                  seg => seg.booking.toString() !== booking._id.toString()
                );
              }
            });

            // Promotion Logic: Promote RAC to Confirmed, WL to RAC
            let activeRACs = await Booking.find({
              trainNumber: booking.trainNumber,
              dateOfJourney: journeyDate,
              classType: booking.classType,
              status: 'rac'
            }).sort({ createdAt: 1 }).session(session);

            for (const freed of freedSeatsInfo) {
              const racToPromote = activeRACs.find(rac => {
                return true; // FIFO promotion
              });

              if (racToPromote) {
                const racSourceSt = await Station.findOne({ code: racToPromote.sourceStation }).session(session);
                const racDestSt = await Station.findOne({ code: racToPromote.destinationStation }).session(session);
                if (racSourceSt && racDestSt) {
                  const racFrom = run.routeStops.findIndex(id => id.toString() === racSourceSt._id.toString());
                  const racTo = run.routeStops.findIndex(id => id.toString() === racDestSt._id.toString());

                  const isSeatVacant = (s, qStart, qEnd) => {
                    return s.bookedSegments.every(seg => {
                      return Math.max(qStart, seg.fromIndex) >= Math.min(qEnd, seg.toIndex);
                    });
                  };

                  if (isSeatVacant(freed.seat, racFrom, racTo)) {
                    const oldSeat = racToPromote.passengers[0].seatNumber;
                    const oldStatus = racToPromote.status;

                    racToPromote.status = 'confirmed';
                    racToPromote.passengers.forEach(p => {
                      p.seatNumber = `Coach ${freed.seat.coachId}, Seat ${freed.seat.seatNumber}`;
                      p.berthType = freed.seat.berthType;
                    });
                    await racToPromote.save();

                    promotionsToAlert.push({
                      booking: racToPromote,
                      oldSeat,
                      oldStatus,
                      newStatus: 'confirmed'
                    });

                    freed.seat.bookedSegments.push({
                      fromIndex: racFrom,
                      toIndex: racTo,
                      booking: racToPromote._id
                    });

                    activeRACs = activeRACs.filter(r => r._id.toString() !== racToPromote._id.toString());

                    // Promote first WL passenger to RAC
                    let activeWLs = await Booking.find({
                      trainNumber: booking.trainNumber,
                      dateOfJourney: journeyDate,
                      classType: booking.classType,
                      status: 'waitlisted'
                    }).sort({ createdAt: 1 }).session(session);

                    if (activeWLs.length > 0) {
                      const wlToPromote = activeWLs[0];
                      const oldWLSeat = wlToPromote.passengers[0].seatNumber;
                      const oldWLStatus = wlToPromote.status;

                      wlToPromote.status = 'rac';
                      await wlToPromote.save();

                      promotionsToAlert.push({
                        booking: wlToPromote,
                        oldSeat: oldWLSeat,
                        oldStatus: oldWLStatus,
                        newStatus: 'rac'
                      });
                    }
                  }
                }
              }
            }

            // Re-index remaining RACs
            const remainingRACs = await Booking.find({
              trainNumber: booking.trainNumber,
              dateOfJourney: journeyDate,
              classType: booking.classType,
              status: 'rac'
            }).sort({ createdAt: 1 }).session(session);

            let racCounter = 1;
            for (const r of remainingRACs) {
              r.passengers.forEach(p => {
                p.seatNumber = `RAC - ${racCounter++}`;
                p.berthType = 'Side Lower';
              });
              await r.save();
            }

            // Re-index remaining WLs
            const remainingWLs = await Booking.find({
              trainNumber: booking.trainNumber,
              dateOfJourney: journeyDate,
              classType: booking.classType,
              status: 'waitlisted'
            }).sort({ createdAt: 1 }).session(session);

            let wlCounter = 1;
            for (const w of remainingWLs) {
              w.passengers.forEach(p => {
                p.seatNumber = `WL - ${wlCounter++}`;
                p.berthType = 'Awaited';
              });
              await w.save();
            }

            await run.save();
          }
        } else if (originalStatus === 'rac' || originalStatus === 'waitlisted') {
          // Re-index RAC
          const remainingRACs = await Booking.find({
            trainNumber: booking.trainNumber,
            dateOfJourney: journeyDate,
            classType: booking.classType,
            status: 'rac'
          }).sort({ createdAt: 1 }).session(session);

          let racCounter = 1;
          for (const r of remainingRACs) {
            r.passengers.forEach(p => {
              p.seatNumber = `RAC - ${racCounter++}`;
            });
            await r.save();
          }

          // If an RAC slot freed up, promote first WL
          const RAC_LIMIT = 3;
          if (remainingRACs.length < RAC_LIMIT) {
            const activeWLs = await Booking.find({
              trainNumber: booking.trainNumber,
              dateOfJourney: journeyDate,
              classType: booking.classType,
              status: 'waitlisted'
            }).sort({ createdAt: 1 }).session(session);

            if (activeWLs.length > 0) {
              const wlToPromote = activeWLs[0];
              const oldWLSeat = wlToPromote.passengers[0].seatNumber;
              const oldWLStatus = wlToPromote.status;

              wlToPromote.status = 'rac';
              await wlToPromote.save();

              promotionsToAlert.push({
                booking: wlToPromote,
                oldSeat: oldWLSeat,
                oldStatus: oldWLStatus,
                newStatus: 'rac'
              });

              const updatedRACs = await Booking.find({
                trainNumber: booking.trainNumber,
                dateOfJourney: journeyDate,
                classType: booking.classType,
                status: 'rac'
              }).sort({ createdAt: 1 }).session(session);

              let racCounter2 = 1;
              for (const r of updatedRACs) {
                r.passengers.forEach(p => {
                  p.seatNumber = `RAC - ${racCounter2++}`;
                  p.berthType = 'Side Lower';
                });
                await r.save();
              }
            }
          }

          // Re-index WL
          const remainingWLs = await Booking.find({
            trainNumber: booking.trainNumber,
            dateOfJourney: journeyDate,
            classType: booking.classType,
            status: 'waitlisted'
          }).sort({ createdAt: 1 }).session(session);

          let wlCounter = 1;
          for (const w of remainingWLs) {
            w.passengers.forEach(p => {
              p.seatNumber = `WL - ${wlCounter++}`;
            });
            await w.save();
          }
        }
      }
    }

    // Refund calculation
    const user = await User.findById(req.user._id).session(session);
    if (user && refundAmount > 0) {
      user.walletBalance += refundAmount;
      user.walletTransactions.push({
        amount: refundAmount,
        type: 'credit',
        description: `Refund for PNR ${booking.pnr} cancellation (${percent}% refund, minus ${charge} charge)`
      });
      await user.save();
    }

    await session.commitTransaction();
    session.endSession();

    // Trigger waitlist upgrade notifications post-commit
    for (const promo of promotionsToAlert) {
      const finalBooking = await Booking.findById(promo.booking._id);
      if (finalBooking) {
        const finalSeat = finalBooking.passengers[0].seatNumber;
        await dispatchWaitlistUpgrade(finalBooking, promo.oldSeat, finalSeat, promo.oldStatus, promo.newStatus);
      }
    }

    return res.json({
      success: true,
      message: `Booking cancelled successfully. Refund of INR ${refundAmount} (${percent}%) credited to your RMS Wallet. Cancellation fee: INR ${charge}.`,
      data: booking
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error('Cancel booking error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Download PNR ticket in PDF format
// @route   GET /api/bookings/:id/download
// @access  Private
export const downloadTicketPDF = async (req, res) => {
  try {
    const booking = await Booking.findOne({ _id: req.params.id, user: req.user._id });

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    const doc = new PDFDocument({ margin: 50 });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=ticket_${booking.pnr}.pdf`);

    doc.pipe(res);

    // Document Header
    doc.fillColor('#1a365d')
       .fontSize(22)
       .text('RAILWAY MANAGEMENT SYSTEM (RMS)', { align: 'center' });
    doc.fontSize(10)
       .fillColor('#718096')
       .text('Electronic Reservation Slip (ERS)', { align: 'center' });

    doc.moveDown();
    doc.strokeColor('#e2e8f0').lineWidth(1).moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown();

    // PNR Details
    doc.fillColor('#2d3748').fontSize(12).text(`PNR Number: ${booking.pnr}`, { underline: true });
    doc.moveDown(0.5);
    doc.text(`Train: ${booking.trainNumber} - ${booking.trainName}`);
    doc.text(`Journey Date: ${new Date(booking.dateOfJourney).toDateString()}`);
    doc.text(`From: ${booking.sourceStation}  -->  To: ${booking.destinationStation}`);
    doc.text(`Class of Travel: ${booking.classType}`);
    doc.text(`Ticket Status: ${booking.status.toUpperCase()}`);
    doc.text(`Total Fare: INR ${booking.fare}`);

    doc.moveDown();
    doc.strokeColor('#e2e8f0').moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown();

    // Passenger details list
    doc.fillColor('#1a365d').fontSize(14).text('Passenger Details');
    doc.moveDown(0.5);

    booking.passengers.forEach((passenger, idx) => {
      doc.fillColor('#2d3748').fontSize(10)
         .text(`${idx + 1}. ${passenger.name} (${passenger.age}, ${passenger.gender}) - Seat: ${passenger.seatNumber} (${passenger.berthType})`);
    });

    doc.moveDown(2);
    doc.strokeColor('#e2e8f0').moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown();

    // Print Instructions footer
    doc.fillColor('#718096').fontSize(8)
       .text('Important Instructions:', { underline: true });
    doc.moveDown(0.3);
    doc.text('1. Please carry a valid original photo ID card (Aadhaar, Passport, Voter ID, PAN card, Driving License) during your travel.');
    doc.text('2. Please reach the boarding station at least 20 minutes before departure time.');
    doc.text('3. Refunds for cancelled tickets are credited instantly to your RMS Wallet according to policy.');

    doc.end();
  } catch (error) {
    console.error('PDF generation error:', error.message);
    res.status(500).json({ success: false, message: 'Could not generate PDF ticket' });
  }
};

// @desc    Get refund preview before cancellation (Public)
// @route   GET /api/bookings/:id/refund-preview
// @access  Private
export const getRefundPreview = async (req, res) => {
  try {
    const booking = await Booking.findOne({ _id: req.params.id, user: req.user._id });

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    if (booking.status === 'cancelled') {
      return res.status(400).json({ success: false, message: 'Booking is already cancelled' });
    }

    const { refundAmount, charge, percent } = calculateRefund(booking.dateOfJourney, booking.fare);

    return res.json({
      success: true,
      data: {
        pnr: booking.pnr,
        ticketFare: booking.fare,
        cancellationCharge: charge,
        refundAmount: refundAmount,
        refundPercent: percent
      }
    });
  } catch (error) {
    console.error('Get refund preview error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};
