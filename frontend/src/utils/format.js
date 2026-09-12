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
  if (start && end) return `${start} to ${end}`;
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
