import mongoose from 'mongoose';

const routeStopSchema = new mongoose.Schema({
  station: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Station',
    required: [true, 'Station reference is required']
  },
  stopOrder: {
    type: Number,
    required: [true, 'Stop order is required'],
    min: [1, 'Stop order must be at least 1']
  },
  arrivalTime: {
    type: String, // format "HH:MM", can be null for the first station
    default: null
  },
  departureTime: {
    type: String, // format "HH:MM", can be null for the last station
    default: null
  },
  distanceFromSource: {
    type: Number, // cumulative distance in km
    required: [true, 'Distance from source is required'],
    min: [0, 'Distance must be non-negative']
  }
});

const routeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Route name is required'],
    trim: true
  },
  stops: {
    type: [routeStopSchema],
    validate: {
      validator: function(stops) {
        return stops && stops.length >= 2;
      },
      message: 'A route must have at least 2 stops (source and destination).'
    }
  }
}, {
  timestamps: true
});

const Route = mongoose.model('Route', routeSchema);
export default Route;
