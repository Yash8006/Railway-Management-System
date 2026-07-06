import express from 'express';
const router = express.Router();
import {
  registerUser,
  loginUser,
  getUserProfile,
  updateUserProfile,
  getCoPassengers,
  addCoPassenger,
  updateCoPassenger,
  deleteCoPassenger,
  getWalletDetails,
  addWalletFunds
} from '../controllers/userController.js';
import { protect } from '../middleware/authMiddleware.js';

// Public routes
router.post('/register', registerUser);
router.post('/login', loginUser);

// Protected routes (require JWT verification)
router.route('/profile')
  .get(protect, getUserProfile)
  .put(protect, updateUserProfile);

// Co-passengers CRUD routes
router.route('/co-passengers')
  .get(protect, getCoPassengers)
  .post(protect, addCoPassenger);

router.route('/co-passengers/:id')
  .put(protect, updateCoPassenger)
  .delete(protect, deleteCoPassenger);

// Wallet routes
router.route('/wallet')
  .get(protect, getWalletDetails);

router.route('/wallet/deposit')
  .post(protect, addWalletFunds);

export default router;
