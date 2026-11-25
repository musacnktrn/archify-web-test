// [codex] 01a20fe8-199e-7631-8910-07e7d27b753d · public visitor implementation
import { escapeHTML as esc, safeURL, filterEvents, registrationState, archiveEvent, apiURL, errorMessage, normalizePhone } from './core.mjs';
import { CATEGORY_PAGES, categoryPage, communityTargets, additionalGroups, directInvite, videoEmbedURL } from './information.mjs';
import { setupNavigation } from './navigation.mjs';

const $ = (selector, root = document) => root.querySelector(selector);
const page = document.body.dataset.page;
const preview = document.querySelector('meta[name="deployment"]')?.content !== 'server' || location.hostname.endsWith('.github.io') || location.protocol === 'file:';
const base = new URL('./', location.href);
const params = new URLSearchParams(location.search);
let csrfToken;
let gallery = [];
let galleryIndex = 0;
let returnFocus = null;
document.documentElement.classList.add('js');
if (preview) $('#deployment-notice').hidden = false;

async function request(route, body) {
  if (preview) throw Object.assign(new Error('preview'), { code: 'preview', status: 0 });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(apiURL(route, base), {
      method: body ? 'POST' : 'GET', credentials: 'same-origin', cache: 'no-store', signal: controller.signal,
      headers: body ? { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken || '' } : { 'Accept': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {})
    });
    let data;
    try { data = await response.json(); } catch { throw Object.assign(new Error('network'), { code: 'network', status: response.status >= 500 ? response.status : 0 }); }
    if (!response.ok) throw Object.assign(new Error(data.error || 'service_unavailable'), { code: data.error, status: response.status });
    return data;
  } catch (error) {
    if (error.status !== undefined) throw error;
    throw Object.assign(new Error('network'), { code: 'network', status: 0 });
  } finally { clearTimeout(timer); }
}
async function session() {
  const value = await request('session');
  if (typeof value.csrfToken !== 'string' || !value.csrfToken) throw Object.assign(new Error('network'), { code: 'network', status: 0 });
  csrfToken = value.csrfToken; return value;
}
async function staticJSON(file) {
  const response = await fetch(new URL(file, base), { cache: 'no-cache' });
  if (!response.ok) throw new Error('catalog_unavailable');
  return response.json();
}
const catalogPromise = staticJSON('data/catalog.json');
const editorialPromise = staticJSON('data/editorial.json');
// Static editorial sources never confer current registration permission.
async function loadData() {
  const [catalog, editorial] = await Promise.all([catalogPromise, editorialPromise]);
  if (preview) return { events: catalog.events.map(archiveEvent), editorial, live: false };
  try {
    const data = await request('events');
    if (!Array.isArray(data.events)) throw new Error('invalid_response');
    return { events: data.events.filter(e => e.status !== 'draft'), editorial, live: true };
  } catch {
    return { events: catalog.events.map(archiveEvent), editorial, live: false };
  }
}
function eventURL(event) { return 'etkinlik.html?slug=' + encodeURIComponent(event.slug); }
function photo(event) { return (Array.isArray(event.gallery) ? event.gallery : []).find(item => safeURL(item.src, { image: true })); }
function categoryClass(category) { return ({'Festival':'festival','Zirve':'zirve','Buluşma':'bulusma','Sempozyum':'sempozyum'})[category] || 'zirve'; }
function cover(event) {
  const image = photo(event);
  if (image) return `<div class="cover cover-photo"><img src="${esc(safeURL(image.src, { image:true }))}" alt="${esc(image.alt || event.title)}" loading="lazy" width="1200" height="1600"></div>`;
  const label = event.category === 'Festival' ? 'ARCH<br>FEST' : event.category === 'Sempozyum' ? 'Ortak<br>gelecek.' : event.category === 'Buluşma' ? 'Yeni<br>vizyon.' : 'Birlikte<br>düşün.';
  return `<div class="cover cover-${categoryClass(event.category)}" aria-hidden="true"><span class="cover-category">${esc(event.category)}</span><span class="cover-word">${label}</span><span class="cover-year">${esc(event.year || '')}</span></div>`;
}
function source(event, editorial) {
  const src = editorial.events[event.slug]?.source;
  return src && safeURL(src.url) ? `<a class="source-link" href="${esc(safeURL(src.url))}" target="_blank" rel="noopener noreferrer">Kaynak: ${esc(src.title)}</a>` : '';
}
function card(event, editorial) {
  return `<article class="editorial-card"><a href="${eventURL(event)}">${cover(event)}<p class="card-meta">${esc([event.category,event.city,event.year].filter(Boolean).join(' · '))}</p><h3>${esc(event.title)}</h3></a>${source(event, editorial)}</article>`;
}
function row(event, editorial) {
  return `<article class="archive-row"><span class="archive-year">${esc(event.year || '')}</span><a href="${eventURL(event)}" tabindex="-1" aria-hidden="true">${cover(event)}</a><div><p class="card-meta">${esc([event.category,event.city].filter(Boolean).join(' · '))}</p><h2><a href="${eventURL(event)}">${esc(event.title)}</a></h2><p>${esc(event.summary)}</p>${source(event,editorial)}</div></article>`;
}
function seriesRows(series) {
  return series.map(item => `<article class="series-row"><div><p class="eyebrow">${esc(item.category)}</p><h3>${esc(item.title)}</h3></div><p>${esc(item.intro)}</p><a class="text-link" href="seri.html?seri=${encodeURIComponent(item.slug)}">Seriyi keşfet<span class="visually-hidden">: ${esc(item.title)}</span></a></article>`).join('');
}
function friendlyDate(value) {
  if (!value || !Number.isFinite(Date.parse(value))) return '';
  return new Intl.DateTimeFormat('tr-TR', { day:'numeric', month:'long', year:'numeric', timeZone:'Europe/Istanbul' }).format(new Date(value));
}
function noEvents(live) {
  const title = live ? 'Yeni buluşmalar burada olacak.' : 'Yeni buluşmaları birlikte bekleyelim.';
  return `<div class="empty-state"><h3>${title}</h3><p>${!live && !preview ? 'Güncel takvime şu an ulaşamıyoruz. ' : ''}Duyurular için resmî Archify topluluğunu takip edebilir, bu sırada geçmiş buluşmaların hikâyelerini keşfedebilirsin.</p><div class="button-row"><a class="button" href="topluluk.html">Topluluğa katıl</a><a class="text-link" href="arsiv.html">Arşivi gez</a></div></div>`;
}
async function renderHome(data) {
  const selected = ['istanbul-mimarlik-zirvesi-2026','izmir-mimarlik-zirvesi-2026','women-of-architecture-2026'].map(slug => data.events.find(e => e.slug === slug)).filter(Boolean);
  $('#home-events').innerHTML = selected.map(e => card(e, data.editorial)).join('') || noEvents(data.live);
  await renderMedia('#home-media');
  const open = data.events.filter(event => registrationState(event).open).sort((a,b) => (Date.parse(a.startAt) || Infinity) - (Date.parse(b.startAt) || Infinity))[0];
  if (open && data.live) { const action = $('#hero-action'); action.href = eventURL(open); action.textContent = 'Etkinliğe başvur'; action.title = open.title; }
}
function renderArchive(data) {
  const events = data.events.filter(event => event.archived || (event.endAt && Date.parse(event.endAt) < Date.now()));
  const categories = [...new Set(events.map(e => e.category).filter(Boolean))].sort((a,b) => a.localeCompare(b,'tr'));
  const years = [...new Set(events.map(e => e.year).filter(Boolean))].sort((a,b) => b-a);
  $('#category').innerHTML += categories.map(v => `<option value="${esc(v)}">${esc(v)}</option>`).join('');
  $('#year').innerHTML += years.map(v => `<option value="${v}">${v}</option>`).join('');
  function readURL() { $('#search').value = params.get('q') || ''; $('#category').value = params.get('category') || ''; $('#year').value = params.get('year') || ''; }
  function draw(updateURL = true) {
    const values = {q:$('#search').value,category:$('#category').value,year:$('#year').value};
    const filtered = filterEvents(events,values).sort((a,b) => (b.year || 0) - (a.year || 0));
    $('#result-count').textContent = `${filtered.length} buluşma`;
    $('#event-list').innerHTML = filtered.length ? filtered.map(e => row(e,data.editorial)).join('') : '<div class="empty-state"><h2>Henüz karşılaşmadık.</h2><p>Bu aramayla eşleşen bir etkinlik bulunamadı. Farklı bir kelime deneyebilir veya filtreleri temizleyebilirsin.</p><button class="button button-secondary" id="clear-results" type="button">Tüm arşivi göster</button></div>';
    $('#clear-results')?.addEventListener('click', () => { $('#event-filters').reset(); });
    if (updateURL) { const next = new URL(location.href); for (const [key,value] of Object.entries(values)) value ? next.searchParams.set(key,value) : next.searchParams.delete(key); history.replaceState(null,'',next); }
  }
  readURL(); draw(false);
  $('#event-filters').addEventListener('input', () => draw());
  $('#event-filters').addEventListener('submit', event => { event.preventDefault(); draw(); });
  $('#event-filters').addEventListener('reset', () => setTimeout(() => draw(),0));
}
function renderEvents(data) {
  const upcoming = data.events.filter(event => !event.archived && !(event.endAt && Date.parse(event.endAt) < Date.now()));
  $('#upcoming-events').innerHTML = upcoming.length ? `<div class="editorial-grid">${upcoming.map(e => card(e,data.editorial)).join('')}</div>` : noEvents(data.live);
  $('#series-list').innerHTML = seriesRows(data.editorial.series);
}
function renderSeries(data) {
  const requested = params.get('seri');
  if (!requested) { $('#series-list').innerHTML = seriesRows(data.editorial.series); return; }
  const series = data.editorial.series.find(s => s.slug === requested);
  if (!series) { $('#series-intro').innerHTML = '<p class="eyebrow">Seri bulunamadı</p><h1>Başka bir<br><em>buluşmaya.</em></h1><a class="text-link" href="seri.html">Tüm serileri göster</a>'; return; }
  document.title = `${series.title} · Archify`;
  $('#series-intro').innerHTML = `<p class="eyebrow">${esc(series.category)} · Archify serileri</p><h1>${esc(series.title)}</h1><p class="lead">${esc(series.intro)}</p><a class="text-link" href="seri.html">Tüm seriler</a>`;
  $('#series-list').hidden = true;
  const events = series.slugs.map(slug => data.events.find(e => e.slug === slug)).filter(Boolean).sort((a,b) => (b.year || 0) - (a.year || 0));
  $('#series-events').innerHTML = events.length ? events.map(e => row(e,data.editorial)).join('') : noEvents(data.live);
}
async function trackNavigation(slug) {
  if (preview) return;
  const navigationId = new URLSearchParams(location.hash.slice(1)).get('nav');
  if (!navigationId || !/^[a-zA-Z0-9_-]{16,128}$/.test(navigationId)) return;
  const key = 'archify-view:' + navigationId;
  try { if (sessionStorage.getItem(key)) return; sessionStorage.setItem(key,'attempted'); } catch { /* Browser storage is optional. One call per page invocation. */ }
  try { await session(); await request('links/view',{navigationId,eventSlug:slug}); } catch { /* Read-only detail remains available; never manufacture a visit or retry automatically. */ }
}
async function renderDetail(data) {
  const slug = params.get('slug');
  let event = data.events.find(e => e.slug === slug);
  if (slug && !preview) {
    try { const response = await request('events/'+encodeURIComponent(slug)); event = response.event; }
    catch(error) { if (error.status === 404 || error.status === 403) event = null; }
  }
  if (!event || event.status === 'draft') {
    $('#event-detail').innerHTML = '<section class="section page-intro"><p class="eyebrow">Etkinlik bulunamadı</p><h1>Başka bir<br><em>hikâyeye bakalım.</em></h1><p class="lead">Bu etkinlik yayımlanmamış, kaldırılmış veya bağlantısı eksik olabilir.</p><a class="button" href="arsiv.html">Arşive dön</a></section>'; return;
  }
  document.title = event.title + ' · Archify'; $('#breadcrumb-current').textContent = event.title;
  const edit = data.editorial.events[event.slug] || {};
  const state = registrationState(event);
  const image = photo(event);
  const date = friendlyDate(event.startAt) || edit.dateLabel || (event.year ? String(event.year) : 'Tarih duyurulacak');
  const venue = event.venue || edit.venue;
  const story = edit.story || [event.summary];
  gallery = (event.gallery || []).filter(item => safeURL(item.src,{image:true}));
  const sources = [edit.source,...(edit.additionalSources || [])].filter(s => s && safeURL(s.url));
  $('#event-detail').innerHTML = `<header class="section detail-header"><p class="eyebrow">${esc([event.category,event.archived ? 'Arşiv' : state.label].filter(Boolean).join(' · '))}</p><h1>${esc(event.title)}</h1><div class="detail-meta"><span>${esc(date)}</span>${event.city ? `<span>${esc(event.city)}</span>` : ''}${venue ? `<span>${esc(venue)}</span>` : ''}</div></header>
  <div class="detail-visual">${image ? `<img src="${esc(safeURL(image.src,{image:true}))}" alt="${esc(image.alt || event.title)}" width="1200" height="1600">` : cover(event)}</div>
  <div class="section detail-body"><div class="detail-story"><p class="eyebrow">${esc(edit.series || 'Etkinlik hakkında')}</p><h2>${esc(edit.theme || event.title)}</h2><div class="prose">${story.filter(Boolean).map(p => `<p>${esc(p)}</p>`).join('')}</div>${edit.program?.length ? `<div class="detail-program"><h3>Yayımlanan programdan</h3><ul>${edit.program.map(item=>`<li>${esc(item)}</li>`).join('')}</ul></div>` : ''}${sources.length ? `<div class="detail-source"><p class="eyebrow">Yayımlanan kaynaklar</p>${sources.map(s => `<a class="source-link" href="${esc(safeURL(s.url))}" target="_blank" rel="noopener noreferrer">${esc(s.title)}</a>`).join('')}</div>` : ''}</div><aside class="detail-aside"><p class="eyebrow">${esc(state.label)}</p><h3>${state.open ? 'Birlikte buluşalım.' : 'Hikâye burada kalmıyor.'}</h3><p>${esc(state.detail)}</p>${state.open ? `<a class="button" href="basvuru.html?slug=${encodeURIComponent(event.slug)}">Etkinliğe başvur</a>` : '<a class="button" href="topluluk.html">Yeni buluşmaları takip et</a>'}</aside></div>
  <section class="section gallery-section"><div class="section-heading"><h2>Buluşmadan <em>izler.</em></h2></div>${gallery.length ? `<div class="gallery-grid">${gallery.map((item,i) => `<button class="gallery-thumb" type="button" data-gallery-index="${i}" aria-label="${esc(item.alt || event.title)}, galeride aç"><img src="${esc(safeURL(item.src,{image:true}))}" alt="${esc(item.alt || event.title)}" loading="lazy" width="1200" height="1600"><span>Fotoğrafı büyüt</span></button>`).join('')}</div><p class="gallery-note">${esc(edit.imageCredit || 'Bu etkinliğe ait yayımlanan galeri seçkisi.')}</p>` : '<p class="gallery-empty">Bu etkinliğin fotoğraf seçkisi henüz yayımlanmadı.</p>'}</section>`;
  document.querySelectorAll('[data-gallery-index]').forEach(button => button.addEventListener('click', () => openGallery(Number(button.dataset.galleryIndex),button)));
  const media=await staticJSON('data/media.json').catch(()=>({videos:[]}));
  const related=media.videos.filter(video=>video.eventSlug===event.slug);
  if(related.length)$('#event-detail').insertAdjacentHTML('beforeend',`<section class="section detail-related"><div class="section-heading"><h2>Bu buluşma <em>ekranda.</em></h2><a class="text-link" href="medya.html">Tüm içerikler</a></div><div class="video-grid">${related.map(videoCard).join('')}</div></section>`);
  setupVideoPlayers();
  await trackNavigation(event.slug);
}
function paintGallery() {
  const item = gallery[galleryIndex]; if (!item) return;
  $('#lightbox-image').src = safeURL(item.src,{image:true}); $('#lightbox-image').alt = item.alt || 'Etkinlik fotoğrafı';
  $('#gallery-caption').textContent = `${galleryIndex+1} / ${gallery.length} · ${item.alt || 'Etkinlik fotoğrafı'}`;
  $('#gallery-prev').disabled = gallery.length < 2; $('#gallery-next').disabled = gallery.length < 2;
}
function openGallery(index,trigger) { galleryIndex = index; returnFocus = trigger; paintGallery(); $('#gallery-dialog').showModal(); document.body.classList.add('gallery-open'); $('.lightbox-close').focus(); }
function closeGallery() { $('#gallery-dialog').close(); }
$('#gallery-dialog').addEventListener('close', () => { document.body.classList.remove('gallery-open'); returnFocus?.focus(); });
$('.lightbox-close').addEventListener('click',closeGallery);
$('#gallery-prev').addEventListener('click', () => { galleryIndex=(galleryIndex-1+gallery.length)%gallery.length; paintGallery(); });
$('#gallery-next').addEventListener('click', () => { galleryIndex=(galleryIndex+1)%gallery.length; paintGallery(); });
$('#gallery-dialog').addEventListener('keydown',event => { if (gallery.length > 1 && ['ArrowLeft','ArrowRight'].includes(event.key)) { event.preventDefault(); galleryIndex=(galleryIndex+(event.key==='ArrowLeft'?-1:1)+gallery.length)%gallery.length; paintGallery(); } });
$('#gallery-dialog').addEventListener('click',event => { if (event.target === $('#gallery-dialog')) { const rect = event.target.getBoundingClientRect(); if(event.clientX<rect.left || event.clientX>rect.right || event.clientY<rect.top || event.clientY>rect.bottom) closeGallery(); } });

