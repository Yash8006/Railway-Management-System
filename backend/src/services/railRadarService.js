/**
 * Educational Context (AGENTS.md Compliance):
 * ==========================================
 * 1. WHAT we are using:
 *    - A simulated RailRadar service that provides mock train running details, station databases, and routes.
 *    - Dynamic, on-demand synchronization database seeder that populates MongoDB.
 * 
 * 2. WHY we are using it:
 *    - In development/production without a live NTES/RailRadar feed API key, mock-seeding popular routes 
 *      on-the-fly when a query occurs ensures the user never encounters 404s for station lookups, 
 *      making testing and local setups effortless.
 * 
 * 3. ALTERNATIVES:
 *    - Hardcoding seed JSON files and requiring the user to run a manual NPM seeding command.
 *    - Making actual HTTP requests to a public third-party Indian Railways API (e.g. RapidAPI).
 * 
 * 4. WHY WE ARE NOT USING ALTERNATIVES:
 *    - Hardcoded seeding relies on manual steps that users frequently forget, leading to broken searches out-of-the-box.
 *    - Public live APIs are heavily rate-limited, frequently suffer downtime, require developer API key registration,
 *      and change schemas without notice, which breaks application integrity.
 */

import Station from '../models/stationModel.js';
import Route from '../models/routeModel.js';
import Train from '../models/trainModel.js';
import ScheduledRun from '../models/scheduledRunModel.js';

// 1. Static high-fidelity RailRadar Station Database with geographic coordinates
export const RAILRADAR_STATIONS = {
  NDLS: { name: 'New Delhi', city: 'New Delhi', coordinates: { latitude: 28.6430, longitude: 77.2223 }, zone: 'NR' },
  HWH: { name: 'Howrah Jn', city: 'Kolkata', coordinates: { latitude: 22.5834, longitude: 88.3433 }, zone: 'ER' },
  BCT: { name: 'Mumbai Central', city: 'Mumbai', coordinates: { latitude: 18.9696, longitude: 72.8193 }, zone: 'WR' },
  BNC: { name: 'Bengaluru Cantt', city: 'Bangalore', coordinates: { latitude: 12.9922, longitude: 77.5982 }, zone: 'SWR' },
  MAS: { name: 'Chennai Central', city: 'Chennai', coordinates: { latitude: 13.0827, longitude: 80.2707 }, zone: 'SR' },
  
  // Intermediate Stops for HWH -> NDLS
  DHN: { name: 'Dhanbad Jn', city: 'Dhanbad', coordinates: { latitude: 23.7997, longitude: 86.4304 }, zone: 'ECR' },
  PNBE: { name: 'Patna Jn', city: 'Patna', coordinates: { latitude: 25.6022, longitude: 85.1376 }, zone: 'ECR' },
  DDU: { name: 'Pt. Deen Dayal Upadhyaya Jn', city: 'Mughalsarai', coordinates: { latitude: 25.2818, longitude: 83.1237 }, zone: 'ECR' },
  CNB: { name: 'Kanpur Central', city: 'Kanpur', coordinates: { latitude: 26.4542, longitude: 80.3512 }, zone: 'NCR' },

  // Intermediate Stops for BCT -> NDLS
  KOTA: { name: 'Kota Jn', city: 'Kota', coordinates: { latitude: 25.2230, longitude: 75.8650 }, zone: 'WCR' },
  RTM: { name: 'Ratlam Jn', city: 'Ratlam', coordinates: { latitude: 23.3360, longitude: 75.0380 }, zone: 'WR' },
  BRC: { name: 'Vadodara Jn', city: 'Vadodara', coordinates: { latitude: 22.3106, longitude: 73.1812 }, zone: 'WR' },
  ST: { name: 'Surat', city: 'Surat', coordinates: { latitude: 21.2049, longitude: 72.8406 }, zone: 'WR' },

  // Intermediate Stops for NDLS -> MAS
  AGC: { name: 'Agra Cantt', city: 'Agra', coordinates: { latitude: 27.1578, longitude: 77.9908 }, zone: 'NCR' },
  VGLJ: { name: 'VGL Jhansi Jn', city: 'Jhansi', coordinates: { latitude: 25.4484, longitude: 78.5685 }, zone: 'NCR' },
  BPL: { name: 'Bhopal Jn', city: 'Bhopal', coordinates: { latitude: 23.2599, longitude: 77.4126 }, zone: 'WCR' },
  NGP: { name: 'Nagpur Jn', city: 'Nagpur', coordinates: { latitude: 21.1500, longitude: 79.0900 }, zone: 'CR' },
  BPQ: { name: 'Balharshah', city: 'Balharshah', coordinates: { latitude: 19.8519, longitude: 79.3541 }, zone: 'CR' },
  WL: { name: 'Warangal', city: 'Warangal', coordinates: { latitude: 17.9689, longitude: 79.5941 }, zone: 'SCR' },
  BZA: { name: 'Vijayawada Jn', city: 'Vijayawada', coordinates: { latitude: 16.5062, longitude: 80.6480 }, zone: 'SCR' },

  // Intermediate Stops for BCT -> BNC
  KYN: { name: 'Kalyan Jn', city: 'Kalyan', coordinates: { latitude: 19.2348, longitude: 73.1360 }, zone: 'CR' },
  PUNE: { name: 'Pune Jn', city: 'Pune', coordinates: { latitude: 18.5284, longitude: 73.8739 }, zone: 'CR' },
  SUR: { name: 'Solapur', city: 'Solapur', coordinates: { latitude: 17.6599, longitude: 75.9064 }, zone: 'CR' },
  KLBG: { name: 'Kalaburagi Jn', city: 'Kalaburagi', coordinates: { latitude: 17.3297, longitude: 76.8343 }, zone: 'CR' },
  WADI: { name: 'Wadi Jn', city: 'Wadi', coordinates: { latitude: 17.0512, longitude: 76.9934 }, zone: 'CR' },
  RC: { name: 'Raichur', city: 'Raichur', coordinates: { latitude: 16.2023, longitude: 77.3524 }, zone: 'SCR' },
  GTL: { name: 'Guntakal Jn', city: 'Guntakal', coordinates: { latitude: 15.1667, longitude: 77.3667 }, zone: 'SCR' }
};

