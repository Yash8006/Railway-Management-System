import express from 'express';
const router = express.Router();
import {
  createStation,
  updateStation,
  deleteStation,
  getStations,
  createRoute,
  updateRoute,
  deleteRoute,
  getRoutes,
  createTrain,
  updateTrain,
  deleteTrain,
  getTrains,
  createSchedule,
  updateSchedule,
  deleteSchedule,
  getSchedules,
  getScheduledRuns,
  instantiateScheduledRunsEndpoint
} from '../controllers/adminController.js';
import { protect, admin } from '../middleware/authMiddleware.js';

// Station Registry (Write routes restricted to Admin; Read route is public)
router.route('/stations')
  .get(getStations) // Public
  .post(protect, admin, createStation);

router.route('/stations/:id')
  .put(protect, admin, updateStation)
  .delete(protect, admin, deleteStation);

// Route Builder (Admin-only)
router.route('/routes')
  .get(protect, admin, getRoutes)
  .post(protect, admin, createRoute);

router.route('/routes/:id')
  .put(protect, admin, updateRoute)
  .delete(protect, admin, deleteRoute);

// Train Configurator (Admin-only)
router.route('/trains')
  .get(protect, admin, getTrains)
  .post(protect, admin, createTrain);

router.route('/trains/:id')
  .put(protect, admin, updateTrain)
  .delete(protect, admin, deleteTrain);

// Schedule Engine (Admin-only)
router.route('/schedules')
  .get(protect, admin, getSchedules)
  .post(protect, admin, createSchedule);

router.route('/schedules/:id')
  .put(protect, admin, updateSchedule)
  .delete(protect, admin, deleteSchedule);

router.post('/schedules/:id/instantiate', protect, admin, instantiateScheduledRunsEndpoint);

// Scheduled Runs List (Admin-only)
router.get('/scheduled-runs', protect, admin, getScheduledRuns);

export default router;
