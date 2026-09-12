const { describe, test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const h = require('./helpers');
const RSVP = require('../models/RSVP');
const Event = require('../models/Event');

before(h.startDb);
after(h.stopDb);
beforeEach(h.resetDb);

const rsvp = (agent, eventId, guestsCount = 1) =>
  agent.post(`/api/events/${eventId}/rsvp`).send({ guestsCount });

async function statusOf(rsvpId) {
  return (await RSVP.findById(rsvpId)).status;
}

describe('capacity', () => {
  test('confirms a party that fits', async () => {
    const { agent: admin } = await h.signedInAdmin();
    const event = await h.createEvent(admin, { capacity: 5 });
    const { agent } = await h.signedInUser();

    const res = await rsvp(agent, event._id, 2);
    assert.equal(res.status, 201);
    assert.equal(res.body.rsvp.status, 'confirmed');
  });

  test('counts guests, not bookings, against capacity', async () => {
    const { agent: admin } = await h.signedInAdmin();
    const event = await h.createEvent(admin, { capacity: 3 });
    const a = await h.signedInUser();
    const b = await h.signedInUser();
    const c = await h.signedInUser();

    assert.equal((await rsvp(a.agent, event._id, 2)).body.rsvp.status, 'confirmed');
    // 2 taken + 2 requested exceeds 3, so this party waits...
    assert.equal((await rsvp(b.agent, event._id, 2)).body.rsvp.status, 'waitlisted');
    // ...while a single guest still fits in the last place.
    assert.equal((await rsvp(c.agent, event._id, 1)).body.rsvp.status, 'confirmed');
  });

  test('treats capacity 0 as no limit', async () => {
    const { agent: admin } = await h.signedInAdmin();
    const event = await h.createEvent(admin, { capacity: 0 });
    const { agent } = await h.signedInUser();

    const res = await rsvp(agent, event._id, 20);
    assert.equal(res.body.rsvp.status, 'confirmed');
  });

  test('rejects a party larger than 20', async () => {
    const { agent: admin } = await h.signedInAdmin();
    const event = await h.createEvent(admin);
    const { agent } = await h.signedInUser();

    assert.equal((await rsvp(agent, event._id, 21)).status, 400);
  });
});

describe('concurrency', () => {
  test('two requests for the last place cannot both be confirmed', async () => {
    const { agent: admin } = await h.signedInAdmin();
    const event = await h.createEvent(admin, { capacity: 1 });
    const a = await h.signedInUser();
    const b = await h.signedInUser();

    const results = await Promise.all([rsvp(a.agent, event._id, 1), rsvp(b.agent, event._id, 1)]);
    const statuses = results.map((r) => r.body.rsvp.status).sort();

    assert.deepEqual(statuses, ['confirmed', 'waitlisted']);
  });

  test('a burst of requests never confirms more guests than capacity', async () => {
    const { agent: admin } = await h.signedInAdmin();
    const event = await h.createEvent(admin, { capacity: 3 });
    const users = await Promise.all(Array.from({ length: 8 }, () => h.signedInUser()));

    await Promise.all(users.map((u) => rsvp(u.agent, event._id, 1)));

    const confirmed = await RSVP.countDocuments({ event: event._id, status: 'confirmed' });
    assert.equal(confirmed, 3);
  });

  test('a user sending the same RSVP twice at once gets one booking', async () => {
    const { agent: admin } = await h.signedInAdmin();
    const event = await h.createEvent(admin, { capacity: 5 });
    const { agent } = await h.signedInUser();

    const results = await Promise.all([rsvp(agent, event._id, 2), rsvp(agent, event._id, 2)]);

    assert.deepEqual(results.map((r) => r.status).sort(), [201, 409]);
    const live = await RSVP.countDocuments({ event: event._id, status: { $ne: 'cancelled' } });
    assert.equal(live, 1);
  });
});

describe('events created before the confirmed guest counter existed', () => {
  // Simulates a database from an earlier version: RSVPs exist, but the event
  // document has no confirmedGuests field at all.
  async function legacyEventWithBooking(capacity, guests) {
    const { agent: admin } = await h.signedInAdmin();
    const event = await h.createEvent(admin, { capacity });
    const holder = await h.signedInUser();
    const held = await rsvp(holder.agent, event._id, guests);
    await Event.collection.updateOne({ _id: new mongoose.Types.ObjectId(event._id) }, { $unset: { confirmedGuests: '' } });
    return { event, holder, held };
  }

  test('backfills the counter so existing bookings still count against capacity', async () => {
    const { event } = await legacyEventWithBooking(2, 2);
    assert.equal((await Event.collection.findOne({ title: 'Test Event' })).confirmedGuests, undefined);

    const late = await h.signedInUser();
    const res = await rsvp(late.agent, event._id, 1);

    assert.equal(res.body.rsvp.status, 'waitlisted');
    assert.equal((await Event.findById(event._id)).confirmedGuests, 2);
  });

  test('cancelling on a legacy event releases places exactly once', async () => {
    const { event, holder, held } = await legacyEventWithBooking(4, 3);

    await holder.agent.delete(`/api/rsvps/${held.body.rsvp._id}`);
    // A repeated cancel must not release the same places again.
    await holder.agent.delete(`/api/rsvps/${held.body.rsvp._id}`);

    assert.equal((await Event.findById(event._id)).confirmedGuests, 0);
  });
});

describe('duplicates', () => {
  test('refuses a second live RSVP to the same event', async () => {
    const { agent: admin } = await h.signedInAdmin();
    const event = await h.createEvent(admin);
    const { agent } = await h.signedInUser();

    assert.equal((await rsvp(agent, event._id)).status, 201);
    assert.equal((await rsvp(agent, event._id)).status, 409);
  });

  test('allows responding again after cancelling', async () => {
    const { agent: admin } = await h.signedInAdmin();
    const event = await h.createEvent(admin);
    const { agent } = await h.signedInUser();

    const first = await rsvp(agent, event._id);
    await agent.delete(`/api/rsvps/${first.body.rsvp._id}`);

    const again = await rsvp(agent, event._id);
    assert.equal(again.status, 201, 'the uniqueness rule must only cover live RSVPs');
  });
});

describe('cancellation and the waitlist', () => {
  test('promotes the oldest waitlisted party when a place frees up', async () => {
    const { agent: admin } = await h.signedInAdmin();
    const event = await h.createEvent(admin, { capacity: 2 });
    const holder = await h.signedInUser();
    const firstInLine = await h.signedInUser();
    const secondInLine = await h.signedInUser();

    const held = await rsvp(holder.agent, event._id, 2);
    const w1 = await rsvp(firstInLine.agent, event._id, 2);
    const w2 = await rsvp(secondInLine.agent, event._id, 2);

    await holder.agent.delete(`/api/rsvps/${held.body.rsvp._id}`);

    assert.equal(await statusOf(w1.body.rsvp._id), 'confirmed');
    assert.equal(await statusOf(w2.body.rsvp._id), 'waitlisted');
  });

  test('skips a party that still does not fit and promotes a smaller one behind it', async () => {
    const { agent: admin } = await h.signedInAdmin();
    const event = await h.createEvent(admin, { capacity: 4 });
    const a = await h.signedInUser();
    const d = await h.signedInUser();
    const large = await h.signedInUser();
    const small = await h.signedInUser();

    const aRsvp = await rsvp(a.agent, event._id, 2);
    await rsvp(d.agent, event._id, 2);
    const largeRsvp = await rsvp(large.agent, event._id, 3);
    const smallRsvp = await rsvp(small.agent, event._id, 2);

    // Frees 2 places: the party of 3 still cannot fit, the party of 2 can.
    await a.agent.delete(`/api/rsvps/${aRsvp.body.rsvp._id}`);

    assert.equal(await statusOf(largeRsvp.body.rsvp._id), 'waitlisted');
    assert.equal(await statusOf(smallRsvp.body.rsvp._id), 'confirmed');
  });

  test('a user cannot cancel someone else\'s RSVP, but an admin can', async () => {
    const { agent: admin } = await h.signedInAdmin();
    const event = await h.createEvent(admin);
    const owner = await h.signedInUser();
    const stranger = await h.signedInUser();

    const res = await rsvp(owner.agent, event._id);
    const id = res.body.rsvp._id;

    assert.equal((await stranger.agent.delete(`/api/rsvps/${id}`)).status, 403);
    assert.equal(await statusOf(id), 'confirmed');
    assert.equal((await admin.delete(`/api/rsvps/${id}`)).status, 200);
    assert.equal(await statusOf(id), 'cancelled');
  });
});

describe('reading RSVPs back', () => {
  test('event detail reports confirmed guests and the visitor\'s own RSVP', async () => {
    const { agent: admin } = await h.signedInAdmin();
    const event = await h.createEvent(admin, { capacity: 10 });
    const { agent } = await h.signedInUser();
    await rsvp(agent, event._id, 3);

    const res = await agent.get(`/api/events/${event._id}`);
    assert.equal(res.body.event.confirmedCount, 3);
    assert.equal(res.body.event.myRsvp.guestsCount, 3);
  });

  test('the dashboard lists upcoming RSVPs and drops ones for deleted events', async () => {
    const { agent: admin } = await h.signedInAdmin();
    const kept = await h.createEvent(admin, { title: 'Kept Event' });
    const removed = await h.createEvent(admin, { title: 'Removed Event' });
    const { agent } = await h.signedInUser();
    await rsvp(agent, kept._id);
    await rsvp(agent, removed._id);

    await admin.delete(`/api/events/${removed._id}`);

    const res = await agent.get('/api/users/me/dashboard');
    assert.deepEqual(res.body.upcoming.map((r) => r.event.title), ['Kept Event']);
  });

  test('responds 404 for a missing event and 400 for a malformed id', async () => {
    const { agent } = await h.signedInUser();

    assert.equal((await rsvp(agent, '0123456789abcdef01234567')).status, 404);
    assert.equal((await rsvp(agent, 'not-an-id')).status, 400);
  });
});
