// [codex] 01a20fe2-64d6-75c3-b882-47be7173d5eb · P39 independent publication and editorial readers.
import {archiveEvent} from './core.mjs';

const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const slug = value => typeof value === 'string' && value.length <= 100 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
const own = (value, key) => {
  if (!object(value) && !Array.isArray(value)) return undefined;
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  return descriptor?.enumerable && Object.hasOwn(descriptor, 'value') ? descriptor.value : undefined;
};
const dictionary = () => Object.create(null);
const emptyEditorial = () => ({events: dictionary(), series: []});

// JSON data only; never evaluate getters/toJSON or inherit historical prototype keys.
// The generous bounds fail a broken source closed without truncating good source records.
function detachedJSON(value, active = new Set(), budget = {nodes: 100000}, depth = 0) {
  if (--budget.nodes < 0 || depth > 32) throw Error('catalog_structure_limit');
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value !== 'object') return undefined;
  if (active.has(value)) throw Error('catalog_cycle');
  active.add(value);
  try {
    if (Array.isArray(value)) {
      if (value.length > 100000) throw Error('catalog_structure_limit');
      const result = [];
      for (let index = 0; index < value.length; index++) result.push(detachedJSON(own(value, String(index)), active, budget, depth + 1) ?? null);
      return result;
    }
    const result = dictionary();
    for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(value))) {
      if (!descriptor.enumerable || !Object.hasOwn(descriptor, 'value')) continue;
      const child = detachedJSON(descriptor.value, active, budget, depth + 1);
      if (child !== undefined) result[key] = child;
    }
    return result;
  } finally { active.delete(value); }
}

function normalizeEditorial(value) {
  if (!object(value)) return emptyEditorial();
  const result = detachedJSON(value), events = dictionary();
  const strings = ['dateLabel', 'datePrecision', 'evidenceLabel', 'imageCredit', 'programNote', 'series', 'theme', 'venue'];
  const textLists = ['story', 'program', 'workshops', 'routeHighlights'];
  const objectLists = ['additionalSources', 'subprograms', 'photoMetadata', 'posterMetadata'];
  const sourceEvents = object(result.events) ? result.events : dictionary();
  for (const [id, record] of Object.entries(sourceEvents)) {
    if (!slug(id) || !object(record)) continue;
    for (const key of strings) if (Object.hasOwn(record, key) && record[key] !== null && typeof record[key] !== 'string') delete record[key];
    for (const key of textLists) {
      if (!Object.hasOwn(record, key) || record[key] === null) continue;
      if (Array.isArray(record[key])) record[key] = record[key].filter(item => typeof item === 'string');
      else delete record[key];
    }
    for (const key of objectLists) {
      if (!Object.hasOwn(record, key) || record[key] === null) continue;
      if (Array.isArray(record[key])) record[key] = record[key].filter(object);
      else delete record[key];
    }
    for (const key of ['source', 'programSource', 'workshopSource']) {
      if (Object.hasOwn(record, key) && record[key] !== null && !object(record[key])) delete record[key];
    }
    if (Object.hasOwn(record, 'publishedProgram') && record.publishedProgram !== null) {
      if (!Array.isArray(record.publishedProgram)) delete record.publishedProgram;
      else record.publishedProgram = record.publishedProgram.filter(day => object(day) && typeof day.label === 'string' && Array.isArray(day.items))
        .map(day => Object.assign(dictionary(), day, {items: day.items.filter(item => object(item) && typeof item.title === 'string')}));
    }
    events[id] = record;
  }
  result.events = events;
  result.series = Array.isArray(result.series) ? result.series.filter(item => object(item) && slug(item.slug)
    && typeof item.title === 'string' && typeof item.intro === 'string' && typeof item.category === 'string'
    && Array.isArray(item.slugs) && item.slugs.every(slug)) : [];
  return result;
}

function normalizeEvents(value, preview) {
  const source = own(value, 'events');
  if (!Array.isArray(source)) throw Error('catalog_unavailable');
  const events = detachedJSON(source), selected = [], seen = new Set();
  for (const event of events) {
    if (!object(event)) throw Error('invalid_catalog_event');
    // Explicitly hidden records are never converted into a public archive record.
    if (event.status === 'draft' || event.hidden === true || event.published === false || event.public === false) continue;
    if (!slug(event.slug) || typeof event.title !== 'string' || !event.title.trim() || seen.has(event.slug)) throw Error('invalid_catalog_event');
    if ((!preview || event.status !== undefined) && !['published', 'closed', 'cancelled'].includes(event.status)) throw Error('invalid_catalog_status');
    seen.add(event.slug);
    if (!preview) selected.push(event);
    else {
      const archived = Object.assign(dictionary(), archiveEvent(event));
      if (event.status === 'cancelled') archived.status = 'cancelled';
      selected.push(archived);
    }
  }
  return selected;
}

/** The caller owns I/O/timeouts and view lifetime; this module neither caches nor merges authorities. */
export async function loadPublishedCatalog({preview = false, readArchive, readEditorial, readCurrent} = {}) {
  const staticMode = preview === true;
  const invoke = reader => Promise.resolve().then(() => {
    if (typeof reader !== 'function') throw Error('reader_unavailable');
    return reader();
  });
  const editorialResult = invoke(readEditorial).then(normalizeEditorial).catch(() => emptyEditorial());
  const publicationResult = invoke(staticMode ? readArchive : readCurrent)
    .then(value => ({events: normalizeEvents(value, staticMode), availability: 'available'}))
    .catch(() => ({events: [], availability: 'unavailable'}));
  const [publication, editorial] = await Promise.all([publicationResult, editorialResult]);
  return {...publication, editorial, live: !staticMode && publication.availability === 'available'};
}
