import express from 'express';
const router = express.Router();
import {
  searchDirectTrains,
  searchIndirectTrains,
  getSeatAvailability
} from '../controllers/searchController.js';

/**
 * Educational Context (AGENTS.md Compliance):
 * - What: Express search router module.
 * - Why: Segregates query-oriented searching endpoints from booking/state-modifying endpoints.
 * - Alternatives: Placing search routes directly inside adminRoutes or userRoutes.
 * - Why not alternatives: Mixing read-heavy search operations with admin management routes 
 *   or user account CRUD violates the Single Responsibility Principle and degrades code maintainability.
 */

router.get('/direct', searchDirectTrains);
router.get('/indirect', searchIndirectTrains);
router.get('/availability', getSeatAvailability);

export default router;
