const Event = require('../models/Event');
const RSVP = require('../models/RSVP');
const { sendRsvpConfirmation } = require('../services/emailService');

async function confirmedTotal(eventId) {
  const agg = await RSVP.aggregate([
    { $match: { event: eventId, status: 'confirmed' } },
    { $group: { _id: null, total: { $sum: '$guestsCount' } } }
  ]);
  return agg.length ? agg[0].total : 0;
}

// Events created before the counter existed have no confirmedGuests in the
// database. Backfill it from the RSVPs once; the $exists guard means that if
// two requests race here, only the first write lands.
async function ensureCounter(eventId) {
  const missing = await Event.exists({ _id: eventId, confirmedGuests: { $exists: false } });
  if (!missing) return;
  const total = await confirmedTotal(eventId);
  await Event.updateOne({ _id: eventId, confirmedGuests: { $exists: false } }, { $set: { confirmedGuests: total } });
}

// Atomically takes `guests` places if they fit. The capacity check and the
// increment happen in one database operation, so two requests cannot both see
// the last place as free. Capacity 0 means uncapped.
async function claimPlaces(eventId, guests) {
  const result = await Event.updateOne(
    {
      _id: eventId,
      $expr: {
        $or: [
          { $eq: ['$capacity', 0] },
          { $lte: [{ $add: ['$confirmedGuests', guests] }, '$capacity'] }
        ]
      }
    },
    { $inc: { confirmedGuests: guests } }
  );
  return result.modifiedCount === 1;
}

function releasePlaces(eventId, guests) {
  return Event.updateOne({ _id: eventId }, { $inc: { confirmedGuests: -guests } });
}

exports.create = async (req, res, next) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ error: 'Event not found' });

    // Fast path for the common case. The unique index below is what actually
    // guarantees one live RSVP when requests arrive together.
    const existing = await RSVP.exists({
      event: event._id,
      user: req.user._id,
      status: { $in: ['confirmed', 'waitlisted'] }
    });
    if (existing) return res.status(409).json({ error: 'You have already responded to this event' });

    const guestsCount = Math.max(1, parseInt(req.body.guestsCount, 10) || 1);

    await ensureCounter(event._id);
    const confirmed = await claimPlaces(event._id, guestsCount);

    let rsvp;
    try {
      rsvp = await RSVP.create({
        event: event._id,
        user: req.user._id,
        status: confirmed ? 'confirmed' : 'waitlisted',
        guestsCount
      });
    } catch (err) {
      // The places were claimed but no RSVP was written, so hand them back.
      if (confirmed) await releasePlaces(event._id, guestsCount);
      if (err.code === 11000) {
        return res.status(409).json({ error: 'You have already responded to this event' });
      }
      throw err;
    }

    // Fire and forget: the RSVP is already saved, mail must not block the response.
    sendRsvpConfirmation({ to: req.user.email, name: req.user.name, event, rsvp });

    res.status(201).json({ rsvp });
  } catch (err) {
    next(err);
  }
};

exports.cancel = async (req, res, next) => {
  try {
    const rsvp = await RSVP.findById(req.params.id);
    if (!rsvp) return res.status(404).json({ error: 'RSVP not found' });
    if (rsvp.user.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'You do not have access to this RSVP' });
    }

    // Backfill before changing any status, or the backfilled total would
    // already exclude this RSVP and the release below would count it twice.
    await ensureCounter(rsvp.event);

    // Flip the status in one operation and read back what it was, so a double
    // cancel cannot release the same places twice.
    const before = await RSVP.findOneAndUpdate(
      { _id: rsvp._id, status: { $ne: 'cancelled' } },
      { $set: { status: 'cancelled' } }
    );
    if (!before) return res.json({ ok: true });

    if (before.status === 'confirmed') {
      await releasePlaces(before.event, before.guestsCount);
    }

    // Freed places go to the oldest waitlisted parties that now fit. A party
    // too large for the space is skipped rather than blocking smaller ones.
    const waiting = await RSVP.find({ event: before.event, status: 'waitlisted' }).sort({ createdAt: 1 });
    for (const entry of waiting) {
      if (!(await claimPlaces(before.event, entry.guestsCount))) continue;

      const promoted = await RSVP.updateOne(
        { _id: entry._id, status: 'waitlisted' },
        { $set: { status: 'confirmed' } }
      );
      // Cancelled by its owner in the meantime: give the places back.
      if (promoted.modifiedCount !== 1) await releasePlaces(before.event, entry.guestsCount);
    }

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
};