// Helper: Generates coach inventory blueprints (SL, 3A, 2A, 1A)
const generateCoaches = () => {
  const coaches = [];
  const berthTypes = ['Lower', 'Middle', 'Upper', 'Side Lower', 'Side Upper'];

  // Sleeper Coach (S1) - 15 seats
  const sleeperLayout = [];
  for (let i = 1; i <= 15; i++) {
    sleeperLayout.push({ seatNumber: i, berthType: berthTypes[(i - 1) % 5] });
  }
  coaches.push({ coachId: 'S1', classType: 'Sleeper', totalSeats: 15, seatsLayout: sleeperLayout });

  // AC 3 Tier Coach (B1) - 12 seats
  const ac3Layout = [];
  for (let i = 1; i <= 12; i++) {
    ac3Layout.push({ seatNumber: i, berthType: berthTypes[(i - 1) % 5] });
  }
  coaches.push({ coachId: 'B1', classType: 'AC 3 Tier', totalSeats: 12, seatsLayout: ac3Layout });

  // AC 2 Tier Coach (A1) - 8 seats
  const ac2Layout = [];
  const ac2Berths = ['Lower', 'Upper', 'Side Lower', 'Side Upper'];
  for (let i = 1; i <= 8; i++) {
    ac2Layout.push({ seatNumber: i, berthType: ac2Berths[(i - 1) % 4] });
  }
  coaches.push({ coachId: 'A1', classType: 'AC 2 Tier', totalSeats: 8, seatsLayout: ac2Layout });

  // First Class Coach (H1) - 4 seats
  const fcLayout = [];
  const fcBerths = ['Lower', 'Upper'];
  for (let i = 1; i <= 4; i++) {
    fcLayout.push({ seatNumber: i, berthType: fcBerths[(i - 1) % 2] });
  }
  coaches.push({ coachId: 'H1', classType: 'First Class', totalSeats: 4, seatsLayout: fcLayout });

  return coaches;
};

