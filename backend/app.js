const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');

// The Express app on its own, with no database connection or listening socket,
// so tests can drive it directly. server.js wires it to Mongo and a port.
const app = express();

app.set('trust proxy', 1);
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

// Frontend and API share one origin in the container, so cross-origin requests
// are only expected from the Vite dev server during local development.
if (process.env.NODE_ENV !== 'production') {
  app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
}

app.get('/api/health', (req, res) => res.json({ ok: true }));

// The client-side Maps key is read at runtime rather than baked into the build,
// so one image can be deployed with different keys.
app.get('/api/config', (req, res) => {
  res.json({ googleMapsApiKey: process.env.GOOGLE_MAPS_BROWSER_KEY || '' });
});

app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/events', require('./routes/eventRoutes'));
app.use('/api/rsvps', require('./routes/rsvpRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

// Built frontend, plus a catch-all so client-side routes survive a page refresh.
const publicDir = path.join(__dirname, 'public');
app.use(express.static(publicDir));
app.get(/^(?!\/api).*/, (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

app.use((err, req, res, next) => {
  console.error(err);
  if (err.code === 11000) return res.status(409).json({ error: 'That record already exists' });
  if (err.name === 'ValidationError') return res.status(400).json({ error: err.message });
  if (err.name === 'CastError') return res.status(400).json({ error: 'Malformed identifier' });
  res.status(500).json({ error: 'Something went wrong' });
});

module.exports = app;
