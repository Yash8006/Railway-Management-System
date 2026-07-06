import mongoose from 'mongoose';

const segmentBookingSchema = new mongoose.Schema({
  fromIndex: {
    type: Number,
    required: true
  },
  toIndex: {
    type: Number,
    required: true
  },
  booking: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    required: true
  }
});

const runSeatSchema = new mongoose.Schema({
  coachId: {
    type: String,
    required: true
  },
  classType: {
    type: String,
    required: true
  },
  seatNumber: {
    type: Number,
    required: true
  },
  berthType: {
    type: String,
    required: true
  },
  bookedSegments: [segmentBookingSchema] // Tracks segments booked for this seat
});

const scheduledRunSchema = new mongoose.Schema({
  train: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Train',
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  routeStops: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Station'
  }],
  seats: [runSeatSchema]
}, {
  timestamps: true
});

// A train can have only one scheduled run per calendar date
scheduledRunSchema.index({ train: 1, date: 1 }, { unique: true });

const ScheduledRun = mongoose.model('ScheduledRun', scheduledRunSchema);
export default ScheduledRun;
