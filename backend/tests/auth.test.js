const { describe, test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const h = require('./helpers');
const User = require('../models/User');

before(h.startDb);
after(h.stopDb);
beforeEach(h.resetDb);

describe('signup', () => {
  test('creates a user and sets an httpOnly session cookie', async () => {
    const res = await h.request(h.app).post('/api/auth/signup')
      .send({ name: 'Ada', email: 'ada@test.dev', password: 'password123' });

    assert.equal(res.status, 201);
    assert.equal(res.body.user.email, 'ada@test.dev');
    assert.equal(res.body.user.role, 'user');
    assert.equal(res.body.user.passwordHash, undefined, 'hash must never be returned');

    const cookie = res.headers['set-cookie'].find((c) => c.startsWith('token='));
    assert.ok(cookie, 'session cookie is set');
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /SameSite=Lax/);
  });

  test('stores a bcrypt hash, never the plaintext password', async () => {
    await h.request(h.app).post('/api/auth/signup')
      .send({ name: 'Ada', email: 'ada@test.dev', password: 'password123' });

    const user = await User.findOne({ email: 'ada@test.dev' });
    assert.notEqual(user.passwordHash, 'password123');
    assert.ok(await bcrypt.compare('password123', user.passwordHash));
  });

  test('ignores a role supplied in the request body', async () => {
    const res = await h.request(h.app).post('/api/auth/signup')
      .send({ name: 'Mallory', email: 'm@test.dev', password: 'password123', role: 'admin' });

    assert.equal(res.status, 201);
    assert.equal(res.body.user.role, 'user');
  });

  test('rejects an email already registered, regardless of case', async () => {
    await h.request(h.app).post('/api/auth/signup')
      .send({ name: 'Ada', email: 'ada@test.dev', password: 'password123' });
    const res = await h.request(h.app).post('/api/auth/signup')
      .send({ name: 'Ada Again', email: 'ADA@test.dev', password: 'password123' });

    assert.equal(res.status, 409);
  });

  test('rejects a password shorter than 8 characters', async () => {
    const res = await h.request(h.app).post('/api/auth/signup')
      .send({ name: 'Ada', email: 'ada@test.dev', password: 'short' });

    assert.equal(res.status, 400);
    assert.ok(res.body.details.some((d) => d.field === 'password'));
  });
});

describe('login and session', () => {
  test('gives the same answer for a wrong password and an unknown email', async () => {
    await h.signedInUser();
    const known = await User.findOne();

    const wrongPassword = await h.request(h.app).post('/api/auth/login')
      .send({ email: known.email, password: 'not-the-password' });
    const unknownEmail = await h.request(h.app).post('/api/auth/login')
      .send({ email: 'nobody@test.dev', password: 'not-the-password' });

    assert.equal(wrongPassword.status, 401);
    assert.equal(unknownEmail.status, 401);
    assert.deepEqual(wrongPassword.body, unknownEmail.body, 'responses must not reveal which emails exist');
  });

  test('a signed-in session is recognised, and logout ends it', async () => {
    const { agent, email } = await h.signedInUser();

    const me = await agent.get('/api/auth/me');
    assert.equal(me.body.user.email, email);

    await agent.post('/api/auth/logout');
    const after = await agent.get('/api/auth/me');
    assert.equal(after.body.user, null);
  });

  test('a forged session cookie is rejected', async () => {
    const res = await h.request(h.app).get('/api/users/me/dashboard')
      .set('Cookie', 'token=not.a.real.token');

    assert.equal(res.status, 401);
  });

  test('auth routes advertise a rate limit', async () => {
    const res = await h.request(h.app).post('/api/auth/login')
      .send({ email: 'x@test.dev', password: 'whatever1' });

    assert.ok(res.headers['ratelimit-limit'], 'RateLimit-Limit header present');
  });
});

describe('role enforcement', () => {
  test('creating an event requires an admin', async () => {
    const payload = { title: 'Gated Event', date: '2099-06-01' };
    const { agent: user } = await h.signedInUser();
    const { agent: admin } = await h.signedInAdmin();

    assert.equal((await h.request(h.app).post('/api/events').send(payload)).status, 401);
    assert.equal((await user.post('/api/events').send(payload)).status, 403);
    assert.equal((await admin.post('/api/events').send(payload)).status, 201);
  });

  test('reports are admin only', async () => {
    const { agent: user } = await h.signedInUser();
    const { agent: admin } = await h.signedInAdmin();

    assert.equal((await user.get('/api/admin/reports')).status, 403);
    assert.equal((await admin.get('/api/admin/reports')).status, 200);
  });
});

describe('profile update', () => {
  test('cannot take an email that belongs to someone else', async () => {
    const first = await h.signedInUser();
    const second = await h.signedInUser();

    const res = await second.agent.put('/api/users/me').send({ email: first.email });
    assert.equal(res.status, 409);
  });
});
