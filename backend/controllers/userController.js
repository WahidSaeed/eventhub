const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Event = require('../models/Event');
const RSVP = require('../models/RSVP');

exports.dashboard = async (req, res, next) => {
  try {
    const rsvps = await RSVP.find({ user: req.user._id, status: { $in: ['confirmed', 'waitlisted'] } })
      .populate('event')
      .sort({ createdAt: -1 })
      .lean();

    const now = new Date();
    now.setUTCHours(0, 0, 0, 0);

    // An event deleted out from under an RSVP leaves a null populate result.
    const live = rsvps.filter((r) => r.event);

    res.json({
      upcoming: live.filter((r) => new Date(r.event.date) >= now)
        .sort((a, b) => new Date(a.event.date) - new Date(b.event.date)),
      past: live.filter((r) => new Date(r.event.date) < now)
        .sort((a, b) => new Date(b.event.date) - new Date(a.event.date))
    });
  } catch (err) {
    next(err);
  }
};

exports.updateProfile = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    if (email && email.toLowerCase() !== req.user.email) {
      const taken = await User.findOne({ email: email.toLowerCase() });
      if (taken) return res.status(409).json({ error: 'An account with that email already exists' });
      req.user.email = email.toLowerCase();
    }
    if (name) req.user.name = name;
    if (password) req.user.passwordHash = await bcrypt.hash(password, 12);

    await req.user.save();
    res.json({ user: req.user.toPublic() });
  } catch (err) {
    next(err);
  }
};

exports.reports = async (req, res, next) => {
  try {
    const [totalEvents, totalUsers, byStatus, byCategory, topEvents] = await Promise.all([
      Event.countDocuments(),
      User.countDocuments(),
      RSVP.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      Event.aggregate([{ $group: { _id: '$category', count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
      RSVP.aggregate([
        { $match: { status: 'confirmed' } },
        { $group: { _id: '$event', guests: { $sum: '$guestsCount' } } },
        { $sort: { guests: -1 } },
        { $limit: 5 },
        { $lookup: { from: 'events', localField: '_id', foreignField: '_id', as: 'event' } },
        { $unwind: '$event' },
        { $project: { _id: 1, guests: 1, title: '$event.title', date: '$event.date', capacity: '$event.capacity' } }
      ])
    ]);

    res.json({
      totalEvents,
      totalUsers,
      rsvpsByStatus: Object.fromEntries(byStatus.map((s) => [s._id, s.count])),
      eventsByCategory: byCategory.map((c) => ({ category: c._id, count: c.count })),
      topEvents
    });
  } catch (err) {
    next(err);
  }
};
