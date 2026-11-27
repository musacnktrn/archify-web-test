// [codex] 01a20fd9-f999-7b90-8b1b-b8cd977d4517 · Public event photo albums.
import {apiURL,archiveEvent,isPreviewDeployment} from './core.mjs';
import {archiveGallery,createPhotoViewer} from './archive-photos.mjs';
import {setupNavigation} from './navigation.mjs';
import {mountPhotoAlbums} from './photo-albums.mjs';
import {mountAlbumMeasurement} from './album-measurement.mjs';

const preview = isPreviewDeployment(document,location);
const base = new URL('./',location.href);
const validSlug = value => typeof value === 'string' && value.length <= 160 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);

async function readJSON(url, cache='no-store') {
  const response = await fetch(url,{credentials:'omit',cache,redirect:'error',headers:{Accept:'application/json'},signal:AbortSignal.timeout(12000)});
  if (!response.ok) throw Object.assign(new Error('unavailable'),{status:response.status});
  return response.json();
}

function editorialData() {
  return readJSON(new URL('data/editorial.json',base),'no-cache').catch(() => ({events:{}}));
}

async function loadArchive() {
  const url = preview ? new URL('data/catalog.json',base) : apiURL('events',base);
  const [records,editorial] = await Promise.all([readJSON(url,preview?'no-cache':'no-store'),editorialData()]);
  if (!Array.isArray(records?.events)) throw new Error('unavailable');
  return {events:preview ? records.events.map(archiveEvent) : records.events,editorial,preview};
}

async function loadEvent(slug) {
  if (!validSlug(slug)) return {event:null,editorial:{events:{}},preview};
  if (preview) {
    const {events,editorial} = await loadArchive();
    return {event:events.find(event => event.slug === slug) || null,editorial,preview};
  }
  try {
    const [response,editorial] = await Promise.all([readJSON(apiURL('events/'+slug,base)),editorialData()]);
    return {event:response?.event?.slug === slug ? response.event : null,editorial,preview};
  } catch (error) {
    if (error.status === 403 || error.status === 404) return {event:null,editorial:{events:{}},preview};
    throw error;
  }
}

document.documentElement.classList.add('js');
setupNavigation();
document.querySelector('#deployment-notice').hidden = !preview;
const selected = new URLSearchParams(location.search).getAll('etkinlik');
const slug = selected.length === 0 ? null : selected.length === 1 && validSlug(selected[0]) ? selected[0] : '!';
const host = document.querySelector('#photo-albums');
const viewer = createPhotoViewer(document);
const measurement = mountAlbumMeasurement({document,window,host,selectedSlug:slug,preview});
void mountPhotoAlbums({host,selectedSlug:slug,loadArchive,loadEvent,
  resolvePhotos:archiveGallery,openGallery:({photos,index,trigger}) => {
    viewer.open(photos,index,trigger);
    if(document.querySelector('#gallery-dialog').open)measurement.openedPhoto();
  },closeGallery:viewer.close});