// 2. Predefined Train schedules and routes
export const RAILRADAR_TRAINS = [
  {
    trainNumber: '12301',
    trainName: 'Howrah Rajdhani Express',
    trainType: 'Superfast',
    stops: [
      { stationCode: 'HWH', stopOrder: 1, arrivalTime: null, departureTime: '16:50', distanceFromSource: 0 },
      { stationCode: 'DHN', stopOrder: 2, arrivalTime: '19:00', departureTime: '19:05', distanceFromSource: 259 },
      { stationCode: 'PNBE', stopOrder: 3, arrivalTime: '22:30', departureTime: '22:40', distanceFromSource: 531 },
      { stationCode: 'DDU', stopOrder: 4, arrivalTime: '00:55', departureTime: '01:05', distanceFromSource: 742 },
      { stationCode: 'CNB', stopOrder: 5, arrivalTime: '04:45', departureTime: '04:50', distanceFromSource: 1090 },
      { stationCode: 'NDLS', stopOrder: 6, arrivalTime: '10:05', departureTime: null, distanceFromSource: 1530 }
    ]
  },
  {
    trainNumber: '12302',
    trainName: 'New Delhi Howrah Rajdhani',
    trainType: 'Superfast',
    stops: [
      { stationCode: 'NDLS', stopOrder: 1, arrivalTime: null, departureTime: '16:50', distanceFromSource: 0 },
      { stationCode: 'CNB', stopOrder: 2, arrivalTime: '21:55', departureTime: '22:00', distanceFromSource: 440 },
      { stationCode: 'DDU', stopOrder: 3, arrivalTime: '01:45', departureTime: '01:55', distanceFromSource: 788 },
      { stationCode: 'PNBE', stopOrder: 4, arrivalTime: '04:10', departureTime: '04:20', distanceFromSource: 999 },
      { stationCode: 'DHN', stopOrder: 5, arrivalTime: '07:55', departureTime: '08:00', distanceFromSource: 1271 },
      { stationCode: 'HWH', stopOrder: 6, arrivalTime: '10:15', departureTime: null, distanceFromSource: 1530 }
    ]
  },
  {
    trainNumber: '12952',
    trainName: 'Mumbai Rajdhani Express',
    trainType: 'Superfast',
    stops: [
      { stationCode: 'BCT', stopOrder: 1, arrivalTime: null, departureTime: '16:55', distanceFromSource: 0 },
      { stationCode: 'ST', stopOrder: 2, arrivalTime: '19:15', departureTime: '19:20', distanceFromSource: 263 },
      { stationCode: 'BRC', stopOrder: 3, arrivalTime: '20:45', departureTime: '20:50', distanceFromSource: 393 },
      { stationCode: 'RTM', stopOrder: 4, arrivalTime: '23:55', departureTime: '23:58', distanceFromSource: 654 },
      { stationCode: 'KOTA', stopOrder: 5, arrivalTime: '03:15', departureTime: '03:20', distanceFromSource: 921 },
      { stationCode: 'NDLS', stopOrder: 6, arrivalTime: '08:35', departureTime: null, distanceFromSource: 1386 }
    ]
  },
  {
    trainNumber: '12951',
    trainName: 'New Delhi Mumbai Rajdhani',
    trainType: 'Superfast',
    stops: [
      { stationCode: 'NDLS', stopOrder: 1, arrivalTime: null, departureTime: '16:55', distanceFromSource: 0 },
      { stationCode: 'KOTA', stopOrder: 2, arrivalTime: '22:10', departureTime: '22:20', distanceFromSource: 465 },
      { stationCode: 'RTM', stopOrder: 3, arrivalTime: '01:30', departureTime: '01:35', distanceFromSource: 732 },
      { stationCode: 'BRC', stopOrder: 4, arrivalTime: '04:40', departureTime: '04:48', distanceFromSource: 993 },
      { stationCode: 'ST', stopOrder: 5, arrivalTime: '06:15', departureTime: '06:20', distanceFromSource: 1123 },
      { stationCode: 'BCT', stopOrder: 6, arrivalTime: '08:35', departureTime: null, distanceFromSource: 1386 }
    ]
  },
  {
    trainNumber: '12616',
    trainName: 'Grand Trunk Express',
    trainType: 'Express',
    stops: [
      { stationCode: 'NDLS', stopOrder: 1, arrivalTime: null, departureTime: '18:40', distanceFromSource: 0 },
      { stationCode: 'AGC', stopOrder: 2, arrivalTime: '21:10', departureTime: '21:15', distanceFromSource: 195 },
      { stationCode: 'VGLJ', stopOrder: 3, arrivalTime: '23:50', departureTime: '23:58', distanceFromSource: 410 },
      { stationCode: 'BPL', stopOrder: 4, arrivalTime: '03:15', departureTime: '03:20', distanceFromSource: 702 },
      { stationCode: 'NGP', stopOrder: 5, arrivalTime: '09:00', departureTime: '09:05', distanceFromSource: 1092 },
      { stationCode: 'BPQ', stopOrder: 6, arrivalTime: '12:15', departureTime: '12:20', distanceFromSource: 1300 },
      { stationCode: 'WL', stopOrder: 7, arrivalTime: '15:45', departureTime: '15:50', distanceFromSource: 1544 },
      { stationCode: 'BZA', stopOrder: 8, arrivalTime: '19:15', departureTime: '19:30', distanceFromSource: 1750 },
      { stationCode: 'MAS', stopOrder: 9, arrivalTime: '04:30', departureTime: null, distanceFromSource: 2185 }
    ]
  },
  {
    trainNumber: '12615',
    trainName: 'Grand Trunk Express (Up)',
    trainType: 'Express',
    stops: [
      { stationCode: 'MAS', stopOrder: 1, arrivalTime: null, departureTime: '18:40', distanceFromSource: 0 },
      { stationCode: 'BZA', stopOrder: 2, arrivalTime: '23:45', departureTime: '23:55', distanceFromSource: 435 },
      { stationCode: 'WL', stopOrder: 3, arrivalTime: '02:30', departureTime: '02:32', distanceFromSource: 641 },
      { stationCode: 'BPQ', stopOrder: 4, arrivalTime: '06:15', departureTime: '06:20', distanceFromSource: 885 },
      { stationCode: 'NGP', stopOrder: 5, arrivalTime: '09:30', departureTime: '09:35', distanceFromSource: 1093 },
      { stationCode: 'BPL', stopOrder: 6, arrivalTime: '15:20', departureTime: '15:25', distanceFromSource: 1483 },
      { stationCode: 'VGLJ', stopOrder: 7, arrivalTime: '18:50', departureTime: '18:58', distanceFromSource: 1775 },
      { stationCode: 'AGC', stopOrder: 8, arrivalTime: '21:40', departureTime: '21:45', distanceFromSource: 1990 },
      { stationCode: 'NDLS', stopOrder: 9, arrivalTime: '00:15', departureTime: null, distanceFromSource: 2185 }
    ]
  },
  {
    trainNumber: '11301',
    trainName: 'Udayan Express',
    trainType: 'Express',
    stops: [
      { stationCode: 'BCT', stopOrder: 1, arrivalTime: null, departureTime: '08:10', distanceFromSource: 0 },
      { stationCode: 'KYN', stopOrder: 2, arrivalTime: '09:15', departureTime: '09:18', distanceFromSource: 54 },
      { stationCode: 'PUNE', stopOrder: 3, arrivalTime: '11:40', departureTime: '11:45', distanceFromSource: 192 },
      { stationCode: 'SUR', stopOrder: 4, arrivalTime: '16:00', departureTime: '16:05', distanceFromSource: 454 },
      { stationCode: 'KLBG', stopOrder: 5, arrivalTime: '17:35', departureTime: '17:38', distanceFromSource: 567 },
      { stationCode: 'WADI', stopOrder: 6, arrivalTime: '18:35', departureTime: '18:40', distanceFromSource: 604 },
      { stationCode: 'RC', stopOrder: 7, arrivalTime: '20:13', departureTime: '20:15', distanceFromSource: 712 },
      { stationCode: 'GTL', stopOrder: 8, arrivalTime: '22:25', departureTime: '22:30', distanceFromSource: 833 },
      { stationCode: 'BNC', stopOrder: 9, arrivalTime: '05:40', departureTime: null, distanceFromSource: 1100 }
    ]
  },
  {
    trainNumber: '11302',
    trainName: 'Udayan Express (Up)',
    trainType: 'Express',
    stops: [
      { stationCode: 'BNC', stopOrder: 1, arrivalTime: null, departureTime: '20:40', distanceFromSource: 0 },
      { stationCode: 'GTL', stopOrder: 2, arrivalTime: '03:45', departureTime: '03:50', distanceFromSource: 267 },
      { stationCode: 'RC', stopOrder: 3, arrivalTime: '05:13', departureTime: '05:15', distanceFromSource: 388 },
      { stationCode: 'WADI', stopOrder: 4, arrivalTime: '07:05', departureTime: '07:10', distanceFromSource: 496 },
      { stationCode: 'KLBG', stopOrder: 5, arrivalTime: '08:00', departureTime: '08:03', distanceFromSource: 533 },
      { stationCode: 'SUR', stopOrder: 6, arrivalTime: '09:40', departureTime: '09:45', distanceFromSource: 646 },
      { stationCode: 'PUNE', stopOrder: 7, arrivalTime: '14:10', departureTime: '14:15', distanceFromSource: 908 },
      { stationCode: 'KYN', stopOrder: 8, arrivalTime: '17:05', departureTime: '17:08', distanceFromSource: 1046 },
      { stationCode: 'BCT', stopOrder: 9, arrivalTime: '18:20', departureTime: null, distanceFromSource: 1100 }
    ]
  }
];

