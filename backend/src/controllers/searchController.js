import Station from '../models/stationModel.js';
import Train from '../models/trainModel.js';
import ScheduledRun from '../models/scheduledRunModel.js';

/**
 * Educational Context (AGENTS.md Compliance):
 * ==========================================
 * 1. WHAT we are using:
 *    - In-memory midnight crossing date-time calculation for train routes.
 *    - In-memory pairing of length-2 connecting paths for indirect journey planner.
 *    - Segment overlap check: Math.max(qStart, seg.fromIndex) < Math.min(qEnd, seg.toIndex).
 * 
 * 2. WHY we are using it:
 *    - Standard database queries cannot easily calculate date-time offsets across multiple days
 *      and midnight crossings on a per-stop basis without complex procedural queries. Resolving 
 *      this in-memory in Javascript is clean, readable, and highly accurate.
 *    - Searching paths of length-2 in memory allows us to easily enforce transit buffer times (30 mins to 24 hrs)
 *      across multiple running days (checking both day D and D+1) without complex recursive database queries.
 *    - The segment overlap check is a mathematically proven interval intersection check. It checks if two
 *      closed/half-open intervals overlap, correctly showing a seat as vacant for B -> D when booked for A -> B.
 * 
 * 3. ALTERNATIVES:
 *    - Graph databases (e.g., Neo4j) or recursive SQL CTEs for connected journey pathfinding.
 *    - Relational Seat-Segment inventory table (storing a status row for every single seat-segment combination).
 *    - Dijkstra's Algorithm for dynamic time-dependent graph routing.
 * 
 * 4. WHY WE ARE NOT USING ALTERNATIVES:
 *    - Graph databases and relational segment tables introduce substantial write amplification, storage overhead,
 *      and extra server architecture, which is excessive for a system at this scale.
 *    - Static Dijkstra's doesn't easily support time schedules (where departure of the next leg depends on arrival of the first leg).
 *      Our custom path pairing is simple, highly performant, and perfectly solves 1-transfer connections.
 */

// Helper to parse date string into local timezone midnight Date object
const parseLocalDate = (dateStr) => {
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  d.setHours(0,0,0,0);
  return d;
};

// Helper to calculate exact date/times for all stops in a scheduled run, handling midnight crossings.
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
        // Midnight crossed
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
        // Midnight crossed
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
      distanceFromSource: stop.distanceFromSource
    });
  }
  return result;
};

// Helper to check if a seat is available for a query segment [qStart, qEnd]
const isSeatAvailableForSegment = (seat, qStart, qEnd) => {
  return seat.bookedSegments.every(seg => {
    // Two intervals [s1, e1] and [s2, e2] overlap if max(s1, s2) < min(e1, e2)
    // Thus they DO NOT overlap if max(s1, s2) >= min(e1, e2)
    return Math.max(qStart, seg.fromIndex) >= Math.min(qEnd, seg.toIndex);
  });
};

// Helper to format minutes into human readable HH:MM duration or hours/mins
const formatDuration = (ms) => {
  const totalMinutes = Math.floor(ms / (1000 * 60));
  const hrs = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  return `${hrs}h ${mins}m`;
};

