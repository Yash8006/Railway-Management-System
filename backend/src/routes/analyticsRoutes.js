import express from 'express';
const router = express.Router();
import {
  getSalesAnalytics,
  getOccupancyAnalytics,
  getDemographicsAnalytics
} from '../controllers/analyticsController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

/**
 * Educational Context (AGENTS.md Compliance):
 * - What: Express analytics routes mapping.
 * - Why: Secures operational dashboard analytical aggregations strictly to admin users.
 * - Alternatives: Merging analytics routes directly inside the base admin routes.
 * - Why not alternatives: Analytics represents a unique business domain. Segregating these
 *   operations simplifies API routing, documentation, and endpoint management.
 */

router.use(protect);
router.use(authorize('admin'));

router.get('/sales', getSalesAnalytics);
router.get('/occupancy', getOccupancyAnalytics);
router.get('/demographics', getDemographicsAnalytics);

export default router;