// Helper: Parse HH:MM minutes into absolute minutes from midnight
const getMinutesFromTime = (timeStr) => {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
};

// 3. Dynamic Seeding of Stations, Route, Train, and Scheduled Run from RailRadar API
export const syncRouteAndSchedules = async (fromCode, toCode, dateStr) => {
  try {
    const fromUpper = fromCode.toUpperCase();
    const toUpper = toCode.toUpperCase();

    // A. Seed ALL stations eagerly to ensure station lookups never throw a 404
    const stationIdMap = {};
    for (const [code, sData] of Object.entries(RAILRADAR_STATIONS)) {
      let stationDoc = await Station.findOne({ code });
      if (!stationDoc) {
        stationDoc = await Station.create({
          code,
          name: sData.name,
          city: sData.city,
          coordinates: sData.coordinates,
          zone: sData.zone
        });
        console.log(`[RailRadar Sync] Seeded Station: ${code}`);
      }
      stationIdMap[code] = stationDoc._id;
    }

    // Find if we have any predefined train routes matching the query
    const matchingTrainData = RAILRADAR_TRAINS.find((t) => {
      const fromStop = t.stops.find((s) => s.stationCode === fromUpper);
      const toStop = t.stops.find((s) => s.stationCode === toUpper);
      return fromStop && toStop && fromStop.stopOrder < toStop.stopOrder;
    });

    if (!matchingTrainData) {
      console.log(`[RailRadar Sync] No predefined train route found for ${fromUpper} -> ${toUpper}`);
      return;
    }

    console.log(`[RailRadar Sync] Found matching train ${matchingTrainData.trainNumber} between ${fromUpper} and ${toUpper}`);

    // B. Seed Route
    const routeName = `${matchingTrainData.stops[0].stationCode}-${matchingTrainData.stops[matchingTrainData.stops.length - 1].stationCode} Route`;
    let routeDoc = await Route.findOne({ name: routeName });
    if (!routeDoc) {
      const stopsData = matchingTrainData.stops.map((stop) => ({
        station: stationIdMap[stop.stationCode],
        stopOrder: stop.stopOrder,
        arrivalTime: stop.arrivalTime,
        departureTime: stop.departureTime,
        distanceFromSource: stop.distanceFromSource
      }));

      routeDoc = await Route.create({
        name: routeName,
        stops: stopsData
      });
      console.log(`[RailRadar Sync] Seeded Route: ${routeName}`);
    }

    // C. Seed Train
    let trainDoc = await Train.findOne({ trainNumber: matchingTrainData.trainNumber });
    if (!trainDoc) {
      const coaches = generateCoaches();
      trainDoc = await Train.create({
        trainNumber: matchingTrainData.trainNumber,
        trainName: matchingTrainData.trainName,
        trainType: matchingTrainData.trainType,
        route: routeDoc._id,
        coaches
      });
      console.log(`[RailRadar Sync] Seeded Train: ${matchingTrainData.trainNumber}`);
    }

    // D. Seed Scheduled Run
    const [year, month, day] = dateStr.split('-').map(Number);
    const targetDate = new Date(year, month - 1, day);
    targetDate.setHours(0, 0, 0, 0);

    let runDoc = await ScheduledRun.findOne({ train: trainDoc._id, date: targetDate });
    if (!runDoc) {
      const routeStops = matchingTrainData.stops.map((s) => stationIdMap[s.stationCode]);
      const seats = [];

      trainDoc.coaches.forEach((coach) => {
        coach.seatsLayout.forEach((seatBlue) => {
          seats.push({
            coachId: coach.coachId,
            classType: coach.classType,
            seatNumber: seatBlue.seatNumber,
            berthType: seatBlue.berthType,
            bookedSegments: []
          });
        });
      });

      runDoc = await ScheduledRun.create({
        train: trainDoc._id,
        date: targetDate,
        routeStops,
        seats
      });
      console.log(`[RailRadar Sync] Seeded Scheduled Run for Train ${trainDoc.trainNumber} on ${dateStr}`);
    }
  } catch (error) {
    console.error('[RailRadar Sync] Error during synchronization:', error);
  }
};

