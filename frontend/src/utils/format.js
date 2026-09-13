// Shared date, time and price formatting so every view reads the same way.

// Event dates are calendar days stored as UTC midnight, so they are read in UTC.
// In the viewer's local zone, anywhere west of Greenwich would show the day before.

// Matches the mockup's day header wording, for example "Tuesday, Oct 14".
export function dayHeading(date) {
  const d = new Date(date);
  const weekday = d.toLocaleDateString('en-GB', { weekday: 'long', timeZone: 'UTC' });
  const month = d.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' });
  return `${weekday}, ${month} ${d.getUTCDate()}`;
}

export function shortDate(date) {
  return new Date(date).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC'
  });
}

export function timeRange(start, end) {
  if (start && end) return `${start} – ${end}`;
  return start || end || '';
}

// The listing shows only the start time, as in the mockup.
export function startTimeLabel(event) {
  return event.startTime || 'Time to be confirmed';
}

export function inputDate(date) {
  return date ? new Date(date).toISOString().slice(0, 10) : '';
}

export function priceLabel(event) {
  const price = Number(event.price) || 0;
  if (price <= 0) return 'Free';
  return `€${Number.isInteger(price) ? price : price.toFixed(2)}`;
}

// Describes remaining places. Capacity 0 means the event is uncapped.
export function placesLabel(event) {
  if (!event.capacity) return 'No limit';
  const left = Math.max(0, event.capacity - (event.confirmedCount || 0));
  if (left === 0) return 'Waitlist only';
  return `${left} of ${event.capacity} left`;
}

export function listingCount(n) {
  return `${n} ${n === 1 ? 'listing' : 'listings'}`;
}

// Parts for the timeline date column and the date tile on the event page.
export function dateParts(date) {
  const d = new Date(date);
  const fmt = (opts) => d.toLocaleDateString('en-US', { ...opts, timeZone: 'UTC' });
  return {
    month: fmt({ month: 'short' }),
    day: d.getUTCDate(),
    weekday: fmt({ weekday: 'long' }),
    long: fmt({ weekday: 'long', month: 'long', day: 'numeric' })
  };
}

function localKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// The viewer's calendar day, compared against the UTC calendar day of an event.
export function todayKey() {
  return localKey(new Date());
}

export function dayLabel(date) {
  const key = new Date(date).toISOString().slice(0, 10);
  const offset = (days) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return localKey(d);
  };
  if (key === offset(0)) return 'Today';
  if (key === offset(1)) return 'Tomorrow';
  if (key === offset(-1)) return 'Yesterday';
  return dateParts(date).weekday;
}

// Groups an already date-sorted list into consecutive days for the timeline.
export function groupByDay(items, getDate = (item) => item.date) {
  const groups = [];
  for (const item of items) {
    const date = getDate(item);
    const key = new Date(date).toISOString().slice(0, 10);
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.items.push(item);
    else groups.push({ key, date, items: [item] });
  }
  return groups;
}

export function initials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}
