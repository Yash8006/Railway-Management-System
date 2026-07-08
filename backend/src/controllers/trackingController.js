import Station from '../models/stationModel.js';
import Train from '../models/trainModel.js';
import ScheduledRun from '../models/scheduledRunModel.js';
import LiveStatus from '../models/liveStatusModel.js';
import { dispatchDelayAlerts, dispatchCancellationAlerts } from '../services/notificationService.js';
import { syncRouteAndSchedules, getSimulatedLiveDetails, RAILRADAR_TRAINS } from '../services/railRadarService.js';

/**
 * Educational Context (AGENTS.md Compliance):
 * ==========================================
 * 1. WHAT we are using:
 *    - Timezone-robust local midnight date parser.
 *    - In-memory route stop crossing evaluation and delay propagation offset algorithm.
 * 
 * 2. WHY we are using it:
 *    - Performing delay arithmetic and crossing checks dynamically during the read query
 *      eliminates the need to maintain duplicate actual arrival timestamps for every single stop
 *      in the database, reducing write operations and scaling efficiently.
 * 
 * 3. ALTERNATIVES:
 *    - Pre-generating and saving separate, persistent "actual arrival" records for every stop in MongoDB.
 * 
 * 4. WHY WE ARE NOT USING ALTERNATIVES:
 *    - Updating multiple stop records on every tracking update creates large transaction write volumes
 *      and storage creep. Dynamic computation in Node.js memory has near-zero latency and simplifies code.
 */

// Helper to parse date string into local timezone midnight Date object
const parseLocalDate = (dateStr) => {
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  d.setHours(0,0,0,0);
  return d;
};

// Helper to calculate scheduled stop date-times (midnight-crossing algorithm)
const calculateStopDateTimes = (runDate, stops) => {
  const result = [];
  let currentDay = new Date(runDate);
  currentDay.setHours(0, 0, 0, 0);

  let lastTimeMinutes = -1;

  for (const stop of stops) {
    const arrTimeStr = stop.arrivalTime;
    const depTimeStr = stop.departureTime;

    let arrDate = null;
    let depDate = null;

    if (arrTimeStr) {
      const [h, m] = arrTimeStr.split(':').map(Number);
      const arrMinutes = h * 60 + m;
      if (lastTimeMinutes !== -1 && arrMinutes < lastTimeMinutes) {
        currentDay = new Date(currentDay);
        currentDay.setDate(currentDay.getDate() + 1);
      }
      arrDate = new Date(currentDay);
      arrDate.setHours(h, m, 0, 0);
      lastTimeMinutes = arrMinutes;
    }

    if (depTimeStr) {
      const [h, m] = depTimeStr.split(':').map(Number);
      const depMinutes = h * 60 + m;
      if (lastTimeMinutes !== -1 && depMinutes < lastTimeMinutes) {
        currentDay = new Date(currentDay);
        currentDay.setDate(currentDay.getDate() + 1);
      }
      depDate = new Date(currentDay);
      depDate.setHours(h, m, 0, 0);
      lastTimeMinutes = depMinutes;
    }

    result.push({
      station: stop.station._id || stop.station,
      arrivalTime: arrTimeStr,
      departureTime: depTimeStr,
      arrDate,
      depDate,
      stopOrder: stop.stopOrder,
      distanceFromSource: stop.distanceFromSource
    });
  }
  return result;
};

// Helper to format Date back to HH:MM time string
const formatTimeStr = (date) => {
  if (!date) return null;
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
};

