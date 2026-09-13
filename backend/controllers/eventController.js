const Event = require('../models/Event');
const RSVP = require('../models/RSVP');
const { geocodeAddress } = require('../services/geocodeService');

const EVENT_FIELDS = [
  'title', 'description', 'category', 'date', 'startTime',
  'endTime', 'venueName', 'address', 'capacity', 'price', 'note'
];

function pickEventFields(body) {
  const out = {};
  for (const field of EVENT_FIELDS) {
    if (body[field] !== undefined) out[field] = body[field];
  }
  return out;
}

exports.list = async (req, res, next) => {
  try {
    const { category, date, search, past, order } = req.query;
    const query = {};

    if (category) query.category = category;

    if (date) {
      // Match the whole calendar day the caller asked for.
      const start = new Date(date);
      const end = new Date(start);
      end.setUTCDate(end.getUTCDate() + 1);
      query.date = { $gte: start, $lt: end };
    } else if (past !== 'true') {
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      query.date = { $gte: today };
    }

    if (search) {
      const rx = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      query.$or = [{ title: rx }, { description: rx }, { venueName: rx }];
    }

    const direction = order === 'desc' ? -1 : 1;
    let cursor = Event.find(query).sort({ date: direction, startTime: direction, _id: direction });

    // Pagination is opt-in: without a limit the full list is returned, which is
    // what the public listing wants. The editor pages through the archive.
    let pagination = null;
    if (req.query.limit) {
      const limit = Number(req.query.limit);
      const total = await Event.countDocuments(query);
      const pages = Math.max(1, Math.ceil(total / limit));
      // Clamp rather than return an empty page, e.g. after deleting the last
      // entry on the final page.
      const page = Math.min(Number(req.query.page) || 1, pages);
      cursor = cursor.skip((page - 1) * limit).limit(limit);
      pagination = { page, pages, limit, total };
    }

    const events = await cursor.lean();

    // Attach live confirmed counts so the listing can show remaining places.
    const counts = await RSVP.aggregate([
      { $match: { event: { $in: events.map((e) => e._id) }, status: 'confirmed' } },
      { $group: { _id: '$event', total: { $sum: '$guestsCount' } } }
    ]);
    const countMap = Object.fromEntries(counts.map((c) => [c._id.toString(), c.total]));

    res.json({
      events: events.map((e) => ({ ...e, confirmedCount: countMap[e._id.toString()] || 0 })),
      ...(pagination && { pagination })
    });
  } catch (err) {
    next(err);
  }
};

exports.detail = async (req, res, next) => {
  try {
    const event = await Event.findById(req.params.id).populate('createdBy', 'name').lean();
    if (!event) return res.status(404).json({ error: 'Event not found' });

    const agg = await RSVP.aggregate([
      { $match: { event: event._id, status: 'confirmed' } },
      { $group: { _id: null, total: { $sum: '$guestsCount' } } }
    ]);
    event.confirmedCount = agg.length ? agg[0].total : 0;

    // Let a signed-in visitor see their own RSVP state on this event.
    if (req.user) {
      const mine = await RSVP.findOne({
        event: event._id,
        user: req.user._id,
        status: { $in: ['confirmed', 'waitlisted'] }
      }).lean();
      event.myRsvp = mine || null;
    }

    res.json({ event });
  } catch (err) {
    next(err);
  }
};

exports.create = async (req, res, next) => {
  try {
    const data = pickEventFields(req.body);
    data.createdBy = req.user._id;
    if (data.address) data.location = (await geocodeAddress(data.address)) || { lat: null, lng: null };

    const event = await Event.create(data);
    res.status(201).json({ event });
  } catch (err) {
    next(err);
  }
};

exports.update = async (req, res, next) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ error: 'Event not found' });

    const data = pickEventFields(req.body);
    // Only re-geocode when the address actually changed, to avoid burning quota.
    if (data.address && data.address !== event.address) {
      data.location = (await geocodeAddress(data.address)) || { lat: null, lng: null };
    }

    Object.assign(event, data);
    await event.save();
    res.json({ event });
  } catch (err) {
    next(err);
  }
};

exports.remove = async (req, res, next) => {
  try {
    const event = await Event.findByIdAndDelete(req.params.id);
    if (!event) return res.status(404).json({ error: 'Event not found' });
    await RSVP.deleteMany({ event: event._id });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
};
