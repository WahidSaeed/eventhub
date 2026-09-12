const mongoose = require('mongoose');

const CATEGORIES = ['music', 'food', 'conference', 'community', 'film', 'talk', 'other'];

const eventSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  category: { type: String, enum: CATEGORIES, default: 'other' },
  date: { type: Date, required: true },
  startTime: { type: String, default: '' },
  endTime: { type: String, default: '' },
  venueName: { type: String, default: '' },
  address: { type: String, default: '' },
  location: {
    lat: { type: Number, default: null },
    lng: { type: Number, default: null }
  },
  capacity: { type: Number, default: 0, min: 0 },
  // Running total of confirmed guests. RSVPs claim places by incrementing this
  // with a conditional update, which is what stops two requests for the last
  // place from both succeeding. Never written from request bodies.
  confirmedGuests: { type: Number, default: 0, min: 0 },
  // Ticket price in the listing currency. Zero means the event is free.
  price: { type: Number, default: 0, min: 0 },
  // Short editorial note shown as the teal tag on the listing, e.g. "40+ vendors".
  note: { type: String, default: '', trim: true, maxlength: 40 },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now }
});

eventSchema.index({ date: 1 });
eventSchema.index({ title: 'text', description: 'text', venueName: 'text' });

module.exports = mongoose.model('Event', eventSchema);
module.exports.CATEGORIES = CATEGORIES;
