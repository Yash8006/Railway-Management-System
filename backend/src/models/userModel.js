import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const coPassengerSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please add a co-passenger name'],
    trim: true,
  },
  age: {
    type: Number,
    required: [true, 'Please add an age'],
    min: [0, 'Age must be positive'],
  },
  gender: {
    type: String,
    required: [true, 'Please specify gender'],
    enum: ['male', 'female', 'other'],
  },
  idProofType: {
    type: String,
    required: [true, 'Please specify ID proof type'],
    enum: ['Aadhaar', 'Passport', 'PAN', 'Voter ID', 'Driving License'],
  },
  idProofNumber: {
    type: String,
    required: [true, 'Please specify ID proof number'],
    trim: true,
  }
});

const walletTransactionSchema = new mongoose.Schema({
  amount: {
    type: Number,
    required: true,
  },
  type: {
    type: String,
    required: true,
    enum: ['credit', 'debit'],
  },
  description: {
    type: String,
    required: true,
    trim: true,
  },
  date: {
    type: Date,
    default: Date.now,
  }
});

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please add a name'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Please add an email'],
      unique: true,
      trim: true,
      lowercase: true,
      match: [
        /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
        'Please add a valid email',
      ],
    },
    password: {
      type: String,
      required: [true, 'Please add a password'],
      minlength: [6, 'Password must be at least 6 characters'],
    },
    role: {
      type: String,
      enum: {
        values: ['passenger', 'admin', 'station_master'],
        message: '{VALUE} is not a valid role. Allowed roles are: passenger, admin, station_master',
      },
      default: 'passenger',
    },
    savedCoPassengers: [coPassengerSchema],
    walletBalance: {
      type: Number,
      default: 0,
      min: [0, 'Wallet balance cannot be negative'],
    },
    walletTransactions: [walletTransactionSchema],
  },
  {
    timestamps: true,
  }
);

// Encrypt password using bcrypt before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    return next();
  }

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Match user entered password to hashed password in database
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model('User', userSchema);
export default User;