// @desc    Update live running status (Admin / Station Master only)
// @route   POST /api/tracking/update/:runId
// @access  Private (Admin / Station Master)
export const updateLiveStatus = async (req, res) => {
  try {
    const { runId } = req.params;
    const { status, currentStationCode, delayMinutes, platformNumbers, emergencyAlerts } = req.body;

    const run = await ScheduledRun.findById(runId).populate({
      path: 'train',
      populate: { path: 'route' }
    });

    if (!run) {
      return res.status(404).json({ success: false, message: 'Scheduled run not found' });
    }

    let liveStatus = await LiveStatus.findOne({ scheduledRun: runId });
    if (!liveStatus) {
      liveStatus = new LiveStatus({ scheduledRun: runId });
    }

    if (status) liveStatus.status = status;
    if (delayMinutes !== undefined) liveStatus.delayMinutes = Number(delayMinutes);
    if (emergencyAlerts) liveStatus.emergencyAlerts = emergencyAlerts;

    // Resolve current station stop order
    if (currentStationCode) {
      const station = await Station.findOne({ code: currentStationCode.toUpperCase() });
      if (!station) {
        return res.status(404).json({ success: false, message: `Station code ${currentStationCode} not found` });
      }
      liveStatus.currentStation = station._id;

      // Find stopOrder of the current station in the run stops list
      const sortedStops = [...run.train.route.stops].sort((a, b) => a.stopOrder - b.stopOrder);
      const stopIndex = sortedStops.findIndex(s => s.station.toString() === station._id.toString());
      if (stopIndex !== -1) {
        liveStatus.currentStopOrder = sortedStops[stopIndex].stopOrder;
      }
    }

    // Resolve platform numbers station codes to ObjectIds
    if (platformNumbers && Array.isArray(platformNumbers)) {
      const resolvedPlatforms = [];
      for (const item of platformNumbers) {
        const station = await Station.findOne({ code: item.stationCode.toUpperCase() });
        if (station) {
          resolvedPlatforms.push({
            station: station._id,
            platform: item.platform
          });
        }
      }
      liveStatus.platformNumbers = resolvedPlatforms;
    }

    await liveStatus.save();

    // Trigger alerts post-save
    if (status === 'cancelled') {
      await dispatchCancellationAlerts(runId);
    } else if (delayMinutes !== undefined && Number(delayMinutes) > 0) {
      await dispatchDelayAlerts(runId, Number(delayMinutes));
    }

    return res.json({ success: true, message: 'Live status updated successfully', data: liveStatus });
  } catch (error) {
    console.error('Update live status error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Get train live status (Public)
// @route   GET /api/tracking/status
// @access  Public
export const getTrainLiveStatus = async (req, res) => {
  try {
    const { trainNumber, date } = req.query;

    if (!trainNumber || !date) {
      return res.status(400).json({ success: false, message: 'Please provide trainNumber and date' });
    }

    // 0. Sync Scheduled Run from RailRadar API if it exists in preconfigured trains
    const matchingTrainData = RAILRADAR_TRAINS.find((t) => t.trainNumber === trainNumber);
    if (matchingTrainData) {
      const firstStop = matchingTrainData.stops[0].stationCode;
      const lastStop = matchingTrainData.stops[matchingTrainData.stops.length - 1].stationCode;
      await syncRouteAndSchedules(firstStop, lastStop, date);
    }

    const train = await Train.findOne({ trainNumber }).populate({
      path: 'route',
      populate: { path: 'stops.station' }
    });
    if (!train) {
      return res.status(404).json({ success: false, message: `Train number ${trainNumber} not found` });
    }

    const targetDate = parseLocalDate(date);
    const run = await ScheduledRun.findOne({ train: train._id, date: targetDate });

    if (!run) {
      return res.status(404).json({ success: false, message: `No scheduled run found for Train ${trainNumber} on ${date}` });
    }

    let liveStatus = await LiveStatus.findOne({ scheduledRun: run._id })
      .populate('currentStation')
      .populate('platformNumbers.station');

    // Initialize with defaults if liveStatus does not exist yet
    if (!liveStatus) {
      liveStatus = await LiveStatus.create({
        scheduledRun: run._id,
        status: 'not_started',
        delayMinutes: 0,
        currentStation: run.routeStops[0],
        currentStopOrder: 1
      });
      // Populate defaults
      liveStatus = await LiveStatus.findById(liveStatus._id)
        .populate('currentStation')
        .populate('platformNumbers.station');
    }

    // Sort and calculate scheduled run times
    const sortedStops = [...train.route.stops].sort((a, b) => a.stopOrder - b.stopOrder);
    const stopTimes = calculateStopDateTimes(run.date, sortedStops);

    // Compute dynamic simulation details
    const simDetails = getSimulatedLiveDetails(train, sortedStops, run.date, liveStatus.delayMinutes);
    const currentSpeed = simDetails.currentSpeed;
    const currentCoordinates = simDetails.currentCoordinates;
    const overallStatus = liveStatus.status === 'not_started' ? simDetails.status : liveStatus.status;
    const currentStopOrder = liveStatus.currentStopOrder === 1 && liveStatus.status === 'not_started' ? simDetails.currentStopOrder : liveStatus.currentStopOrder;

    const formattedStops = [];
    for (const stop of stopTimes) {
      const station = await Station.findById(stop.station);
      
      let stopStatus = 'upcoming';
      if (stop.stopOrder < currentStopOrder) {
        stopStatus = 'crossed';
      } else if (stop.stopOrder === currentStopOrder) {
        stopStatus = 'current';
      }

      // Calculate Estimated Times (scheduled + delayOffset)
      let estArrival = null;
      let estDeparture = null;

      if (stop.arrDate) {
        const d = new Date(stop.arrDate);
        d.setMinutes(d.getMinutes() + liveStatus.delayMinutes);
        estArrival = d;
      }
      if (stop.depDate) {
        const d = new Date(stop.depDate);
        d.setMinutes(d.getMinutes() + liveStatus.delayMinutes);
        estDeparture = d;
      }

      // Lookup platform number locator
      const platMatch = liveStatus.platformNumbers.find(p => p.station._id.toString() === station._id.toString());
      const platform = platMatch ? platMatch.platform : 'Awaited';

      formattedStops.push({
        stationCode: station.code,
        stationName: station.name,
        city: station.city,
        coordinates: station.coordinates, // Route geometry coordinates
        stopOrder: stop.stopOrder,
        distanceKm: stop.distanceFromSource,
        status: stopStatus,
        scheduled: {
          arrival: stop.arrivalTime,
          departure: stop.departureTime
        },
        estimated: {
          arrival: formatTimeStr(estArrival),
          departure: formatTimeStr(estDeparture)
        },
        platform
      });
    }

    return res.json({
      success: true,
      data: {
        scheduledRunId: run._id,
        trainNumber: train.trainNumber,
        trainName: train.trainName,
        trainType: train.trainType,
        date: run.date,
        overallStatus: overallStatus,
        delayMinutes: liveStatus.delayMinutes,
        delayText: liveStatus.delayMinutes === 0 ? 'On Time' : `Late by ${liveStatus.delayMinutes} mins`,
        currentStation: liveStatus.currentStation ? {
          code: liveStatus.currentStation.code,
          name: liveStatus.currentStation.name,
          city: liveStatus.currentStation.city
        } : (simDetails.currentStationCode ? { code: simDetails.currentStationCode } : null),
        currentSpeed: currentSpeed,
        currentCoordinates: currentCoordinates,
        etaText: simDetails.etaText,
        emergencyAlerts: liveStatus.emergencyAlerts,
        stops: formattedStops
      }
    });
  } catch (error) {
    console.error('Get train live status error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};
