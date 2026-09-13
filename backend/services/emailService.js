const sgMail = require('@sendgrid/mail');

let configured = false;
function ensureConfigured() {
  if (configured) return true;
  if (!process.env.SENDGRID_API_KEY || !process.env.SENDGRID_FROM_EMAIL) return false;
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  configured = true;
  return true;
}

const FONT = "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const INK = '#131517';
const INK_2 = '#737577';
const INK_3 = '#b3b5b7';
const LINE = '#e6e7e8';

// Same palettes and per-event pick as frontend/src/utils/categories.js, so the
// cover in the email matches the one on the site. Keep the two in step.
const COVERS = {
  music: { label: 'Music', gradients: [['#ff6ec4', '#7873f5'], ['#f857a6', '#ff5858']] },
  food: { label: 'Food & drink', gradients: [['#f7b267', '#f25c54'], ['#ff9a44', '#fc6076']] },
  conference: { label: 'Conference', gradients: [['#4facfe', '#3a7bd5'], ['#667eea', '#764ba2']] },
  community: { label: 'Community', gradients: [['#34d399', '#0ea5a4'], ['#0ba360', '#3cba92']] },
  film: { label: 'Film', gradients: [['#fa709a', '#f9a14a'], ['#30cfd0', '#330867']] },
  talk: { label: 'Talk', gradients: [['#a18cd1', '#e98bd5'], ['#8e5cff', '#e5376b']] },
  other: { label: 'Other', gradients: [['#89a4bf', '#5b6b8c']] }
};

function cover(category, seed) {
  const meta = COVERS[category] || COVERS.other;
  let hash = 0;
  for (const ch of String(seed || '')) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return { label: meta.label, colors: meta.gradients[hash % meta.gradients.length] };
}

