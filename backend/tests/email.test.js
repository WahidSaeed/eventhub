const { describe, test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { renderRsvpEmail } = require('../services/emailService');

const event = {
  _id: '6aa6851c2b1c3ce002b89e82',
  title: 'Jazz <Night> & "Friends"',
  category: 'music',
  date: new Date('2026-09-15T00:00:00Z'),
  startTime: '20:00',
  endTime: '23:00',
  venueName: 'The Blue Room',
  address: 'Neukölln, Berlin'
};

describe('RSVP confirmation email', () => {
  const savedUrl = process.env.APP_URL;
  afterEach(() => {
    if (savedUrl === undefined) delete process.env.APP_URL;
    else process.env.APP_URL = savedUrl;
  });

  test('a confirmed email names the event, day, time and party size', () => {
    const { subject, text, html } = renderRsvpEmail({
      name: 'Ada Lovelace', event, rsvp: { status: 'confirmed', guestsCount: 2 }
    });
    assert.equal(subject, "You're in: Jazz <Night> & \"Friends\"");
    assert.match(text, /Hi Ada, your registration is confirmed for 2 guests/);
    assert.match(html, /Tuesday, September 15, 2026/);
    assert.match(html, /20:00 – 23:00/);
    assert.match(html, /The Blue Room/);
  });

  test('a waitlisted email says so', () => {
    const { subject, text, html } = renderRsvpEmail({
      name: 'Ada', event, rsvp: { status: 'waitlisted', guestsCount: 1 }
    });
    assert.ok(subject.startsWith("You're on the waitlist: "));
    assert.match(text, /on the waitlist for 1 guest\./);
    assert.match(html, /On the waitlist/);
  });

  test('event text is escaped in the HTML', () => {
    const { html } = renderRsvpEmail({ name: '<b>Eve</b>', event, rsvp: { status: 'confirmed', guestsCount: 1 } });
    assert.ok(html.includes('Jazz &lt;Night&gt; &amp; &quot;Friends&quot;'));
    assert.ok(!html.includes('<Night>'));
    assert.ok(!html.includes('<b>Eve'));
  });

  test('the View event button appears only when APP_URL is set', () => {
    delete process.env.APP_URL;
    let { html } = renderRsvpEmail({ name: 'Ada', event, rsvp: { status: 'confirmed', guestsCount: 1 } });
    assert.ok(!html.includes('View event'));

    process.env.APP_URL = 'https://events.example.test/';
    ({ html } = renderRsvpEmail({ name: 'Ada', event, rsvp: { status: 'confirmed', guestsCount: 1 } }));
    assert.ok(html.includes('href="https://events.example.test/events/6aa6851c2b1c3ce002b89e82"'));
  });
});