// @desc    Direct search for trains between source and destination stations
// @route   GET /api/search/direct
// @access  Public
export const searchDirectTrains = async (req, res) => {
  try {
    const {
      from,
      to,
      date,
      classType,
      depTimeStart,
      depTimeEnd,
      arrTimeStart,
      arrTimeEnd,
      trainType
    } = req.query;

    if (!from || !to || !date) {
      return res.status(400).json({ success: false, message: 'Please provide from, to, and date' });
    }

    // 1. Resolve Station Codes
    const sourceStation = await Station.findOne({ code: from.toUpperCase() });
    const destStation = await Station.findOne({ code: to.toUpperCase() });

    if (!sourceStation || !destStation) {
      return res.status(404).json({ success: false, message: 'Source or destination station not found' });
    }

    // 2. Parse target date (midnight)
    const targetDate = parseLocalDate(date);

    // 3. Find scheduled runs on target date that contain both stations in their route
    const runs = await ScheduledRun.find({
      date: targetDate,
      routeStops: { $all: [sourceStation._id, destStation._id] }
    }).populate({
      path: 'train',
      populate: { path: 'route' }
    });

    const results = [];

    for (const run of runs) {
      const train = run.train;
      if (!train || !train.route) continue;

      // Filter by trainType if provided
      if (trainType && train.trainType !== trainType) continue;

      // Sort route stops by stopOrder
      const sortedStops = [...train.route.stops].sort((a, b) => a.stopOrder - b.stopOrder);

      // Map stops to their calculated absolute departure/arrival date-times
      const stopTimes = calculateStopDateTimes(run.date, sortedStops);

      // Find indices of source and destination
      const sourceIndex = stopTimes.findIndex(s => s.station.toString() === sourceStation._id.toString());
      const destIndex = stopTimes.findIndex(s => s.station.toString() === destStation._id.toString());

      // Ensure dest is after source
      if (sourceIndex === -1 || destIndex === -1 || sourceIndex >= destIndex) continue;

      const sourceStop = stopTimes[sourceIndex];
      const destStop = stopTimes[destIndex];

      // Filter by departure time window
      if (depTimeStart || depTimeEnd) {
        const [depH, depM] = sourceStop.departureTime.split(':').map(Number);
        const depTotalMins = depH * 60 + depM;

        if (depTimeStart) {
          const [sh, sm] = depTimeStart.split(':').map(Number);
          if (depTotalMins < sh * 60 + sm) continue;
        }
        if (depTimeEnd) {
          const [eh, em] = depTimeEnd.split(':').map(Number);
          if (depTotalMins > eh * 60 + em) continue;
        }
      }

      // Filter by arrival time window
      if (arrTimeStart || arrTimeEnd) {
        const [arrH, arrM] = destStop.arrivalTime.split(':').map(Number);
        const arrTotalMins = arrH * 60 + arrM;

        if (arrTimeStart) {
          const [sh, sm] = arrTimeStart.split(':').map(Number);
          if (arrTotalMins < sh * 60 + sm) continue;
        }
        if (arrTimeEnd) {
          const [eh, em] = arrTimeEnd.split(':').map(Number);
          if (arrTotalMins > eh * 60 + em) continue;
        }
      }

      // Check class availability
      const uniqueClasses = [...new Set(run.seats.map(s => s.classType))];
      if (classType && !uniqueClasses.includes(classType)) continue;

      // Compute seat availability for all classes
      const seatAvailability = {};
      uniqueClasses.forEach(cls => {
        const matchingSeats = run.seats.filter(s => s.classType === cls);
        const vacant = matchingSeats.filter(seat => isSeatAvailableForSegment(seat, sourceIndex, destIndex));
        seatAvailability[cls] = {
          total: matchingSeats.length,
          available: vacant.length
        };
      });

      // Calculate journey stats
      const journeyDurationMs = destStop.arrDate.getTime() - sourceStop.depDate.getTime();
      const distance = destStop.distanceFromSource - sourceStop.distanceFromSource;

      results.push({
        scheduledRunId: run._id,
        trainNumber: train.trainNumber,
        trainName: train.trainName,
        trainType: train.trainType,
        source: {
          code: sourceStation.code,
          name: sourceStation.name,
          departureTime: sourceStop.departureTime,
          departureDateTime: sourceStop.depDate
        },
        destination: {
          code: destStation.code,
          name: destStation.name,
          arrivalTime: destStop.arrivalTime,
          arrivalDateTime: destStop.arrDate
        },
        duration: formatDuration(journeyDurationMs),
        distanceKm: distance,
        classes: seatAvailability
      });
    }

    return res.json({ success: true, count: results.length, data: results });
  } catch (error) {
    console.error('Direct search error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Indirect / Connected Journey search
// @route   GET /api/search/indirect
// @access  Public
export const searchIndirectTrains = async (req, res) => {
  try {
    const { from, to, date, classType, trainType } = req.query;

    if (!from || !to || !date) {
      return res.status(400).json({ success: false, message: 'Please provide from, to, and date' });
    }

    const sourceStation = await Station.findOne({ code: from.toUpperCase() });
    const destStation = await Station.findOne({ code: to.toUpperCase() });

    if (!sourceStation || !destStation) {
      return res.status(404).json({ success: false, message: 'Source or destination station not found' });
    }

    const targetDate = parseLocalDate(date);

    // Get runs starting on date D
    const runsD = await ScheduledRun.find({
      date: targetDate,
      routeStops: sourceStation._id
    }).populate({
      path: 'train',
      populate: { path: 'route' }
    });

    // Get runs starting on date D or D+1 (for potential connections)
    const nextDate = new Date(targetDate);
    nextDate.setDate(nextDate.getDate() + 1);

    const runsDAndNext = await ScheduledRun.find({
      date: { $in: [targetDate, nextDate] },
      routeStops: destStation._id
    }).populate({
      path: 'train',
      populate: { path: 'route' }
    });

    const connections = [];

    for (const run1 of runsD) {
      const train1 = run1.train;
      if (!train1 || !train1.route) continue;

      if (trainType && train1.trainType !== trainType) continue;

      // Sort stops for Train 1
      const sortedStops1 = [...train1.route.stops].sort((a, b) => a.stopOrder - b.stopOrder);
      const stopTimes1 = calculateStopDateTimes(run1.date, sortedStops1);

      const sourceIndex1 = stopTimes1.findIndex(s => s.station.toString() === sourceStation._id.toString());
      if (sourceIndex1 === -1) continue;

      const sourceStop1 = stopTimes1[sourceIndex1];

      // Train 1 must depart from A on target date D
      const depDate1Only = new Date(sourceStop1.depDate);
      depDate1Only.setHours(0,0,0,0);
      if (depDate1Only.getTime() !== targetDate.getTime()) continue;

      // Scan subsequent stops of Train 1 as potential transfer stations
      for (let i = sourceIndex1 + 1; i < stopTimes1.length; i++) {
        const transferStop1 = stopTimes1[i];
        const transferStationId = transferStop1.station;

        // Skip destination station
        if (transferStationId.toString() === destStation._id.toString()) continue;

        // Look for second leg Train 2 from transferStation to Destination
        for (const run2 of runsDAndNext) {
          if (run1._id.toString() === run2._id.toString()) continue;

          const train2 = run2.train;
          if (!train2 || !train2.route) continue;

          if (trainType && train2.trainType !== trainType) continue;

          // Check if Train 2 has the transfer station and destination
          if (!run2.routeStops.map(id => id.toString()).includes(transferStationId.toString())) continue;

          // Sort stops for Train 2
          const sortedStops2 = [...train2.route.stops].sort((a, b) => a.stopOrder - b.stopOrder);
          const stopTimes2 = calculateStopDateTimes(run2.date, sortedStops2);

          const transferIndex2 = stopTimes2.findIndex(s => s.station.toString() === transferStationId.toString());
          const destIndex2 = stopTimes2.findIndex(s => s.station.toString() === destStation._id.toString());

          // Ensure destination is after transfer in Train 2
          if (transferIndex2 === -1 || destIndex2 === -1 || transferIndex2 >= destIndex2) continue;

          const transferStop2 = stopTimes2[transferIndex2];
          const destStop2 = stopTimes2[destIndex2];

          // Check buffer times: Train 2 departure from B must be after Train 1 arrival at B
          const arrivalAtTransfer = transferStop1.arrDate.getTime();
          const departureFromTransfer = transferStop2.depDate.getTime();
          const bufferMs = departureFromTransfer - arrivalAtTransfer;

          const minBufferMs = 30 * 60 * 1000;
          const maxBufferMs = 24 * 60 * 60 * 1000;

          if (bufferMs < minBufferMs || bufferMs > maxBufferMs) continue;

          // Filter by classType if requested
          const uniqueClasses1 = [...new Set(run1.seats.map(s => s.classType))];
          const uniqueClasses2 = [...new Set(run2.seats.map(s => s.classType))];
          
          if (classType) {
            if (!uniqueClasses1.includes(classType) || !uniqueClasses2.includes(classType)) continue;
          }

          // Fetch transfer station record to return its details
          const transferStation = await Station.findById(transferStationId);

          const leg1DurationMs = transferStop1.arrDate.getTime() - sourceStop1.depDate.getTime();
          const leg2DurationMs = destStop2.arrDate.getTime() - transferStop2.depDate.getTime();
          const totalDurationMs = destStop2.arrDate.getTime() - sourceStop1.depDate.getTime();

          const leg1Distance = transferStop1.distanceFromSource - sourceStop1.distanceFromSource;
          const leg2Distance = destStop2.distanceFromSource - transferStop2.distanceFromSource;

          const leg1Availability = {};
          uniqueClasses1.forEach(cls => {
            const seats = run1.seats.filter(s => s.classType === cls);
            const vacant = seats.filter(seat => isSeatAvailableForSegment(seat, sourceIndex1, i));
            leg1Availability[cls] = vacant.length;
          });

          const leg2Availability = {};
          uniqueClasses2.forEach(cls => {
            const seats = run2.seats.filter(s => s.classType === cls);
            const vacant = seats.filter(seat => isSeatAvailableForSegment(seat, transferIndex2, destIndex2));
            leg2Availability[cls] = vacant.length;
          });

          connections.push({
            transferStation: {
              code: transferStation.code,
              name: transferStation.name,
              city: transferStation.city
            },
            layoverTime: formatDuration(bufferMs),
            totalDuration: formatDuration(totalDurationMs),
            totalDistanceKm: leg1Distance + leg2Distance,
            firstLeg: {
              scheduledRunId: run1._id,
              trainNumber: train1.trainNumber,
              trainName: train1.trainName,
              trainType: train1.trainType,
              source: {
                code: sourceStation.code,
                name: sourceStation.name,
                departureTime: sourceStop1.departureTime,
                departureDateTime: sourceStop1.depDate
              },
              destination: {
                code: transferStation.code,
                name: transferStation.name,
                arrivalTime: transferStop1.arrivalTime,
                arrivalDateTime: transferStop1.arrDate
              },
              duration: formatDuration(leg1DurationMs),
              distanceKm: leg1Distance,
              availableSeats: leg1Availability
            },
            secondLeg: {
              scheduledRunId: run2._id,
              trainNumber: train2.trainNumber,
              trainName: train2.trainName,
              trainType: train2.trainType,
              source: {
                code: transferStation.code,
                name: transferStation.name,
                departureTime: transferStop2.departureTime,
                departureDateTime: transferStop2.depDate
              },
              destination: {
                code: destStation.code,
                name: destStation.name,
                arrivalTime: destStop2.arrivalTime,
                arrivalDateTime: destStop2.arrDate
              },
              duration: formatDuration(leg2DurationMs),
              distanceKm: leg2Distance,
              availableSeats: leg2Availability
            }
          });
        }
      }
    }

    connections.sort((a, b) => {
      const parseDurationMs = (str) => {
        const [h, m] = str.replace('h', '').replace('m', '').trim().split(' ').map(Number);
        return (h * 60 + m) * 60 * 1000;
      };
      return parseDurationMs(a.totalDuration) - parseDurationMs(b.totalDuration);
    });

    return res.json({ success: true, count: connections.length, data: connections });
  } catch (error) {
    console.error('Indirect search error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Live seat availability query showing exact seat numbers and count remaining
// @route   GET /api/search/availability
// @access  Public
export const getSeatAvailability = async (req, res) => {
  try {
    const {
      scheduledRunId,
      trainNumber,
      date,
      from,
      to,
      classType
    } = req.query;

    if (!from || !to) {
      return res.status(400).json({ success: false, message: 'Please provide from and to station codes' });
    }

    const sourceStation = await Station.findOne({ code: from.toUpperCase() });
    const destStation = await Station.findOne({ code: to.toUpperCase() });

    if (!sourceStation || !destStation) {
      return res.status(404).json({ success: false, message: 'Source or destination station not found' });
    }

    let run;

    if (scheduledRunId) {
      run = await ScheduledRun.findById(scheduledRunId).populate({
        path: 'train',
        populate: { path: 'route' }
      });
    } else if (trainNumber && date) {
      const train = await Train.findOne({ trainNumber });
      if (!train) {
        return res.status(404).json({ success: false, message: `Train number ${trainNumber} not found` });
      }

      const targetDate = parseLocalDate(date);

      run = await ScheduledRun.findOne({ train: train._id, date: targetDate }).populate({
        path: 'train',
        populate: { path: 'route' }
      });
    } else {
      return res.status(400).json({ success: false, message: 'Provide either scheduledRunId OR trainNumber and date' });
    }

    if (!run) {
      return res.status(404).json({ success: false, message: 'Scheduled run not found' });
    }

    const train = run.train;
    if (!train || !train.route) {
      return res.status(400).json({ success: false, message: 'Train or Route definition missing for this run' });
    }

    const sortedStops = [...train.route.stops].sort((a, b) => a.stopOrder - b.stopOrder);
    const stopTimes = calculateStopDateTimes(run.date, sortedStops);

    const sourceIndex = stopTimes.findIndex(s => s.station.toString() === sourceStation._id.toString());
    const destIndex = stopTimes.findIndex(s => s.station.toString() === destStation._id.toString());

    if (sourceIndex === -1 || destIndex === -1 || sourceIndex >= destIndex) {
      return res.status(400).json({ success: false, message: 'Invalid segment stops order for this train run' });
    }

    let seats = run.seats;

    if (classType) {
      seats = seats.filter(s => s.classType === classType);
    }

    const availableSeatsList = [];
    const bookedSeatsList = [];

    seats.forEach(seat => {
      const available = isSeatAvailableForSegment(seat, sourceIndex, destIndex);
      const seatInfo = {
        coachId: seat.coachId,
        classType: seat.classType,
        seatNumber: seat.seatNumber,
        berthType: seat.berthType
      };

      if (available) {
        availableSeatsList.push(seatInfo);
      } else {
        bookedSeatsList.push(seatInfo);
      }
    });

    return res.json({
      success: true,
      data: {
        scheduledRunId: run._id,
        trainNumber: train.trainNumber,
        trainName: train.trainName,
        segment: {
          from: sourceStation.code,
          to: destStation.code,
          fromIndex: sourceIndex,
          toIndex: destIndex
        },
        totalSeatsQueried: seats.length,
        availableSeatsCount: availableSeatsList.length,
        availableSeats: availableSeatsList,
        bookedSeatsCount: bookedSeatsList.length,
        bookedSeats: bookedSeatsList
      }
    });
  } catch (error) {
    console.error('Get seat availability error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};
