import mongoose from 'mongoose';

const berthBlueprintSchema = new mongoose.Schema({
  seatNumber: {
    type: Number,
    required: [true, 'Seat number is required']
  },
  berthType: {
    type: String,
    required: [true, 'Berth type is required'],
    enum: ['Lower', 'Middle', 'Upper', 'Side Lower', 'Side Upper']
  }
});

const coachBlueprintSchema = new mongoose.Schema({
  coachId: {
    type: String, // e.g. "A1", "B1", "S1"
    required: [true, 'Coach ID is required'],
    trim: true,
    uppercase: true
  },
  classType: {
    type: String,
    required: [true, 'Class type is required'],
    enum: ['Sleeper', 'AC 3 Tier', 'AC 2 Tier', 'First Class']
  },
  totalSeats: {
    type: Number,
    required: [true, 'Total seats count is required'],
    min: [1, 'Total seats must be at least 1']
  },
  seatsLayout: [berthBlueprintSchema]
});

const trainSchema = new mongoose.Schema({
  trainNumber: {
    type: String,
    required: [true, 'Train number is required'],
    unique: true,
    trim: true
  },
  trainName: {
    type: String,
    required: [true, 'Train name is required'],
    trim: true
  },
  route: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Route',
    required: [true, 'Route reference is required']
  },
  /**
   * Educational Context (AGENTS.md):
   * - What: Train type classification ('Express', 'Passenger', 'Superfast').
   * - Why: Allows users to filter trains by speed, stopping frequency, and fare structures.
   * - Alternatives: Creating a separate TrainType Mongoose model or using simple tags.
   * - Why not alternatives: A separate collection is overkill and adds query overhead (requires joins/populates).
   *   Using String enum validation directly in the Schema is type-safe, simple, and has zero performance cost.
   */
  trainType: {
    type: String,
    required: [true, 'Train type is required'],
    enum: ['Express', 'Passenger', 'Superfast'],
    default: 'Express'
  },
  coaches: {
    type: [coachBlueprintSchema],
    validate: {
      validator: function(coaches) {
        return coaches && coaches.length > 0;
      },
      message: 'A train must have at least one coach.'
    }
  }
}, {
  timestamps: true
});

const Train = mongoose.model('Train', trainSchema);
export default Train;
