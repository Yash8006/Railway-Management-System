import Booking from '../models/bookingModel.js';
import ScheduledRun from '../models/scheduledRunModel.js';

/**
 * Educational Context (AGENTS.md Compliance):
 * ==========================================
 * 1. WHAT we are using:
 *    - MongoDB Aggregation Framework pipelines (using operators like `$unwind`, `$group`, `$bucket`, `$sort`).
 *    - In-memory post-grouping label maps for age buckets.
 * 
 * 2. WHY we are using it:
 *    - Aggregating metrics directly inside the database minimizes CPU context switching in Node.js and
 *      reduces database-to-application network throughput to a single summarized record payload.
 * 
 * 3. ALTERNATIVES:
 *    - Fetching all database documents into memory and grouping using javascript `Array.reduce`.
 *    - Writing separate queries for each single metric check.
 * 
 * 4. WHY WE ARE NOT USING ALTERNATIVES:
 *    - In-memory reductions cause massive memory consumption, trigger garbage collection spikes,
 *      and block the Node.js event loop under heavy production traffic.
 *    - Multiple discrete queries force multiple network round-trips to MongoDB, slowing down the server.
 */

// @desc    Get sales analytics (daily revenue, class shares, quota shares)
// @route   GET /api/admin/analytics/sales
// @access  Private (Admin only)
export const getSalesAnalytics = async (req, res) => {
  try {
    // 1. Daily Revenue Chart data
    const dailySales = await Booking.aggregate([
      { $match: { status: { $ne: 'cancelled' } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$dateOfJourney' } },
          revenue: { $sum: '$fare' },
          bookingsCount: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // 2. Class Share breakdown
    const classBreakdown = await Booking.aggregate([
      { $match: { status: { $ne: 'cancelled' } } },
      {
        $group: {
          _id: '$classType',
          revenue: { $sum: '$fare' },
          bookingsCount: { $sum: 1 }
        }
      },
      { $sort: { revenue: -1 } }
    ]);

    // 3. Quota Share breakdown
    const quotaBreakdown = await Booking.aggregate([
      { $match: { status: { $ne: 'cancelled' } } },
      {
        $group: {
          _id: '$quota',
          revenue: { $sum: '$fare' },
          bookingsCount: { $sum: 1 }
        }
      },
      { $sort: { revenue: -1 } }
    ]);

    return res.json({
      success: true,
      data: {
        dailySales,
        classBreakdown,
        quotaBreakdown
      }
    });
  } catch (error) {
    console.error('Sales analytics error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Get occupancy analytics (profitable routes, low-occupancy run alerts, peak booking hours)
// @route   GET /api/admin/analytics/occupancy
// @access  Private (Admin only)
export const getOccupancyAnalytics = async (req, res) => {
  try {
    // 1. Profitable Routes (bookings group by train and segments)
    const profitableRoutes = await Booking.aggregate([
      { $match: { status: { $ne: 'cancelled' } } },
      {
        $group: {
          _id: {
            trainNumber: '$trainNumber',
            trainName: '$trainName',
            source: '$sourceStation',
            destination: '$destinationStation'
          },
          revenue: { $sum: '$fare' },
          bookingsCount: { $sum: 1 }
        }
      },
      { $sort: { revenue: -1 } }
    ]);

    // 2. Peak booking creation hours (identifying booking traffic times)
    const peakHours = await Booking.aggregate([
      { $match: { status: { $ne: 'cancelled' } } },
      {
        $group: {
          _id: { $hour: '$createdAt' },
          revenue: { $sum: '$fare' },
          bookingsCount: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // 3. Low Occupancy Trains (alert runs where occupancy < 30%)
    const runs = await ScheduledRun.find().populate('train');
    const lowOccupancyAlerts = [];

    for (const run of runs) {
      const totalSeats = run.seats.length;
      const bookedSeats = run.seats.filter(s => s.bookedSegments.length > 0).length;
      const occupancyRate = totalSeats > 0 ? (bookedSeats / totalSeats) : 0;

      if (occupancyRate < 0.30) {
        lowOccupancyAlerts.push({
          runId: run._id,
          trainNumber: run.train.trainNumber,
          trainName: run.train.trainName,
          date: run.date,
          totalSeats,
          bookedSeats,
          occupancyPercent: Math.round(occupancyRate * 100)
        });
      }
    }

    return res.json({
      success: true,
      data: {
        profitableRoutes,
        peakHours,
        lowOccupancyAlerts
      }
    });
  } catch (error) {
    console.error('Occupancy analytics error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Get user demographics analytics (age brackets and gender spreads)
// @route   GET /api/admin/analytics/demographics
// @access  Private (Admin only)
export const getDemographicsAnalytics = async (req, res) => {
  try {
    // 1. Age bracket groups (0-12 Children, 13-25 Youth, 26-59 Adults, 60+ Seniors)
    const ageBuckets = await Booking.aggregate([
      { $match: { status: { $ne: 'cancelled' } } },
      { $unwind: '$passengers' },
      {
        $project: {
          age: '$passengers.age'
        }
      },
      {
        $bucket: {
          groupBy: '$age',
          boundaries: [0, 13, 26, 60, 120],
          default: 'Other',
          output: {
            count: { $sum: 1 }
          }
        }
      }
    ]);

    // Map bucket boundaries to human readable groups
    const formattedAgeGroups = ageBuckets.map(b => {
      let label = 'Unknown';
      if (b._id === 0) label = 'Children (0-12)';
      else if (b._id === 13) label = 'Youth (13-25)';
      else if (b._id === 26) label = 'Adults (26-59)';
      else if (b._id === 60) label = 'Seniors (60+)';
      return { group: label, count: b.count };
    });

    // 2. Gender demographics
    const genderDemographics = await Booking.aggregate([
      { $match: { status: { $ne: 'cancelled' } } },
      { $unwind: '$passengers' },
      {
        $group: {
          _id: { $toLower: '$passengers.gender' },
          count: { $sum: 1 }
        }
      },
      {
        $project: {
          gender: '$_id',
          count: 1,
          _id: 0
        }
      }
    ]);

    return res.json({
      success: true,
      data: {
        ageGroups: formattedAgeGroups,
        genderDemographics
      }
    });
  } catch (error) {
    console.error('Demographics analytics error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};