function escapeHtml(value) {
  const entities = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return String(value ?? '').replace(/[&<>"']/g, (ch) => entities[ch]);
}

// Event dates are calendar days stored as UTC midnight, so they are read in UTC.
function dateParts(date) {
  const d = new Date(date);
  const fmt = (opts) => d.toLocaleDateString('en-US', { ...opts, timeZone: 'UTC' });
  return {
    month: fmt({ month: 'short' }).toUpperCase(),
    day: d.getUTCDate(),
    long: fmt({ weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
  };
}

function timeRange(start, end) {
  if (start && end) return `${start} – ${end}`;
  return start || end || '';
}

// The "View event" button needs the public address of the app, which the
// server cannot know on its own. Without APP_URL the email simply has no button.
function eventUrl(event) {
  const base = (process.env.APP_URL || '').trim().replace(/\/+$/, '');
  return base ? `${base}/events/${event._id}` : '';
}

function detailRow(iconCell, title, subtitle) {
  return `
              <tr>
                <td width="44" valign="middle" style="padding:8px 0;">${iconCell}</td>
                <td valign="middle" style="padding:8px 0 8px 12px;font-family:${FONT};">
                  <div style="font-size:15px;line-height:1.35;font-weight:600;color:${INK};">${title}</div>
                  ${subtitle ? `<div style="font-size:14px;line-height:1.4;color:${INK_2};">${subtitle}</div>` : ''}
                </td>
              </tr>`;
}

function iconBox(symbol) {
  return `<div style="width:42px;height:42px;line-height:42px;border:1px solid ${LINE};border-radius:8px;text-align:center;font-size:18px;">${symbol}</div>`;
}

// Builds the subject, plain text and HTML for an RSVP confirmation. Kept separate
// from sending so the content can be tested and previewed without SendGrid.
function renderRsvpEmail({ name, event, rsvp }) {
  const waitlisted = rsvp.status === 'waitlisted';
  const firstName = String(name || '').trim().split(/\s+/)[0] || 'there';
  const heading = waitlisted ? "You're on the waitlist" : "You're in";
  const subject = `${heading}: ${event.title}`;
  const guests = `${rsvp.guestsCount} ${rsvp.guestsCount === 1 ? 'guest' : 'guests'}`;
  const when = dateParts(event.date);
  const time = timeRange(event.startTime, event.endTime);
  const venue = event.venueName || 'Venue to be announced';
  const art = cover(event.category, event._id);
  const url = eventUrl(event);

  const intro = waitlisted
    ? `Hi ${firstName}, this event is full right now, so you are on the waitlist for ${guests}.`
    : `Hi ${firstName}, your registration is confirmed for ${guests}. We look forward to seeing you there.`;
  const footnote = waitlisted
    ? 'If a place opens up, you move off the waitlist automatically.'
    : 'Plans changed? You can cancel your registration under Your events.';

  const text = [
    `${heading}.`,
    '',
    intro,
    '',
    event.title,
    `${when.long}${time ? `, ${time}` : ''}`,
    [venue, event.address].filter(Boolean).join(', '),
    '',
    ...(url ? [`View the event: ${url}`, ''] : []),
    footnote,
    '',
    'The Running Order'
  ].join('\n');

  const e = escapeHtml;
  const badge = waitlisted
    ? { bg: '#fdf1dc', fg: '#c27803', label: 'On the waitlist' }
    : { bg: '#e3f5ee', fg: '#0b9b64', label: '&#10003;&nbsp; You&#39;re in' };
  const [from, to] = art.colors;

  const dateTile = `
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:44px;border:1px solid ${LINE};border-radius:8px;border-collapse:separate;">
                    <tr><td align="center" style="padding:2px 0;background-color:#f4f5f6;border-radius:7px 7px 0 0;font-family:${FONT};font-size:10px;font-weight:600;letter-spacing:0.04em;color:${INK_2};">${e(when.month)}</td></tr>
                    <tr><td align="center" style="padding:2px 0 4px;font-family:${FONT};font-size:17px;font-weight:600;color:${INK};">${when.day}</td></tr>
                  </table>`;

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="light" />
  <title>${e(subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f5f6;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${e(intro)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f5f6;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;">
          <tr>
            <td style="padding:0 4px 16px;font-family:${FONT};font-size:14px;font-weight:600;color:${INK};">
              <span style="display:inline-block;width:22px;height:22px;line-height:22px;border-radius:6px;background-color:#e5376b;background-image:linear-gradient(135deg,#ff8a65 0%,#e5376b 50%,#8e5cff 100%);color:#ffffff;text-align:center;font-size:12px;vertical-align:middle;">&#10022;</span>
              <span style="vertical-align:middle;">&nbsp;The Running Order</span>
            </td>
          </tr>
          <tr>
            <td style="background-color:#ffffff;border:1px solid ${LINE};border-radius:16px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td height="132" valign="bottom" style="height:132px;padding:0 24px 18px;border-radius:15px 15px 0 0;background-color:${from};background-image:linear-gradient(135deg,${from} 0%,${to} 100%);font-family:${FONT};">
                    <span style="display:inline-block;padding:4px 10px;border-radius:999px;background-color:rgba(255,255,255,0.24);color:#ffffff;font-size:12px;font-weight:600;">${e(art.label)}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:28px 24px 8px;font-family:${FONT};">
                    <span style="display:inline-block;padding:4px 10px;border-radius:6px;background-color:${badge.bg};color:${badge.fg};font-size:13px;font-weight:600;">${badge.label}</span>
                    <h1 style="margin:14px 0 8px;font-size:24px;line-height:1.25;font-weight:700;letter-spacing:-0.01em;color:${INK};">${e(event.title)}</h1>
                    <p style="margin:0;font-size:15px;line-height:1.55;color:${INK_2};">${e(intro)}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:12px 24px 4px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${detailRow(dateTile, e(when.long), e(time))}${detailRow(iconBox('&#128205;'), e(venue), e(event.address))}${detailRow(iconBox('&#127903;'), e(guests), waitlisted ? 'Waitlist' : 'Confirmed')}
                    </table>
                  </td>
                </tr>${url ? `
                <tr>
                  <td style="padding:16px 24px 4px;">
                    <a href="${e(url)}" style="display:block;padding:13px 20px;border-radius:10px;background-color:${INK};color:#ffffff;text-align:center;text-decoration:none;font-family:${FONT};font-size:15px;font-weight:600;">View event</a>
                  </td>
                </tr>` : ''}
                <tr>
                  <td style="padding:16px 24px 24px;font-family:${FONT};font-size:13px;line-height:1.5;color:${INK_3};">${e(footnote)}</td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:20px 8px 0;font-family:${FONT};font-size:12px;line-height:1.6;color:${INK_3};">
              The Running Order, Berlin<br />
              You are receiving this because you registered for an event.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, text, html };
}

// Sends the RSVP confirmation. Never throws: a mail failure must not roll back
// an RSVP that was already written.
async function sendRsvpConfirmation({ to, name, event, rsvp }) {
  if (!ensureConfigured()) {
    console.log(`SendGrid not configured, skipping confirmation email to ${to}`);
    return false;
  }

  const { subject, text, html } = renderRsvpEmail({ name, event, rsvp });

  try {
    await sgMail.send({
      to,
      from: { email: process.env.SENDGRID_FROM_EMAIL, name: 'The Running Order' },
      subject,
      text,
      html
    });
    return true;
  } catch (err) {
    console.error(`Failed to send RSVP email to ${to}: ${err.message}`);
    return false;
  }
}

module.exports = { sendRsvpConfirmation, renderRsvpEmail };
