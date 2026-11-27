// [codex] 01a20fe2-64d6-75c3-b882-47be7173d5eb · P35 pure public event calendar file.
// The caller supplies one fresh canonical event response and its server observation time.
const encoder = new TextEncoder();
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const instantPattern = /^(?:19\d{2}|20\d{2}|21\d{2}|2200)-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;

function utcInstant(value) {
  if (typeof value !== 'string' || !instantPattern.test(value)) return null;
  const instant = Date.parse(value);
  if (!Number.isFinite(instant) || new Date(instant).toISOString() !== value.slice(0, -1) + '.000Z') return null;
  return instant;
}

function validText(value, maximum, required = false) {
  if (typeof value !== 'string' || (required && !value.trim())) return false;
  let count = 0;
  for (const character of value) {
    const point = character.codePointAt(0);
    if (++count > maximum || (point >= 0xd800 && point <= 0xdfff)
      || (point < 0x20 && ![9, 10, 13].includes(point)) || point === 0x7f) return false;
  }
  return true;
}

function optionalText(value, maximum) {
  return value === null || value === undefined || validText(value, maximum);
}

/** A registration-closed event may still be upcoming or running. No browser-clock fallback. */
export function eventCalendarEligibility(event, { serverNow, expectedSlug, preview = false } = {}) {
  const unavailable = reason => ({ available: false, reason });
  if (preview !== false) return unavailable('preview');
  if (typeof expectedSlug !== 'string' || expectedSlug.length > 100 || !slugPattern.test(expectedSlug)) return unavailable('invalid_slug');
  if (!event || typeof event !== 'object' || Array.isArray(event) || event.slug !== expectedSlug
    || !['published', 'closed'].includes(event.status) || event.archived !== false) return unavailable('event_unavailable');
  const observation = utcInstant(serverNow);
  if (observation === null) return unavailable('missing_server_time');
  const start = utcInstant(event.startAt), end = utcInstant(event.endAt);
  if (start === null || end === null || end <= start) return unavailable('invalid_time');
  if (end <= observation) return unavailable('ended');
  if (!validText(event.title, 180, true) || !optionalText(event.summary, 6000)
    || !optionalText(event.city, 100) || !optionalText(event.venue, 300)) return unavailable('invalid_text');
  return { available: true, reason: 'available' };
}

function calendarText(value) {
  return value.replace(/\r\n|\r/g, '\n').replace(/\\/g, '\\\\').replace(/\n/g, '\\n')
    .replace(/;/g, '\\;').replace(/,/g, '\\,');
}

/** Fold by UTF-8 octets; continuation whitespace counts and a code point is never split. */
function foldLine(value) {
  const lines = [];
  let line = '', octets = 0;
  for (const character of value) {
    const size = encoder.encode(character).length;
    if (octets + size > 75) {
      lines.push(line);
      line = ' ';
      octets = 1;
    }
    line += character;
    octets += size;
  }
  lines.push(line);
  return lines.join('\r\n');
}

function basicUTC(value) { return value.replace(/[-:]/g, ''); }

/** No URL, environment, member, attendee, alarm, invite, storage or transport input is used. */
export function createEventCalendarFile(event, options = {}) {
  const state = eventCalendarEligibility(event, options);
  if (!state.available) throw Object.assign(new Error('calendar_' + state.reason), { code: 'calendar_' + state.reason });
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Archify//Public Event Calendar//TR',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    'UID:' + event.slug + '@events.archify.com.tr',
    'DTSTAMP:' + basicUTC(options.serverNow),
    'DTSTART:' + basicUTC(event.startAt),
    'DTEND:' + basicUTC(event.endAt),
    'SUMMARY:' + calendarText(event.title)
  ];
  if (typeof event.summary === 'string' && event.summary.trim()) lines.push('DESCRIPTION:' + calendarText(event.summary));
  const location = [...new Set([event.venue, event.city].filter(value => typeof value === 'string' && value.trim()).map(value => value.trim()))].join(' · ');
  if (location) lines.push('LOCATION:' + calendarText(location));
  lines.push('END:VEVENT', 'END:VCALENDAR');
  return { filename: 'archify-' + event.slug + '.ics', mimeType: 'text/calendar;charset=utf-8', text: lines.map(foldLine).join('\r\n') + '\r\n' };
}
