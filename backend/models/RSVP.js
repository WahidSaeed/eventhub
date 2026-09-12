const mongoose = require('mongoose');

const rsvpSchema = new mongoose.Schema({
  event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['confirmed', 'waitlisted', 'cancelled'], default: 'confirmed' },
  guestsCount: { type: Number, default: 1, min: 1 },
  createdAt: { type: Date, default: Date.now }
});

// One live RSVP per user per event. Cancelled rows are kept for history, so the
// uniqueness constraint only covers the two active states.
rsvpSchema.index(
  { event: 1, user: 1 },
  { unique: true, partialFilterExpression: { status: { $in: ['confirmed', 'waitlisted'] } } }
);

module.exports = mongoose.model('RSVP', rsvpSchema);
