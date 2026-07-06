import mongoose from 'mongoose';

const scheduleSchema = new mongoose.Schema({
  train: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Train',
    required: [true, 'Train reference is required'],
    unique: true // A train can have one active schedule definition
  },
  frequency: {
    type: String,
    required: [true, 'Frequency is required'],
    enum: ['Daily', 'Weekly', 'Custom']
  },
  runningDays: {
    type: [Number], // 0 for Sunday, 1 for Monday, ..., 6 for Saturday
    validate: {
      validator: function(val) {
        if (this.frequency === 'Weekly') {
          return val && val.length > 0;
        }
        return true;
      },
      message: 'Weekly frequency requires at least one running day (0-6).'
    }
  },
  customDates: {
    type: [Date],
    validate: {
      validator: function(val) {
        if (this.frequency === 'Custom') {
          return val && val.length > 0;
        }
        return true;
      },
      message: 'Custom frequency requires at least one running date.'
    }
  },
  startDate: {
    type: Date,
    required: [true, 'Start date is required']
  },
  endDate: {
    type: Date,
    required: [true, 'End date is required'],
    validate: {
      validator: function(val) {
        return this.startDate <= val;
      },
      message: 'End date must be on or after start date.'
    }
  }
}, {
  timestamps: true
});

const Schedule = mongoose.model('Schedule', scheduleSchema);
export default Schedule;
