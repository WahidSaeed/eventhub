const sgMail = require('@sendgrid/mail');

let configured = false;
function ensureConfigured() {
  if (configured) return true;
  if (!process.env.SENDGRID_API_KEY || !process.env.SENDGRID_FROM_EMAIL) return false;
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  configured = true;
  return true;
}

function formatDate(date) {
  return new Date(date).toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });
}

// Sends the RSVP confirmation. Never throws: a mail failure must not roll back
// an RSVP that was already written.
async function sendRsvpConfirmation({ to, name, event, rsvp }) {
  if (!ensureConfigured()) {
    console.log(`SendGrid not configured, skipping confirmation email to ${to}`);
    return false;
  }

  const waitlisted = rsvp.status === 'waitlisted';
  const heading = waitlisted ? 'You are on the waitlist' : 'Your place is confirmed';
  const time = [event.startTime, event.endTime].filter(Boolean).join(' to ');

  const text = [
    `${heading}.`,
    '',
    event.title,
    formatDate(event.date),
    time,
    [event.venueName, event.address].filter(Boolean).join(', '),
    '',
    `Guests: ${rsvp.guestsCount}`,
    waitlisted
      ? 'The event is at capacity. We will contact you if a place opens up.'
      : 'We look forward to seeing you there.',
    '',
    'The Running Order'
  ].join('\n');

  const html = `
    <div style="font-family:Georgia,serif;color:#1B1B1B;background:#EDEAE1;padding:32px">
      <h1 style="font-family:Arial,sans-serif;font-size:20px;letter-spacing:-0.01em;margin:0 0 24px">${heading}</h1>
      <p style="font-size:18px;margin:0 0 4px"><strong>${event.title}</strong></p>
      <p style="color:#4A4A46;margin:0 0 16px">${formatDate(event.date)}${time ? `, ${time}` : ''}</p>
      <p style="color:#4A4A46;margin:0 0 16px">${[event.venueName, event.address].filter(Boolean).join(', ')}</p>
      <p style="margin:0 0 16px">Guests: ${rsvp.guestsCount}</p>
      <p style="color:#2F5D62">${waitlisted
        ? 'The event is at capacity. We will contact you if a place opens up.'
        : 'We look forward to seeing you there.'}</p>
      <p style="color:#4A4A46;font-size:13px;margin-top:32px">The Running Order</p>
    </div>`;

  try {
    await sgMail.send({
      to,
      from: process.env.SENDGRID_FROM_EMAIL,
      subject: `${heading}: ${event.title}`,
      text,
      html
    });
    return true;
  } catch (err) {
    console.error(`Failed to send RSVP email to ${to}: ${err.message}`);
    return false;
  }
}

module.exports = { sendRsvpConfirmation };