function videoCard(video){
 const url=safeURL(video.url);if(!url||!videoEmbedURL(video.id))return '';
 return `<article class="video-card" data-video-id="${esc(video.id)}"><div class="video-player" id="video-player-${esc(video.id)}"><button class="video-cover video-trigger" type="button" data-video-trigger="${esc(video.id)}" data-video-title="${esc(video.title)}" aria-label="${esc(video.title)} — bu sayfada oynat"><span>${esc(video.kind)}</span><strong>${esc(video.title)}</strong><span class="video-play">Videoyu oynat</span></button></div><h3>${esc(video.subtitle)}</h3><p>${esc(video.description)}</p><div class="video-links"><a class="text-link video-link" href="${esc(url)}" target="_blank" rel="noopener noreferrer">YouTube’da aç</a><a class="text-link" href="etkinlik.html?slug=${encodeURIComponent(video.eventSlug)}">Buluşmanın hikâyesi</a></div></article>`;
}
function setupVideoPlayers(){
 document.querySelectorAll('[data-video-trigger]').forEach(button=>button.addEventListener('click',()=>{
  const id=button.dataset.videoTrigger,url=videoEmbedURL(id);if(!url)return;
  const host=$('#video-player-'+id);if(!host)return;
  host.innerHTML=`<iframe src="${esc(url)}" title="YouTube: ${esc(button.dataset.videoTitle)}" loading="lazy" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>`;
 }));
}
async function renderMedia(selector='#media-list'){
 const data=await staticJSON('data/media.json');
 $(selector).innerHTML=data.videos.map(videoCard).join('');setupVideoPlayers();
}
function renderCategory(data){
 const spec=categoryPage(params.get('tur'));
 if(!spec){$('#category-intro').innerHTML='<p class="eyebrow">Altı farklı karşılaşma</p><h1>Merakının<br><em>peşinden.</em></h1><p class="lead">Keşfetmek istediğin etkinlik türünü seç.</p><div class="category-grid">'+CATEGORY_PAGES.map((c,i)=>`<a class="category-tile" href="kategori.html?tur=${c.id}"><span class="category-number">0${i+1}</span><h3>${esc(c.name)}</h3></a>`).join('')+'</div>';$('#category-upcoming').innerHTML=noEvents(data.live);$('#category-past').innerHTML='<p class="category-note">Geçmiş buluşmalar için bir kategori seçebilir veya tüm arşivi gezebilirsin.</p>';$('#category-series').innerHTML=seriesRows(data.editorial.series);return;}
 document.title=spec.name+' · Archify';
 const [first,last]=spec.title.split('\n');
 $('#category-intro').innerHTML=`<p class="eyebrow">${esc(spec.name)} · ${esc(spec.kicker)}</p><h1>${esc(first)}<br><em>${esc(last)}</em></h1><p class="lead">${esc(spec.intro)}</p><ul class="category-topics">${spec.topics.map(t=>`<li>${esc(t)}</li>`).join('')}</ul><nav class="category-jump" aria-label="Kategori bölümleri"><a href="#category-upcoming">Yaklaşan etkinlikler</a><a href="#kategori-arsiv">Geçmiş buluşmalar</a><a href="#kategori-seriler">Seriler</a><a href="etkinlikler.html">Tüm kategoriler</a></nav>`;
 const selected=data.events.filter(e=>spec.matches.includes(e.category)),past=selected.filter(e=>e.archived||(e.endAt&&Date.parse(e.endAt)<Date.now())).sort((a,b)=>(b.year||0)-(a.year||0)),upcoming=selected.filter(e=>!past.includes(e));
 $('#category-upcoming').innerHTML=upcoming.length?`<div class="editorial-grid">${upcoming.map(e=>card(e,data.editorial)).join('')}</div>`:noEvents(data.live);
 $('#category-past').innerHTML=past.length?past.map(e=>row(e,data.editorial)).join(''):'<p class="category-note">Bu kategoride kaynaklarıyla yayımlanmış bağımsız bir etkinlik kaydı henüz bulunmuyor. Yeni programlar duyurulduğunda burada yer alacak.</p>';
 const series=data.editorial.series.filter(item=>spec.series.includes(item.slug));
 $('#category-series').innerHTML=series.length?seriesRows(series):'<p class="category-note">Bu kategori için yayımlanmış bir seri henüz yok. '+(spec.id==='atolye'?'Zirve ve festival programlarında yer alan atölyeleri ilgili etkinliğin hikâyesinde inceleyebilirsin.':'Yeni bir seri duyurulduğunda bu alanda tanışacağız.')+'</p>';
}
async function renderCommunity(){
 const catalog=await staticJSON('data/community.json');let published=[];
 if(!preview){try{const response=await request('groups');published=Array.isArray(response.groups)?response.groups:[];}catch{/* Local applications remain discoverable; form separately verifies service availability. */}}
 const groups=communityTargets(catalog.groups,published),extras=additionalGroups(catalog.groups,published);
 const cities=[...new Set(groups.map(g=>g.city).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'tr'));
 $('#group-city').innerHTML+=$('#group-city').innerHTML.includes('İstanbul')?'':cities.map(city=>`<option>${esc(city)}</option>`).join('');
 $('#group-category').value=params.get('tur')||'';$('#group-city').value=params.get('sehir')||'';
 function draw(){
  const type=$('#group-category').value,city=$('#group-city').value;
  const selected=groups.filter(g=>(!type||g.category===type)&&(!city||g.city===city));
  $('#group-count').textContent=`${selected.length} topluluk`;
  $('#group-list').innerHTML=selected.map(g=>`<article class="group-row" id="grup-${esc(g.id)}" data-group-id="${esc(g.id)}"><div><p class="group-kicker">${esc([g.category,g.city].filter(Boolean).join(' · '))}</p><h3>${esc(g.name)}</h3><p>${esc(g.description)}</p></div><div><a class="button button-secondary" href="${esc(g.href)}" ${g.direct?'target="_blank" rel="noopener noreferrer"':''}>${g.direct?'Gruba katıl':'Gruba başvur'}<span class="visually-hidden">: ${esc(g.name)}</span></a><p class="group-link-note">${g.direct?'WhatsApp’ta yayımlanan katılım bağlantısı.':'Kısa başvurunu Archify ekibine ilet.'}</p></div></article>`).join('')||'<div class="empty-state"><h3>Bu seçimde topluluk bulunamadı.</h3><p>İlgi alanını veya şehir seçimini değiştirerek yeniden bakabilirsin.</p></div>';
  if(!type&&!city&&extras.length)$('#group-list').insertAdjacentHTML('beforeend','<h2>Diğer yayımlanan topluluklar</h2>'+extras.map(g=>`<article class="group-row"><div><h3>${esc(g.name)}</h3><p>${esc([g.category,g.city].filter(Boolean).join(' · '))}</p></div><a class="button button-secondary" href="${esc(directInvite(g.joinUrl))}" target="_blank" rel="noopener noreferrer">Gruba katıl</a></article>`).join(''));
 }
 $('#group-filters').addEventListener('change',()=>{draw();const next=new URL(location.href);for(const [key,value]of [['tur',$('#group-category').value],['sehir',$('#group-city').value]])value?next.searchParams.set(key,value):next.searchParams.delete(key);history.replaceState(null,'',next);});
 $('#group-filters').addEventListener('submit',e=>e.preventDefault());draw();
 if(/^#grup-[a-z-]+$/.test(location.hash))$(location.hash)?.scrollIntoView?.({block:'start'});
}

function renderSources(data) {
  $('#source-list').innerHTML = Object.entries(data.editorial.events).map(([slug,event]) => { const title=data.events.find(e=>e.slug===slug)?.title || event.series; return `<article class="source-row"><h2><a href="etkinlik.html?slug=${encodeURIComponent(slug)}">${esc(title)}</a></h2>${[event.source,...(event.additionalSources || [])].filter(s=>s&&safeURL(s.url)).map(s=>`<a class="source-link" href="${esc(safeURL(s.url))}" target="_blank" rel="noopener noreferrer">${esc(s.title)}</a>`).join('')}</article>`; }).join('');
}

async function setupForm() {
  const form = $('#application-form'), fields = $('#application-fields'), status = $('#form-status'), retry = $('#retry-application');
  const isTeam = page === 'team-application', isCommunity=page==='community-application';
  const endpoint=isCommunity?'community-applications':isTeam?'team-applications':'applications';
  let group;
  let event;
  let payload;
  let inFlight = false;
  let completed = false;
  let retryKind = 'setup';
  const requestId = globalThis.crypto?.randomUUID?.() || null;
  const show = (text, kind = '', focus = false) => { status.className='form-status '+kind; status.textContent=text; if (focus) status.focus(); };
  async function setup() {
    retry.hidden=true; fields.disabled=true;
    if(isCommunity&&!group){
      try{const catalog=await staticJSON('data/community.json');group=catalog.groups.find(g=>g.id===params.get('grup'));}catch{show('Topluluk bilgisi şu anda alınamıyor. Daha sonra yeniden deneyebilirsin.','error');return;}
      if(!group){show('Önce başvurmak istediğin topluluğu seç.');$('#application-group').innerHTML='<p>Bu bağlantıda geçerli bir topluluk seçilmedi.</p><a class="text-link" href="topluluk.html">Toplulukları keşfet</a>';return;}
      $('#application-group').innerHTML=`<h2>${esc(group.name)}</h2><p>${esc(group.description)}</p>`;
    }
    if (preview) { show('Bu test yayını kişisel bilgi kabul etmez. Form alanları ve gönderim kapalıdır.'); if(!isTeam&&!isCommunity) $('#application-event').innerHTML='<p>Etkinlik başvuruları asıl yayın adresinde açılır.</p>'; return; }
    if (!requestId) { show('Başvuru güvenli bağlantı gerektiriyor. HTTPS adresinden yeniden aç.','error'); return; }
    try {
      await session();
      if (!isTeam&&!isCommunity) {
        const slug = params.get('slug');
        if (!slug) { show('Önce başvurmak istediğin etkinliği seç.'); $('#application-event').innerHTML='<p>Henüz bir etkinlik seçilmedi.</p>'; return; }
        const data = await request('events/'+encodeURIComponent(slug)); event=data.event;
        const state=registrationState(event);
        $('#application-event').innerHTML=event ? `<h2>${esc(event.title)}</h2><p>${esc([friendlyDate(event.startAt),event.city].filter(Boolean).join(' · '))}</p>` : '<p>Etkinlik bulunamadı.</p>';
        if (!state.open) { show(state.label+'. '+state.detail); return; }
      }
      fields.disabled=false;
      show(isCommunity?'Adın ve telefonun yalnız seçtiğin topluluğa başvurunu değerlendirmek ve bu başvuruyla ilgili iletişim için kullanılır.':'Zorunlu alanlar işaretlidir. İletişim tercihlerini ayrı ayrı seçebilirsin.');
    } catch(error) {
      if (!isTeam&&!isCommunity && (error.status === 404 || error.status === 403)) {
        show('Etkinlik bulunamadı veya başvuruya açık değil. Etkinlik listesinden yeniden seçebilirsin.');
        $('#application-event').innerHTML='<p>Bu etkinlik için başvuru alınmıyor.</p>';
        return;
      }
      show('Başvuru bağlantısı şu anda kurulamıyor. Bilgi girmeden bağlantıyı yeniden deneyebilirsin.','error');
      if(!isTeam&&!isCommunity) $('#application-event').innerHTML='<p>Etkinlik bilgileri henüz alınamadı.</p>';
      retryKind='setup';retry.textContent='Bağlantıyı tekrar dene';retry.hidden=false;
    }
  }
  async function submit() {
    if (inFlight || completed || !payload || preview) return;
    inFlight=true;fields.disabled=true;retry.hidden=true;show('Başvurun gönderiliyor. Bu sayfayı açık tutabilirsin.');
    try {
      if (!csrfToken) await session();
      let result;
      try { result=await request(endpoint,payload); }
      catch(error) {
        if (['csrf_invalid','invalid_csrf','csrf_failed','request_verification'].includes(error.code)) { await session(); result=await request(endpoint,payload); }
        else throw error;
      }
      if (!result || typeof result.reference!=='string' || !['accepted','received'].includes(result.status)) throw Object.assign(new Error('network'),{code:'network',status:0});
      completed=true;form.reset();fields.hidden=true;retry.hidden=true;status.className='form-status success';
      status.innerHTML=isCommunity?`<strong>Topluluk başvurun alındı.</strong><p>${esc(group.name)} için başvurun ekibe iletildi. Gruba otomatik katılım veya mesaj gönderimi yapılmadı. Başvuru referansını sakla.</p><code>${esc(result.reference)}</code><a class="text-link" href="topluluk.html">Topluluklara dön</a>`:`<strong>${isTeam?'Başvurun alındı.':'Başvurun kaydedildi.'}</strong>${isTeam?'Ekibin değerlendirmesi için iletildi. Bu sonuç ekip kabulü anlamına gelmez.':'Başvuru referansını sakla.'}<code>${esc(result.reference)}</code><p>${payload.noticeConsent?'WhatsApp bilgilendirmesi tercihin kaydedildi. Bu ekran başvuru kaydını doğrular; mesajın teslim edildiğini göstermez.':'Başvurunun kaydı tamamlandı. WhatsApp bilgilendirmesi istemedin.'}</p><a class="text-link" href="${isTeam?'hakkimizda.html':eventURL(event)}">${isTeam?'Archify’ı keşfet':'Etkinliğe dön'}</a>`;
      payload=null;status.focus();
    } catch(error) {
      show(errorMessage(error.code),'error',true);
      const uncertain=!error.status || error.status>=500;
      if (uncertain) { retryKind='submit';retry.textContent='Aynı başvuruyu tekrar dene';retry.hidden=false; }
      else if (['event_full','registration_closed','event_not_found','idempotency_conflict'].includes(error.code)) { retry.hidden=true; }
      else { fields.disabled=false; payload=null; }
    } finally { inFlight=false; }
  }
  form.addEventListener('submit',eventDOM => {
    eventDOM.preventDefault();if(inFlight || completed || preview || fields.disabled) return;
    if(!form.reportValidity()) return;
    const values=new FormData(form);
    const phone=normalizePhone(values.get('phone'));
    if(!phone) { $('#phone').setCustomValidity(errorMessage('invalid_phone'));$('#phone').reportValidity();return; }
    payload=isCommunity?{groupId:group.id,name:String(values.get('name')).trim(),phone,termsAccepted:values.has('termsAccepted'),requestId}:{...(isTeam?{}:{eventSlug:event.slug}),name:String(values.get('name')).trim(),phone,email:String(values.get('email')).trim(),noticeConsent:values.has('noticeConsent'),marketingConsent:values.has('marketingConsent'),termsAccepted:values.has('termsAccepted'),requestId};
    if(isTeam) { payload.department=String(values.get('department'));payload.motivation=String(values.get('motivation')).trim(); }
    void submit();
  });
  $('#phone').addEventListener('input',()=>$('#phone').setCustomValidity(''));
  retry.addEventListener('click',()=>{if(retryKind==='setup')void setup();else void submit();});
  await setup();
}

setupNavigation();

async function main(){
  if(['application','team-application','community-application'].includes(page)){await setupForm();return;}
  if(page==='community'){await renderCommunity();return;}
  if(page==='media'){await renderMedia();return;}
  if(!['home','archive','events','series','detail','sources','category'].includes(page))return;
  const data=await loadData();
  const renderers={home:renderHome,archive:renderArchive,events:renderEvents,series:renderSeries,detail:renderDetail,sources:renderSources,category:renderCategory};
  await renderers[page](data);
}
// Avoid unhandled fetch failures on pages that do not need the catalogue.
catalogPromise.catch(()=>{});editorialPromise.catch(()=>{});
main().catch(()=>{
  const host=$('#home-events')||$('#event-list')||$('#upcoming-events')||$('#series-list')||$('#event-detail')||$('#source-list')||$('#group-list')||$('#media-list')||$('#category-upcoming');
  if(host)host.innerHTML='<div class="empty-state"><h2>Bağlantıya kısa bir ara.</h2><p>İçerik şu anda yüklenemedi. Sayfayı yenileyebilir veya iletişim sayfasından devam edebilirsin.</p><a class="button" href="iletisim.html">İletişim</a></div>';
});
