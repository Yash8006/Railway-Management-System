import jwt from 'jsonwebtoken';
import User from '../models/userModel.js';

// Helper function to generate JWT
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'supersecretkey12345', {
    expiresIn: '30d',
  });
};

// @desc    Register a new user (passenger by default)
// @route   POST /api/users/register
// @access  Public
export const registerUser = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Please provide name, email and password' });
    }

    // Check if user already exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ success: false, message: 'User already exists with this email' });
    }

    // Normalize role if provided (e.g., 'Station Master' or 'station master' -> 'station_master')
    let normalizedRole = 'passenger';
    if (role) {
      normalizedRole = role.toLowerCase().trim().replace(/\s+/g, '_');
    }

    // Create user. Note: pre-save middleware in userModel will automatically hash the password.
    const user = await User.create({
      name,
      email,
      password,
      role: normalizedRole
    });

    if (user) {
      return res.status(201).json({
        success: true,
        data: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          token: generateToken(user._id)
        }
      });
    } else {
      return res.status(400).json({ success: false, message: 'Invalid user data' });
    }
  } catch (error) {
    console.error('Register user error:', error.message);
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: Object.values(error.errors).map((val) => val.message).join(', '),
      });
    }
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Auth user & get token (Login)
// @route   POST /api/users/login
// @access  Public
export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Please provide email and password' });
    }

    // Find user by email
    const user = await User.findOne({ email });

    // Verify password if user exists
    if (user && (await user.matchPassword(password))) {
      return res.json({
        success: true,
        data: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          token: generateToken(user._id)
        }
      });
    } else {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }
  } catch (error) {
    console.error('Login user error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Get user profile
// @route   GET /api/users/profile
// @access  Private
export const getUserProfile = async (req, res) => {
  try {
    // req.user was populated by the protect middleware
    const user = await User.findById(req.user._id);

    if (user) {
      return res.json({
        success: true,
        data: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role
        }
      });
    } else {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
  } catch (error) {
    console.error('Get user profile error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Update user profile
// @route   PUT /api/users/profile
// @access  Private
export const updateUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (user) {
      user.name = req.body.name || user.name;
      user.email = req.body.email || user.email;

      if (req.body.password) {
        user.password = req.body.password;
      }

      const updatedUser = await user.save();

      return res.json({
        success: true,
        data: {
          _id: updatedUser._id,
          name: updatedUser.name,
          email: updatedUser.email,
          role: updatedUser.role,
        },
      });
    } else {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
  } catch (error) {
    console.error('Update user profile error:', error.message);
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: Object.values(error.errors).map((val) => val.message).join(', '),
      });
    }
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Get saved co-passengers
// @route   GET /api/users/co-passengers
// @access  Private
export const getCoPassengers = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('savedCoPassengers');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    return res.json({ success: true, data: user.savedCoPassengers });
  } catch (error) {
    console.error('Get co-passengers error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Add a saved co-passenger
// @route   POST /api/users/co-passengers
// @access  Private
export const addCoPassenger = async (req, res) => {
  try {
    const { name, age, gender, idProofType, idProofNumber } = req.body;

    if (!name || age === undefined || !gender || !idProofType || !idProofNumber) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all details: name, age, gender, idProofType, idProofNumber',
      });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    user.savedCoPassengers.push({ name, age, gender, idProofType, idProofNumber });
    await user.save();

    return res.status(201).json({
      success: true,
      data: user.savedCoPassengers[user.savedCoPassengers.length - 1],
    });
  } catch (error) {
    console.error('Add co-passenger error:', error.message);
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: Object.values(error.errors).map((val) => val.message).join(', '),
      });
    }
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Update a saved co-passenger
// @route   PUT /api/users/co-passengers/:id
// @access  Private
export const updateCoPassenger = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const coPassenger = user.savedCoPassengers.id(req.params.id);
    if (!coPassenger) {
      return res.status(404).json({ success: false, message: 'Co-passenger not found' });
    }

    coPassenger.name = req.body.name || coPassenger.name;
    coPassenger.age = req.body.age !== undefined ? req.body.age : coPassenger.age;
    coPassenger.gender = req.body.gender || coPassenger.gender;
    coPassenger.idProofType = req.body.idProofType || coPassenger.idProofType;
    coPassenger.idProofNumber = req.body.idProofNumber || coPassenger.idProofNumber;

    await user.save();

    return res.json({ success: true, data: coPassenger });
  } catch (error) {
    console.error('Update co-passenger error:', error.message);
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: Object.values(error.errors).map((val) => val.message).join(', '),
      });
    }
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Delete a saved co-passenger
// @route   DELETE /api/users/co-passengers/:id
// @access  Private
export const deleteCoPassenger = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const coPassenger = user.savedCoPassengers.id(req.params.id);
    if (!coPassenger) {
      return res.status(404).json({ success: false, message: 'Co-passenger not found' });
    }

    user.savedCoPassengers.pull(req.params.id);
    await user.save();

    return res.json({ success: true, message: 'Co-passenger deleted successfully' });
  } catch (error) {
    console.error('Delete co-passenger error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Get RMS wallet details
// @route   GET /api/users/wallet
// @access  Private
export const getWalletDetails = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('walletBalance walletTransactions');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    return res.json({
      success: true,
      data: {
        balance: user.walletBalance,
        transactions: user.walletTransactions,
      },
    });
  } catch (error) {
    console.error('Get wallet error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Add funds to RMS wallet
// @route   POST /api/users/wallet/deposit
// @access  Private
export const addWalletFunds = async (req, res) => {
  try {
    const { amount } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Please provide a valid deposit amount greater than 0' });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    user.walletBalance += Number(amount);
    user.walletTransactions.push({
      amount: Number(amount),
      type: 'credit',
      description: 'Funds deposited via Payment Gateway Simulator',
    });

    await user.save();

    return res.json({
      success: true,
      data: {
        balance: user.walletBalance,
        transactions: user.walletTransactions[user.walletTransactions.length - 1],
      },
    });
  } catch (error) {
    console.error('Wallet deposit error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};
