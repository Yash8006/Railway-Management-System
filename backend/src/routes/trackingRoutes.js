import express from 'express';
const router = express.Router();
import {
  updateLiveStatus,
  getTrainLiveStatus
} from '../controllers/trackingController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

/**
 * Educational Context (AGENTS.md Compliance):
 * - What: Express live tracking routes mapping.
 * - Why: Exposes public query and restricted update interfaces, locking update access to 
 *   Station Masters and Admins.
 * - Alternatives: Merging tracking routes directly into adminRoutes or userRoutes.
 * - Why not alternatives: Violates routing modularity. Tracking is a specific sub-domain
 *   combining both public queries (passengers) and restricted updates (station masters).
 */

router.get('/status', getTrainLiveStatus);
router.post('/update/:runId', protect, authorize('admin', 'station_master'), updateLiveStatus);

export default router;