// 4. Calculate dynamic simulated coordinates, speed, and status based on current time
export const getSimulatedLiveDetails = (train, stops, date, delayMinutes = 0) => {
  const now = new Date();
  const runDate = new Date(date);
  runDate.setHours(0, 0, 0, 0);

  // If the run is not today, it is either past or future
  const nowDayStr = now.toISOString().split('T')[0];
  const runDayStr = runDate.toISOString().split('T')[0];

  const sortedStops = [...stops].sort((a, b) => a.stopOrder - b.stopOrder);
  const totalStops = sortedStops.length;

  if (runDayStr > nowDayStr) {
    return {
      status: 'not_started',
      currentSpeed: 0,
      currentCoordinates: sortedStops[0].station.coordinates,
      currentStationCode: sortedStops[0].station.code,
      currentStopOrder: 1,
      etaText: `Starts at ${sortedStops[0].departureTime}`
    };
  }

  // Calculate actual arrival/departure DateTimes with delay adjustments
  const stopDateTimes = [];
  let trackingDay = new Date(runDate);
  let lastMins = -1;

  for (let i = 0; i < totalStops; i++) {
    const stop = sortedStops[i];
    let arrDate = null;
    let depDate = null;

    if (stop.arrivalTime) {
      const arrMins = getMinutesFromTime(stop.arrivalTime);
      if (lastMins !== -1 && arrMins < lastMins) {
        trackingDay.setDate(trackingDay.getDate() + 1);
      }
      arrDate = new Date(trackingDay);
      arrDate.setHours(Math.floor(arrMins / 60), arrMins % 60, 0, 0);
      // Adjust with delay
      arrDate.setMinutes(arrDate.getMinutes() + delayMinutes);
      lastMins = arrMins;
    }

    if (stop.departureTime) {
      const depMins = getMinutesFromTime(stop.departureTime);
      if (lastMins !== -1 && depMins < lastMins) {
        trackingDay.setDate(trackingDay.getDate() + 1);
      }
      depDate = new Date(trackingDay);
      depDate.setHours(Math.floor(depMins / 60), depMins % 60, 0, 0);
      // Adjust with delay
      depDate.setMinutes(depDate.getMinutes() + delayMinutes);
      lastMins = depMins;
    }

    stopDateTimes.push({
      stop,
      arrDate: arrDate || depDate, // fallback for source
      depDate: depDate || arrDate  // fallback for dest
    });
  }

  const finalDest = stopDateTimes[totalStops - 1];
  const firstSource = stopDateTimes[0];

  // A. Check if the train has finished its journey
  if (now > finalDest.arrDate) {
    return {
      status: 'reached',
      currentSpeed: 0,
      currentCoordinates: finalDest.stop.station.coordinates,
      currentStationCode: finalDest.stop.station.code,
      currentStopOrder: totalStops,
      etaText: 'Journey Completed'
    };
  }

  // B. Check if the train hasn't started yet
  if (now < firstSource.depDate) {
    return {
      status: 'not_started',
      currentSpeed: 0,
      currentCoordinates: firstSource.stop.station.coordinates,
      currentStationCode: firstSource.stop.station.code,
      currentStopOrder: 1,
      etaText: `Expected departure at ${firstSource.stop.departureTime}`
    };
  }

  // C. Train is currently running/in-transit
  // Find where the train is currently
  for (let i = 0; i < totalStops - 1; i++) {
    const currentLeg = stopDateTimes[i];
    const nextLeg = stopDateTimes[i + 1];

    // Check if halted at current station
    if (now >= currentLeg.arrDate && now <= currentLeg.depDate) {
      return {
        status: 'running',
        currentSpeed: 0,
        currentCoordinates: currentLeg.stop.station.coordinates,
        currentStationCode: currentLeg.stop.station.code,
        currentStopOrder: currentLeg.stop.stopOrder,
        etaText: `Halted at ${currentLeg.stop.station.name}. Departs at ${currentLeg.stop.departureTime}`
      };
    }

    // Check if in-transit between current station and next station
    if (now > currentLeg.depDate && now < nextLeg.arrDate) {
      const duration = nextLeg.arrDate.getTime() - currentLeg.depDate.getTime();
      const elapsed = now.getTime() - currentLeg.depDate.getTime();
      const fraction = elapsed / duration;

      // Linear interpolation of coordinates
      const currentCoords = currentLeg.stop.station.coordinates;
      const nextCoords = nextLeg.stop.station.coordinates;

      const lat = currentCoords.latitude + fraction * (nextCoords.latitude - currentCoords.latitude);
      const lon = currentCoords.longitude + fraction * (nextCoords.longitude - currentCoords.longitude);

      // Generate a speed between 85 and 115 km/h
      const speed = Math.floor(90 + Math.sin(now.getTime() / 60000) * 15);

      return {
        status: 'running',
        currentSpeed: speed,
        currentCoordinates: {
          latitude: Number(lat.toFixed(4)),
          longitude: Number(lon.toFixed(4))
        },
        currentStationCode: currentLeg.stop.station.code,
        currentStopOrder: currentLeg.stop.stopOrder,
        etaText: `In transit to ${nextLeg.stop.station.name}. ETA: ${nextLeg.stop.arrivalTime}`
      };
    }
  }

  // Fallback default
  return {
    status: 'running',
    currentSpeed: 60,
    currentCoordinates: firstSource.stop.station.coordinates,
    currentStationCode: firstSource.stop.station.code,
    currentStopOrder: 1,
    etaText: 'Running status updated'
  };
};
