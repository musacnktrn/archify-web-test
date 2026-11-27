// [codex] 01a20fd9-f999-7b90-8b1b-b8cd977d4517 · Shared event and album photo viewer.
import {safeURL, escapeHTML as esc} from './core.mjs';

// [codex] R11: publication decides which photographs exist; editorial metadata only describes an exact published src.
export function archiveGallery(event, editorial = {}) {
  const metadata = new Map((Array.isArray(editorial.photoMetadata) ? editorial.photoMetadata : []).filter(item => item && typeof item.src === 'string').map(item => [item.src,item]));
  const seen = new Set();
  const localImage = value => typeof value === 'string' && /^(?:assets|media)\//.test(value) ? safeURL(value,{image:true}) : '';
  return (Array.isArray(event.gallery) ? event.gallery : []).flatMap(item => {
    if (!item || !safeURL(item.src,{image:true}) || seen.has(item.src)) return [];
    seen.add(item.src);
    const meta = metadata.get(item.src) || {};
    const text = value => typeof value === 'string' && value.trim() ? value.trim() : '';
    const width = Number.isInteger(meta.width) && meta.width > 0 && meta.width <= 20000 ? meta.width : 1200;
    const height = Number.isInteger(meta.height) && meta.height > 0 && meta.height <= 20000 ? meta.height : 800;
    const variants = (Array.isArray(meta.variants) ? meta.variants : []).filter(v => v && localImage(v.src) && Number.isInteger(v.width) && v.width > 0 && v.width <= width);
    return [{src:safeURL(item.src,{image:true}),alt:text(item.alt) || event.title || 'Etkinlik fotoğrafı',caption:text(meta.caption) || text(item.alt) || event.title || 'Etkinlik fotoğrafı',sourceLabel:text(meta.sourceLabel),sourceUrl:safeURL(meta.sourceUrl),thumbnailSrc:localImage(meta.thumbnailSrc) || safeURL(item.src,{image:true}),width,height,variants}];
  });
}

export function createPhotoViewer(document) {
  const $ = selector => document.querySelector(selector);
  let gallery = [], galleryIndex = 0, returnFocus = null;
  function paintGallery() {
    const item = gallery[galleryIndex]; if (!item) return;
    $('#lightbox-image').src = safeURL(item.src,{image:true}); $('#lightbox-image').alt = item.alt || 'Etkinlik fotoğrafı';
    $('#gallery-caption').textContent = `${galleryIndex+1} / ${gallery.length} · ${item.caption || item.alt || 'Etkinlik fotoğrafı'}${item.sourceLabel ? ' · '+item.sourceLabel : ''}`;
    $('#gallery-prev').disabled = gallery.length < 2; $('#gallery-next').disabled = gallery.length < 2;
    const thumbnails=$('#gallery-thumbnails');
    if(thumbnails){
      const restoreThumbFocus=thumbnails.contains(document.activeElement);
      const start=Math.max(0,Math.min(galleryIndex-3,gallery.length-7));
      thumbnails.innerHTML=gallery.slice(start,start+7).map((photo,i)=>`<button type="button" data-lightbox-index="${start+i}" aria-label="Fotoğraf ${start+i+1} / ${gallery.length}" aria-pressed="${start+i===galleryIndex}"><img src="${esc(photo.thumbnailSrc)}" alt="" loading="lazy" width="96" height="64"><span>${start+i+1}</span></button>`).join('');
      thumbnails.querySelectorAll('[data-lightbox-index]').forEach(button=>button.addEventListener('click',()=>{galleryIndex=Number(button.dataset.lightboxIndex);paintGallery();thumbnails.querySelectorAll('[data-lightbox-index]').forEach(next=>{if(Number(next.dataset.lightboxIndex)===galleryIndex)next.focus();});}));
      if(restoreThumbFocus)thumbnails.querySelectorAll('[data-lightbox-index]').forEach(button=>{if(Number(button.dataset.lightboxIndex)===galleryIndex)button.focus();});
    }
  }
  function clearDisplay() {
    gallery = [];
    const image = $('#lightbox-image');
    image.removeAttribute('src');
    image.removeAttribute('srcset');
    image.alt = '';
    $('#gallery-caption').textContent = '';
    const thumbnails = $('#gallery-thumbnails');
    if (thumbnails) thumbnails.innerHTML = '';
  }
  function closeGallery() {
    if ($('#gallery-dialog').open) $('#gallery-dialog').close();
    clearDisplay();
  }
  function openGallery(photos, index, trigger) {
    if (!Array.isArray(photos) || !Number.isInteger(index) || !photos[index]) return;
    gallery = photos;
    galleryIndex = index;
    returnFocus = trigger;
    paintGallery();
    $('#gallery-dialog').showModal();
    document.body.classList.add('gallery-open');
    $('.lightbox-close').focus();
  }
  $('#gallery-dialog').addEventListener('close', () => {
    if ($('#gallery-dialog').open) return;
    document.body.classList.remove('gallery-open');
    clearDisplay();
    const trigger = returnFocus;
    returnFocus = null;
    if (trigger?.isConnected !== false) trigger?.focus();
  });
  $('.lightbox-close').addEventListener('click',closeGallery);
  $('#gallery-prev').addEventListener('click', () => { galleryIndex=(galleryIndex-1+gallery.length)%gallery.length; paintGallery(); });
  $('#gallery-next').addEventListener('click', () => { galleryIndex=(galleryIndex+1)%gallery.length; paintGallery(); });
  $('#gallery-dialog').addEventListener('keydown',event => { if (gallery.length > 1 && ['ArrowLeft','ArrowRight'].includes(event.key)) { event.preventDefault(); galleryIndex=(galleryIndex+(event.key==='ArrowLeft'?-1:1)+gallery.length)%gallery.length; paintGallery(); } });
  $('#gallery-dialog').addEventListener('click',event => { if (event.target === $('#gallery-dialog')) { const rect = event.target.getBoundingClientRect(); if(event.clientX<rect.left || event.clientX>rect.right || event.clientY<rect.top || event.clientY>rect.bottom) closeGallery(); } });

  return {open:openGallery, close:closeGallery};
}
