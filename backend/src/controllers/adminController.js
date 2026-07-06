import Station from '../models/stationModel.js';
import Route from '../models/routeModel.js';
import Train from '../models/trainModel.js';
import Schedule from '../models/scheduleModel.js';
import ScheduledRun from '../models/scheduledRunModel.js';

// ==========================================
// 1. STATION REGISTRY
// ==========================================

export const createStation = async (req, res) => {
  try {
    const { code, name, city, coordinates, zone } = req.body;
    if (!code || !name || !city || !coordinates || !zone) {
      return res.status(400).json({ success: false, message: 'Please provide all station details' });
    }

    const stationExists = await Station.findOne({ code: code.toUpperCase() });
    if (stationExists) {
      return res.status(400).json({ success: false, message: `Station with code ${code.toUpperCase()} already exists` });
    }

    const station = await Station.create({ code, name, city, coordinates, zone });
    return res.status(201).json({ success: true, data: station });
  } catch (error) {
    console.error('Create station error:', error.message);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ success: false, message: Object.values(error.errors).map(e => e.message).join(', ') });
    }
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const updateStation = async (req, res) => {
  try {
    const station = await Station.findById(req.params.id);
    if (!station) {
      return res.status(404).json({ success: false, message: 'Station not found' });
    }

    station.code = req.body.code ? req.body.code.toUpperCase() : station.code;
    station.name = req.body.name || station.name;
    station.city = req.body.city || station.city;
    station.zone = req.body.zone || station.zone;
    if (req.body.coordinates) {
      station.coordinates = {
        latitude: req.body.coordinates.latitude !== undefined ? req.body.coordinates.latitude : station.coordinates.latitude,
        longitude: req.body.coordinates.longitude !== undefined ? req.body.coordinates.longitude : station.coordinates.longitude
      };
    }

    const updated = await station.save();
    return res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Update station error:', error.message);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ success: false, message: Object.values(error.errors).map(e => e.message).join(', ') });
    }
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const deleteStation = async (req, res) => {
  try {
    const station = await Station.findByIdAndDelete(req.params.id);
    if (!station) {
      return res.status(404).json({ success: false, message: 'Station not found' });
    }
    return res.json({ success: true, message: 'Station deleted successfully' });
  } catch (error) {
    console.error('Delete station error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const getStations = async (req, res) => {
  try {
    const stations = await Station.find({}).sort({ code: 1 });
    return res.json({ success: true, data: stations });
  } catch (error) {
    console.error('Get stations error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ==========================================
// 2. ROUTE BUILDER
// ==========================================

export const createRoute = async (req, res) => {
  try {
    const { name, stops } = req.body;
    if (!name || !stops) {
      return res.status(400).json({ success: false, message: 'Please provide route name and stops details' });
    }

    const route = await Route.create({ name, stops });
    return res.status(201).json({ success: true, data: route });
  } catch (error) {
    console.error('Create route error:', error.message);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ success: false, message: Object.values(error.errors).map(e => e.message).join(', ') });
    }
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const updateRoute = async (req, res) => {
  try {
    const route = await Route.findById(req.params.id);
    if (!route) {
      return res.status(404).json({ success: false, message: 'Route not found' });
    }

    route.name = req.body.name || route.name;
    if (req.body.stops) {
      route.stops = req.body.stops;
    }

    const updated = await route.save();
    return res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Update route error:', error.message);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ success: false, message: Object.values(error.errors).map(e => e.message).join(', ') });
    }
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const deleteRoute = async (req, res) => {
  try {
    const route = await Route.findByIdAndDelete(req.params.id);
    if (!route) {
      return res.status(404).json({ success: false, message: 'Route not found' });
    }
    return res.json({ success: true, message: 'Route deleted successfully' });
  } catch (error) {
    console.error('Delete route error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const getRoutes = async (req, res) => {
  try {
    const routes = await Route.find({}).populate('stops.station').sort({ name: 1 });
    return res.json({ success: true, data: routes });
  } catch (error) {
    console.error('Get routes error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ==========================================
// 3. TRAIN CONFIGURATOR
// ==========================================

export const createTrain = async (req, res) => {
  try {
    const { trainNumber, trainName, route, coaches } = req.body;
    if (!trainNumber || !trainName || !route || !coaches) {
      return res.status(400).json({ success: false, message: 'Please provide all train details' });
    }

    const trainExists = await Train.findOne({ trainNumber });
    if (trainExists) {
      return res.status(400).json({ success: false, message: `Train with number ${trainNumber} already exists` });
    }

    const train = await Train.create({ trainNumber, trainName, route, coaches });
    return res.status(201).json({ success: true, data: train });
  } catch (error) {
    console.error('Create train error:', error.message);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ success: false, message: Object.values(error.errors).map(e => e.message).join(', ') });
    }
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const updateTrain = async (req, res) => {
  try {
    const train = await Train.findById(req.params.id);
    if (!train) {
      return res.status(404).json({ success: false, message: 'Train not found' });
    }

    train.trainNumber = req.body.trainNumber || train.trainNumber;
    train.trainName = req.body.trainName || train.trainName;
    train.route = req.body.route || train.route;
    if (req.body.coaches) {
      train.coaches = req.body.coaches;
    }

    const updated = await train.save();
    return res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Update train error:', error.message);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ success: false, message: Object.values(error.errors).map(e => e.message).join(', ') });
    }
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const deleteTrain = async (req, res) => {
  try {
    const train = await Train.findByIdAndDelete(req.params.id);
    if (!train) {
      return res.status(404).json({ success: false, message: 'Train not found' });
    }
    return res.json({ success: true, message: 'Train deleted successfully' });
  } catch (error) {
    console.error('Delete train error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const getTrains = async (req, res) => {
  try {
    const trains = await Train.find({}).populate('route').sort({ trainNumber: 1 });
    return res.json({ success: true, data: trains });
  } catch (error) {
    console.error('Get trains error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ==========================================
// 4. SCHEDULE ENGINE & RUNS INSTANTIATION
// ==========================================

// Helper to calculate run dates based on schedule frequency
const getRunDatesInRange = (startDate, endDate, frequency, runningDays, customDates) => {
  const dates = [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  start.setHours(0,0,0,0);
  end.setHours(23,59,59,999);

  if (frequency === 'Daily') {
    let curr = new Date(start);
    while (curr <= end) {
      dates.push(new Date(curr));
      curr.setDate(curr.getDate() + 1);
    }
  } else if (frequency === 'Weekly') {
    let curr = new Date(start);
    while (curr <= end) {
      const day = curr.getDay(); // 0 Sunday, 1 Monday, etc.
      if (runningDays.includes(day)) {
        dates.push(new Date(curr));
      }
      curr.setDate(curr.getDate() + 1);
    }
  } else if (frequency === 'Custom') {
    if (customDates) {
      customDates.forEach(d => {
        const dateObj = new Date(d);
        dateObj.setHours(0,0,0,0);
        if (dateObj >= start && dateObj <= end) {
          dates.push(dateObj);
        }
      });
    }
  }

  return dates;
};

// Core helper to instantiate scheduled runs for a given schedule in a N-day timeframe
export const instantiateRunsForSchedule = async (scheduleId, daysAhead = 30) => {
  const schedule = await Schedule.findById(scheduleId);
  if (!schedule) return { success: false, message: 'Schedule definition not found' };

  const train = await Train.findById(schedule.train).populate('route');
  if (!train) return { success: false, message: 'Associated train not found' };

  const route = train.route;
  if (!route) return { success: false, message: 'Train has no route assigned' };

  const today = new Date();
  today.setHours(0,0,0,0);
  
  const calcStart = schedule.startDate > today ? schedule.startDate : today;
  
  const futureLimit = new Date(today);
  futureLimit.setDate(futureLimit.getDate() + daysAhead);
  const calcEnd = schedule.endDate < futureLimit ? schedule.endDate : futureLimit;

  if (calcStart > calcEnd) {
    return { success: true, count: 0, message: 'No run dates in range' };
  }

  const runDates = getRunDatesInRange(calcStart, calcEnd, schedule.frequency, schedule.runningDays, schedule.customDates);

  // Station ID array in stopOrder
  const sortedStops = [...route.stops].sort((a, b) => a.stopOrder - b.stopOrder);
  const routeStops = sortedStops.map(s => s.station);

  let createdCount = 0;

  for (const runDate of runDates) {
    const runDateMidnight = new Date(runDate);
    runDateMidnight.setHours(0,0,0,0);

    // Skip if run already exists
    const runExists = await ScheduledRun.findOne({ train: train._id, date: runDateMidnight });
    if (runExists) continue;

    // Generate physical seats from coach layouts
    const seats = [];
    train.coaches.forEach(coach => {
      coach.seatsLayout.forEach(seatBlue => {
        seats.push({
          coachId: coach.coachId,
          classType: coach.classType,
          seatNumber: seatBlue.seatNumber,
          berthType: seatBlue.berthType,
          bookedSegments: []
        });
      });
    });

    await ScheduledRun.create({
      train: train._id,
      date: runDateMidnight,
      routeStops,
      seats
    });

    createdCount++;
  }

  return { success: true, count: createdCount };
};

export const createSchedule = async (req, res) => {
  try {
    const { train, frequency, runningDays, customDates, startDate, endDate } = req.body;
    if (!train || !frequency || !startDate || !endDate) {
      return res.status(400).json({ success: false, message: 'Please provide train, frequency, startDate, and endDate' });
    }

    // Check if schedule already exists for train
    const scheduleExists = await Schedule.findOne({ train });
    if (scheduleExists) {
      return res.status(400).json({ success: false, message: 'Schedule already exists for this train' });
    }

    const schedule = await Schedule.create({ train, frequency, runningDays, customDates, startDate, endDate });
    
    // Auto-instantiate runs for the next 30 days
    const instantiationResult = await instantiateRunsForSchedule(schedule._id, 30);

    return res.status(201).json({
      success: true,
      message: `Schedule created successfully. Instantiated ${instantiationResult.count} scheduled runs for upcoming dates.`,
      data: schedule
    });
  } catch (error) {
    console.error('Create schedule error:', error.message);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ success: false, message: Object.values(error.errors).map(e => e.message).join(', ') });
    }
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const updateSchedule = async (req, res) => {
  try {
    const schedule = await Schedule.findById(req.params.id);
    if (!schedule) {
      return res.status(404).json({ success: false, message: 'Schedule not found' });
    }

    schedule.frequency = req.body.frequency || schedule.frequency;
    schedule.runningDays = req.body.runningDays !== undefined ? req.body.runningDays : schedule.runningDays;
    schedule.customDates = req.body.customDates !== undefined ? req.body.customDates : schedule.customDates;
    schedule.startDate = req.body.startDate || schedule.startDate;
    schedule.endDate = req.body.endDate || schedule.endDate;

    const updated = await schedule.save();

    // Re-trigger run instantiation for updated rules
    const instantiationResult = await instantiateRunsForSchedule(updated._id, 30);

    return res.json({
      success: true,
      message: `Schedule updated successfully. Instantiated ${instantiationResult.count} additional runs.`,
      data: updated
    });
  } catch (error) {
    console.error('Update schedule error:', error.message);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ success: false, message: Object.values(error.errors).map(e => e.message).join(', ') });
    }
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const deleteSchedule = async (req, res) => {
  try {
    const schedule = await Schedule.findByIdAndDelete(req.params.id);
    if (!schedule) {
      return res.status(404).json({ success: false, message: 'Schedule not found' });
    }
    return res.json({ success: true, message: 'Schedule deleted successfully' });
  } catch (error) {
    console.error('Delete schedule error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const getSchedules = async (req, res) => {
  try {
    const schedules = await Schedule.find({}).populate('train').sort({ createdAt: -1 });
    return res.json({ success: true, data: schedules });
  } catch (error) {
    console.error('Get schedules error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Get scheduled runs list
// @route   GET /api/admin/scheduled-runs
// @access  Private (Admin)
export const getScheduledRuns = async (req, res) => {
  try {
    const runs = await ScheduledRun.find({})
      .populate('train')
      .populate('routeStops')
      .sort({ date: 1 });
    return res.json({ success: true, data: runs });
  } catch (error) {
    console.error('Get scheduled runs error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Manually trigger instantiation of scheduled runs
// @route   POST /api/admin/schedules/:id/instantiate
// @access  Private (Admin)
export const instantiateScheduledRunsEndpoint = async (req, res) => {
  try {
    const { days } = req.body;
    const daysLimit = days ? Number(days) : 30;

    const result = await instantiateRunsForSchedule(req.params.id, daysLimit);
    if (!result.success) {
      return res.status(400).json({ success: false, message: result.message });
    }

    return res.json({
      success: true,
      message: `Instantiation complete. Created ${result.count} scheduled runs for the next ${daysLimit} days.`
    });
  } catch (error) {
    console.error('Manual instantiation error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};
