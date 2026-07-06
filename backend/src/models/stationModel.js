import mongoose from 'mongoose';

const stationSchema = new mongoose.Schema({
  code: {
    type: String,
    required: [true, 'Station code is required'],
    unique: true,
    uppercase: true,
    trim: true,
    minlength: [2, 'Station code must be at least 2 characters'],
    maxlength: [6, 'Station code cannot exceed 6 characters']
  },
  name: {
    type: String,
    required: [true, 'Station name is required'],
    trim: true
  },
  city: {
    type: String,
    required: [true, 'City name is required'],
    trim: true
  },
  coordinates: {
    latitude: {
      type: Number,
      required: [true, 'Latitude is required']
    },
    longitude: {
      type: Number,
      required: [true, 'Longitude is required']
    }
  },
  zone: {
    type: String,
    required: [true, 'Railway zone is required'],
    trim: true,
    uppercase: true
  }
}, {
  timestamps: true
});

const Station = mongoose.model('Station', stationSchema);
export default Station;
