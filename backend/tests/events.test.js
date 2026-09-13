const { describe, test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers');

before(h.startDb);
after(h.stopDb);
beforeEach(h.resetDb);

const titles = (res) => res.body.events.map((e) => e.title).sort();

describe('listing filters', () => {
  test('filters by category', async () => {
    const { agent: admin } = await h.signedInAdmin();
    await h.createEvent(admin, { title: 'Jazz Evening', category: 'music' });
    await h.createEvent(admin, { title: 'Supper Club', category: 'food' });

    const res = await h.request(h.app).get('/api/events?category=food');
    assert.deepEqual(titles(res), ['Supper Club']);
  });

  test('searches title, description and venue, ignoring case', async () => {
    const { agent: admin } = await h.signedInAdmin();
    await h.createEvent(admin, { title: 'Jazz Evening' });
    await h.createEvent(admin, { title: 'Supper Club', venueName: 'The Jazz Cellar' });
    await h.createEvent(admin, { title: 'Book Club', description: 'Nothing musical' });

    const res = await h.request(h.app).get('/api/events?search=JAZZ');
    assert.deepEqual(titles(res), ['Jazz Evening', 'Supper Club']);
  });

  test('treats regex characters in a search as plain text', async () => {
    const { agent: admin } = await h.signedInAdmin();
    await h.createEvent(admin, { title: 'Workshop (Beginners)' });

    const res = await h.request(h.app).get(`/api/events?search=${encodeURIComponent('(Beginners')}`);
    assert.equal(res.status, 200);
    assert.deepEqual(titles(res), ['Workshop (Beginners)']);
  });

  test('filters by calendar day', async () => {
    const { agent: admin } = await h.signedInAdmin();
    await h.createEvent(admin, { title: 'On The Day', date: '2099-06-01T19:00:00Z' });
    await h.createEvent(admin, { title: 'Day After', date: '2099-06-02' });

    const res = await h.request(h.app).get('/api/events?date=2099-06-01');
    assert.deepEqual(titles(res), ['On The Day']);
  });

  test('hides past events unless past=true is requested', async () => {
    const { agent: admin } = await h.signedInAdmin();
    await h.createEvent(admin, { title: 'Long Gone', date: '2001-01-01' });
    await h.createEvent(admin, { title: 'Still To Come', date: '2099-01-01' });

    assert.deepEqual(titles(await h.request(h.app).get('/api/events')), ['Still To Come']);
    assert.deepEqual(titles(await h.request(h.app).get('/api/events?past=true')), ['Long Gone', 'Still To Come']);
  });
});

describe('event writes', () => {
  test('stores price and note', async () => {
    const { agent: admin } = await h.signedInAdmin();
    const event = await h.createEvent(admin, { price: 12.5, note: '40+ vendors' });

    const res = await h.request(h.app).get(`/api/events/${event._id}`);
    assert.equal(res.body.event.price, 12.5);
    assert.equal(res.body.event.note, '40+ vendors');
  });

  test('rejects a negative price and an over-long note', async () => {
    const { agent: admin } = await h.signedInAdmin();

    const price = await admin.post('/api/events').send({ title: 'Bad Price', date: '2099-06-01', price: -1 });
    const note = await admin.post('/api/events').send({ title: 'Bad Note', date: '2099-06-01', note: 'x'.repeat(41) });

    assert.equal(price.status, 400);
    assert.equal(note.status, 400);
  });

  test('ignores fields that are not part of an event, such as createdBy', async () => {
    const { agent: admin } = await h.signedInAdmin();
    const res = await admin.post('/api/events')
      .send({ title: 'Spoofed Owner', date: '2099-06-01', createdBy: '0123456789abcdef01234567' });

    assert.equal(res.status, 201);
    assert.notEqual(String(res.body.event.createdBy), '0123456789abcdef01234567');
  });

  test('the confirmed guest counter cannot be set through the API', async () => {
    const { agent: admin } = await h.signedInAdmin();
    const created = await admin.post('/api/events')
      .send({ title: 'Counter Spoof', date: '2099-06-01', capacity: 5, confirmedGuests: 5 });
    assert.equal(created.body.event.confirmedGuests, 0);

    const updated = await admin.put(`/api/events/${created.body.event._id}`)
      .send({ title: 'Counter Spoof', date: '2099-06-01', confirmedGuests: 5 });
    assert.equal(updated.body.event.confirmedGuests, 0);
  });

  test('update changes only the fields sent', async () => {
    const { agent: admin } = await h.signedInAdmin();
    const event = await h.createEvent(admin, { title: 'Original', capacity: 10, price: 5 });

    const res = await admin.put(`/api/events/${event._id}`)
      .send({ title: 'Renamed', date: '2099-06-01', price: 8 });

    assert.equal(res.body.event.title, 'Renamed');
    assert.equal(res.body.event.price, 8);
    assert.equal(res.body.event.capacity, 10);
  });
});

describe('pagination', () => {
  // Five events on consecutive days, so their order is unambiguous.
  async function fiveEvents() {
    const { agent: admin } = await h.signedInAdmin();
    for (let day = 1; day <= 5; day++) {
      await h.createEvent(admin, { title: `Day ${day}`, date: `2099-07-0${day}` });
    }
  }
  const list = (qs) => h.request(h.app).get(`/api/events?${qs}`);
  const names = (res) => res.body.events.map((e) => e.title);

  test('returns everything, with no pagination block, when no limit is given', async () => {
    await fiveEvents();
    const res = await list('');

    assert.equal(res.body.events.length, 5);
    assert.equal(res.body.pagination, undefined);
  });

  test('pages through results and reports the totals', async () => {
    await fiveEvents();

    const first = await list('limit=2&page=1');
    const last = await list('limit=2&page=3');

    assert.deepEqual(names(first), ['Day 1', 'Day 2']);
    assert.deepEqual(first.body.pagination, { page: 1, pages: 3, limit: 2, total: 5 });
    assert.deepEqual(names(last), ['Day 5']);
  });

  test('order=desc returns the newest first', async () => {
    await fiveEvents();
    const res = await list('limit=2&order=desc');

    assert.deepEqual(names(res), ['Day 5', 'Day 4']);
  });

  test('a page past the end is clamped to the last page', async () => {
    await fiveEvents();
    const res = await list('limit=2&page=99');

    assert.equal(res.body.pagination.page, 3);
    assert.deepEqual(names(res), ['Day 5']);
  });

  test('pagination respects filters when counting', async () => {
    const { agent: admin } = await h.signedInAdmin();
    await h.createEvent(admin, { title: 'Food One', category: 'food' });
    await h.createEvent(admin, { title: 'Food Two', category: 'food' });
    await h.createEvent(admin, { title: 'Music One', category: 'music' });

    const res = await list('category=food&limit=1');
    assert.equal(res.body.pagination.total, 2);
    assert.equal(res.body.pagination.pages, 2);
  });

  test('an empty result still reports one page', async () => {
    const res = await list('limit=10');

    assert.deepEqual(res.body.pagination, { page: 1, pages: 1, limit: 10, total: 0 });
  });

  test('rejects invalid page, limit and order values', async () => {
    for (const qs of ['limit=0', 'limit=101', 'limit=abc', 'page=0', 'page=-1', 'order=sideways']) {
      assert.equal((await list(qs)).status, 400, `expected 400 for ?${qs}`);
    }
  });
});
