// Bootstraps the first admin account and, unless --admin-only is passed, a set
// of sample events. Safe to re-run: existing records are left alone.
require('dotenv').config();

const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');
const Event = require('../models/Event');
const { geocodeAddress } = require('../services/geocodeService');

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL || 'admin@runningorder.test';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || 'changeme123';

// Event dates are calendar days stored as UTC midnight, matching what the admin
// form sends. Local midnight would land on the previous UTC day east of
// Greenwich and fall outside the date filter.
function dayFromNow(offset) {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + offset);
  return d;
}

// Mirrors the listings in design-mockup-v3.html so a fresh install looks like
// the approved design. Addresses are kept at district level and resolved by
// the geocoder rather than hand-entered coordinates.
const sampleEvents = [
  { title: 'Autumn Jazz Night', category: 'music', dayOffset: 2, startTime: '20:00', endTime: '23:00',
    venueName: 'The Blue Room', address: 'Neukölln, Berlin, Germany', capacity: 80, price: 18,
    note: 'Doors 19:30',
    description: 'A quartet playing standards and a few new pieces, two sets with a short break between.' },
  { title: 'Second Tuesday Book Club', category: 'community', dayOffset: 2, startTime: '19:00', endTime: '20:30',
    venueName: 'St. Georges Bookshop', address: 'Prenzlauer Berg, Berlin, Germany', capacity: 20, price: 0,
    description: 'This month we are reading a short novel. Come having read it, or come to hear what you missed.' },
  { title: 'Life Drawing, Open Studio', category: 'community', dayOffset: 2, startTime: '18:30', endTime: '21:00',
    venueName: 'Kreuzberg Art House', address: 'Kreuzberg, Berlin, Germany', capacity: 25, price: 12,
    description: 'Untutored sessions with a model. Easels and paper provided, bring your own pencils.' },
  { title: 'Street Food Expo', category: 'food', dayOffset: 5, startTime: '12:00', endTime: '22:00',
    venueName: 'Tempelhof Field', address: 'Tempelhofer Feld, Berlin, Germany', capacity: 0, price: 0,
    note: '40+ vendors',
    description: 'Stalls across the old airfield from midday until late. No booking limit.' },
  { title: 'Late Bar: Vinyl Only', category: 'music', dayOffset: 5, startTime: '23:00', endTime: '03:00',
    venueName: 'Loophole', address: 'Neukölln, Berlin, Germany', capacity: 60, price: 10,
    description: 'Three selectors, records only, nothing announced in advance.' },
  { title: 'Product Demo Day', category: 'conference', dayOffset: 10, startTime: '09:00', endTime: '17:00',
    venueName: 'Factory Berlin', address: 'Mitte, Berlin, Germany', capacity: 150, price: 25,
    note: '10 founders presenting',
    description: 'Ten early stage teams show what they have built, with questions from the room after each.' }
];

async function main() {
  await connectDB();

  let admin = await User.findOne({ email: ADMIN_EMAIL });
  if (admin) {
    if (admin.role !== 'admin') {
      admin.role = 'admin';
      await admin.save();
      console.log(`Promoted existing user ${ADMIN_EMAIL} to admin`);
    } else {
      console.log(`Admin ${ADMIN_EMAIL} already exists`);
    }
  } else {
    admin = await User.create({
      name: 'Programme Editor',
      email: ADMIN_EMAIL,
      passwordHash: await bcrypt.hash(ADMIN_PASSWORD, 12),
      role: 'admin'
    });
    console.log(`Created admin ${ADMIN_EMAIL} with password: ${ADMIN_PASSWORD}`);
    console.log('Change this password after first sign in.');
  }

  if (!process.argv.includes('--admin-only')) {
    for (const sample of sampleEvents) {
      const { dayOffset, ...rest } = sample;
      const exists = await Event.findOne({ title: rest.title });
      if (exists) continue;

      // Resolve the address the same way the create route does, so seeded
      // events carry coordinates and render on the map.
      const location = (await geocodeAddress(rest.address)) || { lat: null, lng: null };

      await Event.create({ ...rest, location, date: dayFromNow(dayOffset), createdBy: admin._id });
      console.log(`Created event: ${rest.title}${location.lat === null ? ' (no coordinates)' : ''}`);
    }
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
