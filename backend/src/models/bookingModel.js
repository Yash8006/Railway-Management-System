import mongoose from 'mongoose';

const passengerDetailSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Passenger name is required'],
    trim: true,
  },
  age: {
    type: Number,
    required: [true, 'Passenger age is required'],
    min: [0, 'Age must be positive'],
  },
  gender: {
    type: String,
    required: [true, 'Passenger gender is required'],
    enum: ['male', 'female', 'other'],
  },
  seatNumber: {
    type: String,
    default: 'Awaited',
  },
  berthType: {
    type: String,
    default: 'Awaited',
  },
  isDisabled: {
    type: Boolean,
    default: false,
  }
});

const bookingSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  pnr: {
    type: String,
    required: true,
    unique: true,
    minlength: 10,
    maxlength: 10,
  },
  trainNumber: {
    type: String,
    required: [true, 'Train number is required'],
    trim: true,
  },
  trainName: {
    type: String,
    required: [true, 'Train name is required'],
    trim: true,
  },
  sourceStation: {
    type: String,
    required: [true, 'Source station is required'],
    trim: true,
  },
  destinationStation: {
    type: String,
    required: [true, 'Destination station is required'],
    trim: true,
  },
  classType: {
    type: String,
    required: [true, 'Class type is required (e.g. Sleeper, AC 3 Tier)'],
    trim: true,
  },
  quota: {
    type: String,
    enum: ['GN', 'TQ', 'LD', 'SR'],
    default: 'GN',
  },
  fare: {
    type: Number,
    required: true,
    min: [0, 'Fare cannot be negative'],
  },
  status: {
    type: String,
    enum: ['confirmed', 'rac', 'waitlisted', 'cancelled'],
    default: 'confirmed',
  },
  passengers: [passengerDetailSchema],
  dateOfJourney: {
    type: Date,
    required: [true, 'Date of journey is required'],
  }
}, {
  timestamps: true,
});

const Booking = mongoose.model('Booking', bookingSchema);
export default Booking;
