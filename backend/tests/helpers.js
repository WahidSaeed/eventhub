// Shared test harness. Environment is fixed before the app is required so no
// real credentials from a developer's shell or .env can leak into a test run:
// no mail is sent and no geocoding quota is spent.
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-only-secret';
process.env.AUTH_RATE_LIMIT_MAX = '10000';
delete process.env.SENDGRID_API_KEY;
delete process.env.SENDGRID_FROM_EMAIL;
delete process.env.GOOGLE_MAPS_API_KEY;
delete process.env.GOOGLE_MAPS_BROWSER_KEY;

const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const request = require('supertest');
const app = require('../app');
const User = require('../models/User');

let memoryServer = null;

// Uses an in-memory MongoDB by default. TEST_MONGO_URI points the suite at a
// real server instead, and must name a test database because it is wiped.
async function startDb() {
  let uri = process.env.TEST_MONGO_URI;
  if (uri) {
    const dbName = new URL(uri).pathname.replace('/', '');
    if (!/test/i.test(dbName)) {
      throw new Error(`Refusing to run tests against "${dbName}": the database name must contain "test".`);
    }
  } else {
    const { MongoMemoryServer } = require('mongodb-memory-server');
    memoryServer = await MongoMemoryServer.create();
    uri = memoryServer.getUri('eventhub_test');
  }

  await mongoose.connect(uri);
  // Build indexes up front; the RSVP uniqueness rule depends on one.
  await Promise.all(mongoose.modelNames().map((name) => mongoose.model(name).init()));
}

async function stopDb() {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  if (memoryServer) await memoryServer.stop();
}

async function resetDb() {
  await Promise.all(Object.values(mongoose.connection.collections).map((c) => c.deleteMany({})));
}

let counter = 0;
const uniqueEmail = (prefix = 'user') => `${prefix}${++counter}@test.dev`;

// A signed-in regular user. The agent keeps the session cookie between calls.
async function signedInUser(name = 'Test User') {
  const agent = request.agent(app);
  const email = uniqueEmail();
  const res = await agent.post('/api/auth/signup').send({ name, email, password: 'password123' });
  if (res.status !== 201) throw new Error(`Signup failed: ${res.status} ${JSON.stringify(res.body)}`);
  return { agent, user: res.body.user, email };
}

// Admins cannot be created through the API, so insert one and sign in.
async function signedInAdmin() {
  const email = uniqueEmail('admin');
  await User.create({
    name: 'Test Admin',
    email,
    passwordHash: await bcrypt.hash('password123', 4),
    role: 'admin'
  });
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/login').send({ email, password: 'password123' });
  if (res.status !== 200) throw new Error(`Admin login failed: ${res.status}`);
  return { agent, email };
}

async function createEvent(adminAgent, overrides = {}) {
  const res = await adminAgent.post('/api/events').send({
    title: 'Test Event',
    date: '2099-06-01',
    category: 'music',
    capacity: 10,
    ...overrides
  });
  if (res.status !== 201) throw new Error(`Create event failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.event;
}

module.exports = { app, request, startDb, stopDb, resetDb, uniqueEmail, signedInUser, signedInAdmin, createEvent };
