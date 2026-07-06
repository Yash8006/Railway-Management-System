import mongoose from 'mongoose';

/**
 * Educational Context (AGENTS.md Compliance):
 * ==========================================
 * 1. WHAT we are using:
 *    - An isolated Mongoose schema/model `LiveStatus` referencing `ScheduledRun`.
 *    - Embedded sub-documents for platform mappings (`platformNumbers`).
 * 
 * 2. WHY we are using it:
 *    - Keeping live tracking data in a separate collection prevents high-frequency updates from locking
 *      the critical booking/scheduled runs documents, improving transactional stability.
 * 
 * 3. ALTERNATIVES:
 *    - Embedding live tracking arrays directly inside `ScheduledRun`.
 *    - Storing live updates strictly in a volatile fast in-memory key-value database like Redis.
 * 
 * 4. WHY WE ARE NOT USING ALTERNATIVES:
 *    - Embedding fields inside `ScheduledRun` would cause high write locking conflicts on the collections
 *      shared by ticket booking operations, slowing down transactions.
 *    - A Redis-only architecture lacks persistent history. If the cache clears or restarts, all current run
 *      tracking coordinates, platformLocator, and delays are permanently lost.
 */

const platformMappingSchema = new mongoose.Schema({
  station: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Station',
    required: true
  },
  platform: {
    type: String,
    required: true
  }
});

const liveStatusSchema = new mongoose.Schema({
  scheduledRun: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ScheduledRun',
    required: true,
    unique: true
  },
  status: {
    type: String,
    enum: ['not_started', 'running', 'reached', 'cancelled', 'diverted'],
    default: 'not_started'
  },
  currentStation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Station',
    default: null
  },
  currentStopOrder: {
    type: Number,
    default: 0
  },
  delayMinutes: {
    type: Number,
    default: 0
  },
  platformNumbers: [platformMappingSchema],
  emergencyAlerts: [String]
}, {
  timestamps: true
});

const LiveStatus = mongoose.model('LiveStatus', liveStatusSchema);
export default LiveStatus;
