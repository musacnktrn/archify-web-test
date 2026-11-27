// [codex] 01a20fe8-199e-7631-8910-07e7d27b753d · public visitor implementation
// [codex] UX revision · 01a20fe8-62df-78c3-a20e-1c904d040938 · archify-web-ozgun-ux-01a20fd9
import { escapeHTML as esc, safeURL, filterEvents, registrationState, archiveEvent, apiURL, errorMessage, normalizePhone, groupEventsByYear, sourceMarkup } from './core.mjs';
import { CATEGORY_PAGES, GROUP_TYPES, categoryPage } from './information.mjs';
import {archiveGallery,createPhotoViewer} from './archive-photos.mjs';
export {archiveGallery};
import { setupNavigation } from './navigation.mjs';
import { setupAnalytics, analyticsRequestHeaders, advertisingRequestHeaders } from './analytics.mjs';
import { setupCommunityEligibility } from './community-eligibility.mjs';
import { setupProviders } from './providers.mjs';
import { setupTickets, ticketConfig, renderTicketReceipt, renderOrderReceipt, money, ticketError } from './tickets.mjs';
import {renderTicketOptions} from './r14-tickets.mjs';
import {setupEventQuestions,setupTicketSurvey} from './event-forms.mjs';
import {setupEventProgram} from './event-program.mjs';
import {categoryIcon,enhanceCategoryIdentity,publicSeries,seriesEvents,premiumSeriesCards,premiumSeriesIntro,categoryWayfinder} from './premium.mjs';

const $ = (selector, root = document) => root.querySelector(selector);
const page = document.body.dataset.page;
const preview = document.querySelector('meta[name="deployment"]')?.content !== 'server' || location.hostname.endsWith('.github.io') || location.protocol === 'file:';
const base = new URL('./', location.href);
const params = new URLSearchParams(location.search);
let csrfToken;
let analytics=null;
let providers=null;
let gallery = [];
const photoViewer = createPhotoViewer(document);
function openGallery(index,trigger){photoViewer.open(gallery,index,trigger);}
document.documentElement.classList.add('js');
if (preview) $('#deployment-notice').hidden = false;

async function request(route, body) {
  if (preview) throw Object.assign(new Error('preview'), { code: 'preview', status: 0 });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(apiURL(route, base), {
      method: body ? 'POST' : 'GET', credentials: 'same-origin', cache: 'no-store', signal: controller.signal,
      ...(route==='analytics/collect'?{keepalive:true}:{}),
      headers: body ? { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken || '',...(['applications','team-applications','community-applications','tickets/orders','tickets/order-status','integrations/conversions'].includes(route)?{...analyticsRequestHeaders(),...advertisingRequestHeaders()}:{}) } : { 'Accept': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {})
    });
    let data;
    try { data = await response.json(); } catch { throw Object.assign(new Error('network'), { code: 'network', status: response.status >= 500 ? response.status : 0 }); }
    if (!response.ok) throw Object.assign(new Error(data.error || 'service_unavailable'), { code: data.error, status: response.status });
    if(route==='events'&&Array.isArray(data.events))analytics?.allowEvents(data.events);
    if(route.startsWith('events/')&&data.event)analytics?.allowEvents([data.event]);
    if(body&&['applications','team-applications','community-applications'].includes(route)&&['accepted','received'].includes(data.status))void providers?.pullConversions();
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
    return { events: catalog.events.map(event=>({...archiveEvent(event),gallery:[]})), editorial, live: false };
  }
}
function eventURL(event) { return 'etkinlik.html?slug=' + encodeURIComponent(event.slug); }
function photo(event) { return (Array.isArray(event.gallery) ? event.gallery : []).find(item => item&&typeof item==='object'&&safeURL(item.src, { image: true })); }
function categoryClass(category) { return ({'Festival':'festival','Zirve':'zirve','Buluşma':'sosyal','Sempozyum':'sempozyum','Atölye':'atolye','Teknik gezi':'teknik-gezi','Yurt dışı tur':'yurt-disi-tur'})[category] || 'bulusma'; }
function cover(event, editorial) {
  const image = photo(event);
  if (image) return `<div class="cover cover-photo"><img src="${esc(safeURL(image.src, { image:true }))}" alt="${esc(image.alt || event.title)}" loading="lazy" width="1200" height="800"></div>`;
  const route=editorial?.events[event.slug]?.routeHighlights || [];
  return `<div class="cover cover-document cover-${categoryClass(event.category)}" data-category="${categoryClass(event.category)}" aria-hidden="true"><span class="cover-category">${esc(event.category)}</span><span class="cover-word">${esc(event.title)}</span>${event.category==='Yurt dışı tur'?`<span class="cover-route">${esc(route.length?route.join(' · '):event.city || 'Avrupa')}</span>`:''}<span class="cover-year">${esc(event.year || 'Arşiv')}</span></div>`;
}
function source(event, editorial) { return sourceMarkup(editorial.events[event.slug]?.source, 'Kaynak: '); }
function card(event, editorial) {
  return `<article class="editorial-card"><a href="${eventURL(event)}">${cover(event,editorial)}<p class="card-meta">${esc([event.category,event.city,event.year].filter(Boolean).join(' · '))}</p><h3>${esc(event.title)}</h3></a>${source(event, editorial)}</article>`;
}
function row(event, editorial) {
  return `<article class="archive-row" data-category="${categoryClass(event.category)}"><a href="${eventURL(event)}" tabindex="-1" aria-hidden="true">${cover(event,editorial)}</a><div class="ux-archive-copy"><p class="card-meta">${esc([event.category,event.city].filter(Boolean).join(' · '))}</p><h3><a href="${eventURL(event)}">${esc(event.title)}</a></h3><p>${esc(event.summary)}</p>${source(event,editorial)}</div></article>`;
}
function archiveRows(events, editorial) {
  return groupEventsByYear(events).map(group=>`<section class="ux-year-section" aria-label="${esc(group.label)}"><h2 class="ux-year-label">${esc(group.label)}</h2><div class="ux-year-events">${group.events.map(event=>row(event,editorial)).join('')}</div></section>`).join('');
}
function seriesRows(series,data) {
  return series.length ? premiumSeriesCards(series,data?.events||[],data?.editorial||{}) : '';
}
function friendlyDate(value) {
  if (!value || !Number.isFinite(Date.parse(value))) return '';
  return new Intl.DateTimeFormat('tr-TR', { day:'numeric', month:'long', year:'numeric', timeZone:'Europe/Istanbul' }).format(new Date(value));
}
function noEvents(live) {
  const title = live ? 'Yeni buluşmalar burada olacak.' : 'Yeni buluşmaları birlikte bekleyelim.';
  return `<div class="empty-state"><h3>${title}</h3><p>${!live && !preview ? 'Güncel takvime şu an ulaşamıyoruz. ' : ''}Duyurular için resmî Archify topluluğunu takip edebilir, bu sırada geçmiş buluşmaların hikâyelerini keşfedebilirsin.</p><div class="button-row"><a class="button" href="topluluk.html">Topluluğa katıl</a><a class="text-link" href="arsiv.html">Arşivi gez</a></div></div>`;
}
// [codex] Scheduled homepage publication. Only the server can activate a slot.
const HOME_ACTIONS=Object.freeze({archive:{href:'arsiv.html',label:'Arşivi gez'},events:{href:'etkinlikler.html',label:'Etkinlikleri keşfet'},community:{href:'topluluk.html',label:'Topluluğa katıl'}});
const ORIGINAL_HERO=Object.freeze({headline:'Mimarlık için',emphasis:'ortak bir zemin.',lead:'Bir konuşmanın, bir atölyenin ya da yeni bir tanışıklığın açtığı yer. Archify’de fikirler insanlarla buluşur.',primaryAction:'archive'});
function homeDate(value){return typeof value==='string'&&/(?:Z|[+-]\d{2}:\d{2})$/.test(value)&&Number.isFinite(Date.parse(value))?Date.parse(value):NaN;}
function homeText(value,max,{empty=false}={}){return typeof value==='string'&&value.length<=max&&!/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(value)&&(empty||value.trim().length>0);}
function publicHomeEvent(event){return event&&typeof event==='object'&&typeof event.slug==='string'&&event.slug.length<=160&&/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(event.slug)&&homeText(event.title,300)&&homeText(event.summary||'',8000,{empty:true})&&['published','closed'].includes(event.status)&&event.archived===false;}
export function homeHeroSettings(value){
 const hero=value?.hero;if(!hero||!homeText(hero.headline,240)||!homeText(hero.emphasis,240,{empty:true})||!homeText(hero.lead,2000)||!Object.hasOwn(HOME_ACTIONS,hero.primaryAction))return {...ORIGINAL_HERO};
 return {headline:hero.headline,emphasis:hero.emphasis,lead:hero.lead,primaryAction:hero.primaryAction};
}
export function homeFeatureState(value,now=homeDate(value?.serverNow)){
 const feature=value?.feature,event=feature?.event;if(!Number.isFinite(now)||!publicHomeEvent(event))return null;
 const starts=homeDate(feature.startsAt),ends=homeDate(feature.endsAt),eventStart=homeDate(event.startAt),eventEnd=homeDate(event.endAt);
 if(![starts,ends,eventStart,eventEnd].every(Number.isFinite)||starts>=ends||eventStart>=eventEnd||ends>eventEnd||starts>now||ends<=now||eventEnd<=now)return null;
 return {event,startsAt:feature.startsAt,endsAt:feature.endsAt};
}
export function homeAvailableEvents(events,now){
 if(!Array.isArray(events)||!Number.isFinite(now))return [];
 return events.filter(event=>{if(!publicHomeEvent(event))return false;const start=homeDate(event.startAt),end=event.endAt?homeDate(event.endAt):null;return Number.isFinite(start)&&(end===null?start>now:Number.isFinite(end)&&end>start&&end>now);});
}
export function homeUpcomingEvents(events,now){
 if(!Array.isArray(events)||!Number.isFinite(now))return [];
 return events.filter(event=>{if(!publicHomeEvent(event))return false;const start=homeDate(event.startAt),end=event.endAt?homeDate(event.endAt):null;return Number.isFinite(start)&&start>now&&(end===null||(Number.isFinite(end)&&end>start));}).sort((a,b)=>homeDate(a.startAt)-homeDate(b.startAt));
}
export function homeRefreshDelay(envelope,now){
 const dates=[envelope?.nextTransitionAt,envelope?.feature?.endsAt,envelope?.feature?.event?.startAt,envelope?.feature?.event?.endAt].map(homeDate).filter(date=>Number.isFinite(date)&&date>now);
 return Math.max(250,Math.min(60000,...dates.map(date=>Math.ceil(date-now))));
}
function homeRegistration(event,now){
 const state=registrationState(event,now);
 return homeDate(event.startAt)<=now?{open:false,label:'Etkinlik başladı',detail:'Güncel programı etkinlik detayında inceleyebilirsin.'}:state;
}
function homeEventDate(event){
 const format=new Intl.DateTimeFormat('tr-TR',{day:'numeric',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit',timeZone:'Europe/Istanbul'});
 const start=homeDate(event.startAt),end=homeDate(event.endAt);
 if(!Number.isFinite(start))return 'Tarih duyurulacak';
 return format.format(new Date(start))+(Number.isFinite(end)?' – '+format.format(new Date(end)):'');
}
function homePhoto(event){return (Array.isArray(event.gallery)?event.gallery:[]).find(item=>item&&typeof item.src==='string'&&/^(?:assets|media)\//.test(item.src)&&safeURL(item.src,{image:true}));}
function spotlightTypography(event){
 const stamp=new Intl.DateTimeFormat('tr-TR',{day:'numeric',month:'long',timeZone:'Europe/Istanbul'}).format(new Date(event.startAt));
 return `<div class="spotlight-type-cover"><span class="spotlight-type-category">${esc(event.category||'Archify etkinliği')}</span><strong class="spotlight-type-date">${esc(stamp)}</strong><span class="spotlight-type-city">${esc(event.city||'Archify')}</span></div>`;
}
export function homeFeatureMarkup(feature,now){
 const event=feature.event,state=homeRegistration(event,now),image=homePhoto(event),detail=eventURL(event);
 return `<div class="spotlight-copy"><p class="spotlight-eyebrow"><span>Öne çıkan buluşma</span><span>${esc(event.category||'Archify etkinliği')}</span></p><h2 class="spotlight-title" id="spotlight-title">${esc(event.title)}</h2>${event.summary?`<p class="spotlight-summary">${esc(event.summary)}</p>`:''}<dl class="spotlight-facts"><div><dt>Tarih · Türkiye saati</dt><dd><time datetime="${esc(event.startAt)}">${esc(homeEventDate(event))}</time></dd></div><div><dt>Şehir</dt><dd>${esc(event.city||'Şehir duyurulacak')}</dd></div><div><dt>Mekân</dt><dd>${esc(event.venue||'Mekân duyurulacak')}</dd></div></dl><p class="spotlight-registration">${esc(state.label)}</p><div class="spotlight-actions">${state.open?`<a class="button" id="spotlight-apply" href="basvuru.html?slug=${encodeURIComponent(event.slug)}">Başvur</a>`:''}<a class="${state.open?'text-link':'button'}" id="spotlight-details" href="${detail}">Etkinlik detayları</a></div><a class="spotlight-more" id="spotlight-archify" href="#archify-normal">Archify’ı keşfet</a></div><figure class="spotlight-art${image?'':' spotlight-art--typographic'}"><div class="spotlight-visual" id="spotlight-visual">${image?`<img id="spotlight-image" src="${esc(safeURL(image.src,{image:true}))}" alt="${esc(image.alt||event.title)}" width="1200" height="1000" decoding="async">`:spotlightTypography(event)}</div><figcaption id="spotlight-caption">${image?'Etkinliğin yayımlanan görsel seçkisinden.':'Tipografik etkinlik kapağı · Fotoğraf değildir.'}</figcaption></figure>`;
}
function homeUpcomingMarkup(events,now){
 return homeUpcomingEvents(events,now).slice(0,3).map(event=>{const state=homeRegistration(event,now);return `<article class="home-upcoming-card" data-upcoming-slug="${esc(event.slug)}"><p class="card-meta">${esc(event.category||'Archify etkinliği')}</p><time datetime="${esc(event.startAt)}">${esc(homeEventDate(event))}</time><h3><a href="${eventURL(event)}">${esc(event.title)}</a></h3><p class="home-upcoming-place">${esc([event.city,event.venue].filter(Boolean).join(' · ')||'Konum duyurulacak')}</p><p class="home-upcoming-state">${esc(state.label)}</p><div class="home-upcoming-links">${state.open?`<a class="button" href="basvuru.html?slug=${encodeURIComponent(event.slug)}">Başvur</a>`:''}<a class="text-link" href="${eventURL(event)}">Detaylar</a></div></article>`;}).join('');
}
function preserveHomeViewport(change){
 const anchor=$('#kesfet'),scrolled=(window.scrollY||0)>100,before=scrolled?anchor?.getBoundingClientRect?.().top:null;
 change();
 if(Number.isFinite(before)){const after=anchor?.getBoundingClientRect?.().top,delta=after-before;if(Number.isFinite(delta)&&Math.abs(delta)>1)window.scrollBy?.({top:delta,left:0,behavior:'instant'});}
}
function setupHomeExperience(){
 if(preview||page!=='home')return;
 const host=$('#home-feature'),upcoming=$('#home-upcoming-section'),list=$('#home-upcoming-list');
 if(!host||!upcoming||!list)return;
 let timer=null,inFlight=false,refreshQueued=false,paused=false,envelope=null,serverAnchor=null,monoAnchor=0,events=[],featureKey='',upcomingKey='',heroKey='',portfolioRevision=0;
 const monotonic=()=>globalThis.performance?.now?.()??Date.now();
 const now=()=>serverAnchor===null?Date.now():serverAnchor+Math.max(0,monotonic()-monoAnchor);
 function clearTimer(){if(timer!==null)clearTimeout(timer);timer=null;}
 function paintFeature(){
  const feature=homeFeatureState(envelope,now()),html=feature?homeFeatureMarkup(feature,now()):'';
  if(html===featureKey)return;const focused=host.contains(document.activeElement)?document.activeElement?.getAttribute('id'):null;
  preserveHomeViewport(()=>{host.innerHTML=html;host.hidden=!feature;host.setAttribute('data-state',feature?'active':'normal');});featureKey=html;
  if(feature){$('#spotlight-image')?.addEventListener('error',()=>{if(!$('#spotlight-visual'))return;$('#spotlight-visual').innerHTML=spotlightTypography(feature.event);$('#spotlight-caption').textContent='Tipografik etkinlik kapağı · Fotoğraf yüklenemedi.';});}
  if(focused){const target=feature?($('#'+focused)||$('#spotlight-details')):$('#hero-action');target?.focus({preventScroll:true});}
 }
 function paintUpcoming(){
  const html=serverAnchor===null?'':homeUpcomingMarkup(events,now());if(html===upcomingKey)return;
  const focused=list.contains(document.activeElement)?document.activeElement?.getAttribute('href'):null;
  preserveHomeViewport(()=>{list.innerHTML=html;upcoming.hidden=!html;});upcomingKey=html;
  if(focused){const target=[...list.querySelectorAll('a[href]')].find(a=>a.getAttribute('href')===focused)||$('#hero-action');target?.focus({preventScroll:true});}
 }
 function paintHero(payload){
  const hero=homeHeroSettings(payload),key=JSON.stringify(hero);if(key===heroKey)return;
  preserveHomeViewport(()=>{$('#hero-headline').textContent=hero.headline;$('#hero-emphasis').textContent=hero.emphasis;$('#hero-lead').textContent=hero.lead;const action=$('#hero-action');action.href=HOME_ACTIONS[hero.primaryAction].href;action.textContent=HOME_ACTIONS[hero.primaryAction].label;});heroKey=key;
 }
 function schedule(){clearTimer();if(paused||document.visibilityState==='hidden')return;timer=setTimeout(tick,homeRefreshDelay(envelope,now()));}
 function tick(){timer=null;paintFeature();paintUpcoming();if(inFlight){refreshQueued=true;return;}void refresh();}
 async function refresh(){
  if(paused||document.visibilityState==='hidden')return;if(inFlight){refreshQueued=true;return;}inFlight=true;clearTimer();
  const featureTask=request('home-feature').then(value=>{
   const server=homeDate(value.serverNow);if(!Number.isFinite(server))throw new Error('invalid_server_clock');
   serverAnchor=server;monoAnchor=monotonic();
   // A future payload cannot activate later from a cached response; it must be published again by the server.
   envelope={serverNow:value.serverNow,nextTransitionAt:value.nextTransitionAt,feature:homeFeatureState(value,server)};
   paintFeature();paintUpcoming();schedule();
  }).catch(()=>{envelope=null;paintFeature();schedule();});
  const contentTask=request('site-content').then(paintHero).catch(()=>paintHero(null));
  const eventTask=request('events').then(value=>{
   if(!Array.isArray(value.events))throw new Error('invalid_events');
   events=value.events;paintUpcoming();const revision=++portfolioRevision;
   void editorialPromise.then(editorial=>{if(revision===portfolioRevision)renderHome({events,editorial,live:true});}).catch(()=>{if(revision===portfolioRevision)renderHome({events:[],editorial:{events:{}},live:false});});
  }).catch(()=>{events=[];portfolioRevision++;paintUpcoming();renderHome({events:[],editorial:{events:{}},live:false});});
  await Promise.allSettled([featureTask,contentTask,eventTask]);inFlight=false;
  if(paused)return;if(refreshQueued){refreshQueued=false;void refresh();}else schedule();
 }
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'){clearTimer();return;}paintFeature();paintUpcoming();void refresh();});
 window.addEventListener('pagehide',()=>{paused=true;clearTimer();});
 window.addEventListener('pageshow',()=>{if(paused){paused=false;void refresh();}});
 void refresh();
}
function renderHome(data) {
  const selected = ['istanbul-mimarlik-zirvesi-2026','buyuk-avrupa-turu-2026','istanbul-mimarlik-zirvesi-2023','archfest-2023'].map(slug => data.events.find(e => e.slug === slug && !['draft','cancelled'].includes(e.status))).filter(Boolean);
  const html=selected.map(e => card(e, data.editorial)).join('') || `<p class="ux-note">${data.live||preview?'Bu seçkide yayımlanmış etkinlik bulunmuyor.':'Etkinlik seçkisine şu anda ulaşılamıyor.'} <a href="arsiv.html">Arşivi incele</a>.</p>`;
  const host=$('#home-events');if(host.innerHTML===html)return;
  const focused=host.contains(document.activeElement)?document.activeElement?.getAttribute('href'):null;
  host.innerHTML=html;
  if(focused){const target=[...host.querySelectorAll('a[href]')].find(a=>a.getAttribute('href')===focused)||$('#hero-action');target?.focus({preventScroll:true});}
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
    $('#event-list').innerHTML = filtered.length ? archiveRows(filtered,data.editorial) : '<div class="empty-state"><h2>Henüz karşılaşmadık.</h2><p>Bu aramayla eşleşen bir etkinlik bulunamadı. Farklı bir kelime deneyebilir veya filtreleri temizleyebilirsin.</p><button class="button button-secondary" id="clear-results" type="button">Tüm arşivi göster</button></div>';
    $('#clear-results')?.addEventListener('click', () => { $('#event-filters').reset(); });
    if (updateURL) { const next = new URL(location.href); for (const [key,value] of Object.entries(values)) value ? next.searchParams.set(key,value) : next.searchParams.delete(key); history.replaceState(null,'',next); }
  }
  readURL(); draw(false);
  $('#event-filters').addEventListener('input', () => draw());
  $('#event-filters').addEventListener('submit', event => { event.preventDefault(); draw(); });
  $('#event-filters').addEventListener('reset', () => setTimeout(() => draw(),0));
}
function renderEvents(data) {
  const upcoming = homeAvailableEvents(data.events,Date.now());
  $('#upcoming-events').innerHTML = upcoming.length ? `<div class="editorial-grid">${upcoming.map(e => card(e,data.editorial)).join('')}</div>` : noEvents(data.live);
  $('#series-list').innerHTML = seriesRows(data.editorial.series,data);
}
function renderSeries(data) {
  const requested=params.get('seri'),list=$('#series-list'),host=$('#series-events'),intro=$('#series-intro'),definitions=publicSeries(data.editorial?.series);
  list.hidden=false;host.hidden=false;host.innerHTML='';
  if(!requested){list.innerHTML=seriesRows(definitions,data);return;}
  const series=definitions.find(item=>item.slug===requested);
  if(!series){intro.innerHTML='<div class="ux-masthead-copy"><p class="eyebrow">Seri bulunamadı</p><h1>Etkinlik serileri</h1><p class="lead">Bu bağlantıyla eşleşen bir seri yok. Aşağıdaki yayımlanmış serilerden devam edebilirsin.</p></div><div class="ux-masthead-aside"><a class="text-link" href="seri.html">Tüm seriler</a></div>';list.innerHTML=seriesRows(definitions,data);return;}
  const events=seriesEvents(series,data.events);
  // Compose first. A render failure must never send the recovery message to a hidden list.
  const markup=events.length?events.map(event=>{const edit=data.editorial?.events?.[event.slug]||{};return `<section class="premium-series-edition" aria-label="${esc(event.title)}"><div class="premium-series-edition-year">${esc(event.year||'Arşiv')}</div><div>${edit.dateLabel||event.venue?`<p class="premium-series-edition-date">${esc([edit.dateLabel,event.venue].filter(Boolean).join(' · '))}</p>`:''}${row(event,data.editorial)}</div></section>`;}).join(''):'<div class="empty-state"><h2>Bu serinin kayıtları şu anda görünmüyor.</h2><p>Yayımlanan edisyonlar burada listelenir. Diğer serileri veya etkinlik kategorilerini inceleyebilirsin.</p><a class="button" href="seri.html">Tüm serileri keşfet</a></div>';
  const heading=premiumSeriesIntro(series,events,data.editorial);
  document.title=`${series.title} · Archify`;document.body.dataset.series=series.slug;intro.classList.add('premium-series-intro');intro.innerHTML=heading;host.innerHTML=markup;list.innerHTML='';list.hidden=true;
}
async function trackNavigation(slug) {
  if (preview) return;
  const navigationId = new URLSearchParams(location.hash.slice(1)).get('nav');
  if (!navigationId || !/^[a-zA-Z0-9_-]{16,128}$/.test(navigationId)) return;
  const key = 'archify-view:' + navigationId;
  try { if (sessionStorage.getItem(key)) return; sessionStorage.setItem(key,'attempted'); } catch { /* Browser storage is optional. One call per page invocation. */ }
  try { await session(); await request('links/view',{navigationId,eventSlug:slug}); } catch { /* Read-only detail remains available; never manufacture a visit or retry automatically. */ }
}
function archivePhotoCaption(item) {
  return `<span class="archive-photo-caption">${esc(item.caption)}</span>${item.sourceLabel ? `<span class="archive-photo-source">${item.sourceUrl ? `<a href="${esc(item.sourceUrl)}" target="_blank" rel="noopener noreferrer">${esc(item.sourceLabel)}</a>` : esc(item.sourceLabel)}</span>` : ''}`;
}
function archivePhotoImage(item, {lead = false} = {}) {
  const srcset = lead && item.variants.length > 1 ? ` srcset="${item.variants.map(v=>`${esc(v.src)} ${v.width}w`).join(', ')}" sizes="(max-width: 620px) 100vw, 90vw"` : '';
  return `<img src="${esc(lead ? item.src : item.thumbnailSrc)}"${srcset} alt="${esc(item.alt)}" width="${item.width}" height="${item.height}"${lead ? ' fetchpriority="high"' : ' loading="lazy"'} decoding="async">`;
}
function archivePhotoTile(item,index) {
  return `<figure class="archive-photo-tile"><button class="gallery-thumb" type="button" data-gallery-index="${index}" aria-label="Fotoğraf ${index+1} / ${gallery.length}: ${esc(item.alt)}, galeride aç">${archivePhotoImage(item)}<span><b>${String(index+1).padStart(2,'0')}</b> Fotoğrafı büyüt <span aria-hidden="true">↗</span></span></button><figcaption>${archivePhotoCaption(item)}</figcaption></figure>`;
}
function bindGalleryButtons(root) {
  root.querySelectorAll('[data-gallery-index]').forEach(button => button.addEventListener('click', () => openGallery(Number(button.dataset.galleryIndex),button)));
}
function archivePosters(edit) {
  const metadata=Array.isArray(edit.posterMetadata)?edit.posterMetadata:[];
  const posters=archiveGallery({title:'Etkinlik afişi',gallery:metadata.map(item=>({src:item.src,alt:item.alt||'Etkinlik afişi'}))},{photoMetadata:metadata});
  if(!posters.length)return '';
  return `<section class="section archive-posters" aria-labelledby="archive-posters-title" data-poster-count="${posters.length}"><div class="section-heading"><div><p class="eyebrow">Yayımlanan duyurular</p><h2 id="archive-posters-title">${posters.length===1?'Etkinlik afişi':'Etkinlik afişleri'}</h2></div></div><div class="archive-poster-grid">${posters.map(item=>`<figure class="archive-poster-item"><a href="${esc(item.src)}" target="_blank" rel="noopener noreferrer" aria-label="${esc(item.alt)}, büyük boyutu yeni sekmede aç">${archivePhotoImage(item)}<span>Afişi büyük boyutta aç <span aria-hidden="true">↗</span></span></a><figcaption>${archivePhotoCaption(item)}</figcaption></figure>`).join('')}</div></section>`;
}
function archiveProgram(edit) {
  const days = Array.isArray(edit.publishedProgram) ? edit.publishedProgram.filter(day=>day && typeof day.label==='string' && Array.isArray(day.items)) : [];
  if(!days.length)return '';
  return `<section class="archive-program" aria-labelledby="archive-program-title"><p class="eyebrow">Etkinlik duyurusundan</p><h3 id="archive-program-title">Yayımlanan program</h3><p class="archive-program-note">${esc(edit.programNote || 'Etkinlik öncesinde paylaşılan program akışı. Saatler ve başlıklar yayımlanan duyuruyu yansıtır.')}</p>${days.map(day=>`<div class="archive-program-day"><h4>${esc(day.label)}</h4><ol>${day.items.filter(item=>item&&typeof item.title==='string').map(item=>`<li>${item.time ? `<span class="archive-program-time">${esc(item.time)}</span>` : ''}<span>${esc(item.title)}</span></li>`).join('')}</ol></div>`).join('')}${edit.programSource ? sourceMarkup(edit.programSource,'Program kaynağı: ') : ''}</section>`;
}
async function renderDetail(data) {
  const slug = params.get('slug');
  let event = data.events.find(e => e.slug === slug);
  let calendarObservation=null;
  if (slug && !preview) {
    try { const response = await request('events/'+encodeURIComponent(slug)); event = response.event; calendarObservation=response; }
    catch(error) {
      if (error.status === 404 || error.status === 403) event = null;
      else {
        $('#event-detail').innerHTML='<section class="section page-intro"><h1>Etkinlik kaydı yüklenemedi.</h1><p class="lead">Güncel kayda erişmek için yeniden dene.</p><a class="button" href="etkinlik.html?slug='+encodeURIComponent(slug)+'">Yeniden dene</a> <a class="text-link" href="arsiv.html">Arşive dön</a></section>';
        return;
      }
    }
  }
  if (!event || event.status === 'draft') {
    $('#event-detail').innerHTML = '<section class="section page-intro"><p class="eyebrow">Etkinlik bulunamadı</p><h1>Başka bir<br><em>hikâyeye bakalım.</em></h1><p class="lead">Bu etkinlik yayımlanmamış, kaldırılmış veya bağlantısı eksik olabilir.</p><a class="button" href="arsiv.html">Arşive dön</a></section>'; return;
  }
  document.title = event.title + ' · Archify'; $('#breadcrumb-current').textContent = event.title;
  const edit = data.editorial.events[event.slug] || {};
  const state = registrationState(event);
  const date = friendlyDate(event.startAt) || edit.dateLabel || (event.year ? String(event.year) : event.archived ? 'Tarihi kesinleşmemiş arşiv kaydı' : 'Tarih duyurulacak');
  const venue = event.venue || edit.venue;
  const story = edit.story || [event.summary];
  gallery = archiveGallery(event,edit);
  const image = gallery[0];
  const sources = [edit.source,...(edit.additionalSources || [])].filter(s => s && typeof s.title==='string');
  const facts = [['Tarih',date],['Yer',venue || event.city],['Tür',event.category],['Kayıt dayanağı',edit.evidenceLabel]].filter(([,value])=>value);
  const programs=edit.program || [];
  $('#event-detail').innerHTML = `<header class="section detail-header"><p class="eyebrow">${esc([event.category,event.archived ? 'Arşiv' : state.label].filter(Boolean).join(' · '))}</p><h1>${esc(event.title)}</h1><div class="detail-meta"><span>${esc(date)}</span>${event.city ? `<span>${esc(event.city)}</span>` : ''}</div></header>
  ${image ? `<figure class="detail-visual archive-photo-lead"><button class="archive-lead-open" type="button" data-gallery-index="0" aria-label="${esc(event.title)} fotoğraf galerisi, ${gallery.length} fotoğraf">${archivePhotoImage(image,{lead:true})}<span class="archive-photo-badge">${gallery.length} fotoğraf <span aria-hidden="true">↗</span></span></button><figcaption>${archivePhotoCaption(image)}</figcaption></figure>` : `<div class="detail-visual">${cover(event,data.editorial)}</div>`}
  <div class="section detail-body ux-event-dossier"><div class="detail-story ux-event-story"><p class="eyebrow">${esc(edit.series || 'Etkinlik kaydı')}</p><h2>Bu buluşmada</h2><div class="prose">${story.filter(Boolean).map(p => `<p>${esc(p)}</p>`).join('')}</div>${archiveProgram(edit)}${!edit.publishedProgram?.length && programs.length ? `<div class="detail-program"><h3>Programdan</h3><ul>${programs.map(item=>`<li>${esc(item)}</li>`).join('')}</ul></div>` : ''}${edit.workshops?.length ? `<div class="detail-program archive-workshops" id="atolyeler"><h3>Atölyeler</h3><ul>${edit.workshops.map(title=>`<li>${esc(title)}</li>`).join('')}</ul>${sourceMarkup(edit.workshopSource,'Atölye kaynağı: ')}</div>` : ''}${!edit.workshops?.length && edit.subprograms?.length ? `<div class="detail-program" id="atolyeler"><h3>Etkinlik içindeki atölyeler</h3>${edit.subprograms.map(item=>`<article><h4>${esc(item.title)}</h4><p>${esc(item.description)}</p><p class="card-meta">${esc(item.dateLabel)}</p></article>`).join('')}</div>` : ''}${sources.length ? `<div class="detail-source"><p class="eyebrow">Kaynaklar</p>${sources.map(item=>sourceMarkup(item)).join('')}</div>` : ''}</div><aside class="detail-aside"><dl class="ux-event-facts">${facts.map(([key,value])=>`<div><dt>${esc(key)}</dt><dd>${esc(value)}</dd></div>`).join('')}</dl><p class="eyebrow">${esc(state.label)}</p><p>${esc(state.detail)}</p>${state.open ? `<a class="button" href="basvuru.html?slug=${encodeURIComponent(event.slug)}">Etkinliğe başvur</a>` : '<a class="button" href="topluluk.html">Yeni buluşmaları takip et</a>'}</aside></div>
  ${edit.routeHighlights?.length ? `<section class="section archive-route" aria-labelledby="archive-route-title"><div><p class="eyebrow">Yerinde keşif</p><h2 id="archive-route-title">Rotadan duraklar</h2><p>Program kaydında yer alan kentler.</p></div><ol>${edit.routeHighlights.map(city=>`<li>${esc(city)}</li>`).join('')}</ol></section>` : ''}
  ${archivePosters(edit)}
  ${gallery.length ? `<section class="section gallery-section ux-event-gallery archive-gallery" aria-labelledby="archive-gallery-title" data-gallery-total="${gallery.length}"><div class="section-heading"><div><p class="eyebrow">Buluşmadan kalanlar</p><h2 id="archive-gallery-title">Fotoğraf seçkisi</h2></div><p class="archive-gallery-count">${gallery.length} fotoğraf</p></div><div class="gallery-grid" id="archive-gallery-grid">${gallery.slice(0,6).map(archivePhotoTile).join('')}</div>${gallery.length > 6 ? `<div class="archive-gallery-more"><p id="archive-gallery-progress" role="status">${gallery.length} fotoğrafın 6 tanesi gösteriliyor.</p><button type="button" class="button" id="archive-gallery-more" aria-controls="archive-gallery-grid">Diğer fotoğrafları göster</button></div>` : ''}<a class="text-link" href="albumler.html?etkinlik=${encodeURIComponent(event.slug)}">Etkinliğin albümünü aç</a><p class="gallery-note">${esc(edit.imageCredit || 'Bu etkinliğe ait yayımlanan galeri seçkisi.')}</p></section>` : ''}`;
  bindGalleryButtons($('#event-detail'));
  let shownPhotos=Math.min(6,gallery.length);
  $('#archive-gallery-more')?.addEventListener('click',()=>{
    const end=Math.min(shownPhotos+6,gallery.length),grid=$('#archive-gallery-grid');
    grid.insertAdjacentHTML('beforeend',gallery.slice(shownPhotos,end).map((item,index)=>archivePhotoTile(item,shownPhotos+index)).join(''));
    grid.querySelectorAll('[data-gallery-index]').forEach(button=>{if(Number(button.dataset.galleryIndex)>=shownPhotos)button.addEventListener('click',()=>openGallery(Number(button.dataset.galleryIndex),button));});
    shownPhotos=end;$('#archive-gallery-progress').textContent=`${gallery.length} fotoğrafın ${shownPhotos} tanesi gösteriliyor.`;
    if(shownPhotos===gallery.length){$('#archive-gallery-more').disabled=true;$('#archive-gallery-more').textContent='Tüm fotoğraflar gösteriliyor';}
  });
  const media=await loadMediaData();
  const related=media.videos.filter(video=>video.eventSlug===event.slug);
  if(related.length)$('#event-detail').insertAdjacentHTML('beforeend',`<section class="section detail-related"><div class="section-heading"><h2>Bu etkinliğin videoları</h2><a class="text-link" href="medya.html">Tüm içerikler</a></div><div class="video-grid">${related.map(videoCard).join('')}</div></section>`);
  const relatedEvents=data.events.filter(other=>other.slug!==event.slug && (edit.series ? data.editorial.events[other.slug]?.series===edit.series : other.category===event.category)).slice(-3).reverse();
  if(relatedEvents.length)$('#event-detail').insertAdjacentHTML('beforeend',`<section class="section detail-related"><div class="section-heading"><h2>İlgili buluşmalar</h2></div><div class="editorial-grid">${relatedEvents.map(other=>card(other,data.editorial)).join('')}</div></section>`);
  if (!preview && event.archived===false && typeof calendarObservation?.serverNow==='string') {
    const aside=$('#event-detail .detail-aside');
    if(aside){
      const host=document.createElement('div');
      host.className='detail-calendar-action';aside.append(host);
      const {mountEventCalendar}=await import('./event-calendar-action.mjs');
      if(host.isConnected)mountEventCalendar({host,initial:calendarObservation,slug,read:()=>request('events/'+encodeURIComponent(slug))});
    }
  }
  setupVideoPlayers();
  await trackNavigation(event.slug);
  try{await setupEventProgram({document,preview,request,eventSlug:event.slug});}catch{/* program unavailable never replaces other event content */}
}
// The live publication catalogue is authoritative: a hidden video is never restored from static data.
const MEDIA_FALLBACK=Object.freeze({channel:{name:'Archify',handle:'@archifycom',url:'https://www.youtube.com/@archifycom'},social:[{name:'Instagram',label:'@archifycom',url:'https://www.instagram.com/archifycom/'},{name:'YouTube',label:'@archifycom',url:'https://www.youtube.com/@archifycom'}]});
let mediaPromise=null;
const publishedVideoIds=new Set();
export function normaliseMediaData(value){
 if(!value||!Array.isArray(value.videos))throw new Error('invalid_media_catalog');
 const ids=new Set(),videos=[];
 for(const item of value.videos){
  if(!item||typeof item.id!=='string'||!/^[A-Za-z0-9_-]{11}$/.test(item.id)||ids.has(item.id)||!homeText(item.title,500))continue;
  let url;try{url=new URL(item.url);}catch{continue;}
  if(url.origin!=='https://www.youtube.com'||url.pathname!=='/watch'||url.searchParams.get('v')!==item.id)continue;
  ids.add(item.id);videos.push({id:item.id,title:item.title,subtitle:homeText(item.subtitle,500,{empty:true})?item.subtitle:'Archify yayını',kind:homeText(item.kind,100)?item.kind:'Video',description:homeText(item.description,4000,{empty:true})?item.description:'',url:'https://www.youtube.com/watch?v='+item.id,eventSlug:typeof item.eventSlug==='string'&&/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.eventSlug)&&item.eventSlug.length<=160?item.eventSlug:null});
 }
 return {channel:value.channel&&safeURL(value.channel.url)?value.channel:MEDIA_FALLBACK.channel,social:Array.isArray(value.social)?value.social:MEDIA_FALLBACK.social,videos,unavailable:false};
}
export function loadMediaData(){
 if(!mediaPromise){mediaPromise=(preview?staticJSON('data/media.json'):request('site-media')).then(normaliseMediaData).then(data=>{publishedVideoIds.clear();for(const video of data.videos)publishedVideoIds.add(video.id);return data;}).catch(()=>{publishedVideoIds.clear();return {...MEDIA_FALLBACK,videos:[],unavailable:true};});}
 return mediaPromise;
}
function mediaEmbedURL(id){return typeof id==='string'&&/^[A-Za-z0-9_-]{11}$/.test(id)&&publishedVideoIds.has(id)?'https://www.youtube-nocookie.com/embed/'+id+'?autoplay=1&rel=0':'';}
function videoLinks(video) {
 const url=safeURL(video.url);
 return `<a class="text-link" href="medya.html?video=${encodeURIComponent(video.id)}">Yayın dosyasını aç</a><a class="text-link video-link" href="${esc(url)}" target="_blank" rel="noopener noreferrer">YouTube’da aç</a>${video.eventSlug?`<a class="text-link" href="etkinlik.html?slug=${encodeURIComponent(video.eventSlug)}">Buluşmanın hikâyesi</a>`:''}`;
}
function videoCard(video){
 const url=safeURL(video.url);if(!url||!mediaEmbedURL(video.id))return '';
 return `<article class="video-card" data-video-id="${esc(video.id)}"><div class="video-player" id="video-player-${esc(video.id)}"><button class="video-cover video-trigger" type="button" data-video-trigger="${esc(video.id)}" data-video-title="${esc(video.title)}" aria-label="${esc(video.title)} — bu sayfada oynat"><span>${esc(video.kind)}</span><strong>${esc(video.title)}</strong><span class="video-play">Videoyu oynat</span></button></div><h3>${esc(video.subtitle)}</h3><p>${esc(video.description)}</p><div class="video-links">${videoLinks(video)}</div></article>`;
}
const wiredVideoButtons = new WeakSet();
function setupVideoPlayers() {
 for (const button of document.querySelectorAll('[data-video-trigger]')) {
  if (wiredVideoButtons.has(button)) continue;
  wiredVideoButtons.add(button);
  button.addEventListener('click',async () => {
   const id=button.dataset.videoTrigger, host=$('#video-player-'+id);
   if (button.disabled || !mediaEmbedURL(id) || !host?.contains(button)) return;
   const card=host.parentElement;
   button.disabled=true;
   host.setAttribute('aria-busy','true');
   try {
    const {videos}=await freshMediaPublication();
    if (!document.body.contains(button)) return;
    const video=videos.find(item=>item.id===id);
    if (!video || (page==='detail' && video.eventSlug!==params.get('slug'))) {
     card.innerHTML='<p role="status">Bu yayın burada artık yer almıyor.</p><a class="text-link" href="medya.html">Tüm yayınlar</a>';
     return;
    }
    card.querySelector('h3').textContent=video.subtitle;
    card.querySelector('p').textContent=video.description;
    card.querySelector('.video-links').innerHTML=videoLinks(video);
    host.innerHTML=`<iframe src="${esc(mediaEmbedURL(id))}" title="YouTube: ${esc(video.title)}" loading="lazy" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>`;
   } catch {
    if (document.body.contains(button)) card.innerHTML='<p role="status">Güncel yayın bilgisi alınamadı.</p><a class="text-link" href="medya.html?video='+encodeURIComponent(id)+'">Yayın dosyasını aç</a>';
   } finally { host.setAttribute('aria-busy','false'); }
  });
 }
}
// [codex] A video page reads the publication view again before connecting to YouTube.
async function freshMediaPublication() {
  const raw = preview ? await staticJSON('data/media.json') : await request('site-media');
  return normaliseMediaData(raw);
}
async function mediaEventDetails(slug) {
  if (typeof slug !== 'string' || slug.length > 160 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return null;
  let event;
  if (preview) {
    event = (await catalogPromise).events.find(record => record.slug === slug);
  } else {
    try {
      event = (await request('events/'+encodeURIComponent(slug))).event;
    } catch (error) {
      if (error.status === 404 || error.status === 403) return null;
      throw error;
    }
  }
  if (!event || event.slug !== slug || (!preview && !['published','closed'].includes(event.status))) return null;
  const editorial = await editorialPromise.catch(() => ({}));
  const gallery = archiveGallery(event, editorial.events?.[slug] || {}).map(photo => ({
    src: photo.src, thumbnail: photo.thumbnailSrc, alt: photo.alt, caption: photo.caption
  }));
  return {slug, title:event.title, year:event.year??null, city:event.city??null, gallery};
}
async function renderVideoDetail() {
  const list = $('#media-index'), host = $('#media-feature');
  list.hidden = true; host.hidden = false;
  try {
    const {mountMediaFeature} = await import('./media-feature.mjs');
    const ids = params.getAll('video');
    await mountMediaFeature({
      host, videoId:ids.length===1 ? ids[0] : '', loadMedia:freshMediaPublication, loadEvent:mediaEventDetails,
      verifyPlayback:async id => {
        const {videos} = await freshMediaPublication();
        const video = videos.find(item => item.id === id);
        if (!video) return null;
        const event = video.eventSlug ? await mediaEventDetails(video.eventSlug).catch(() => null) : null;
        return {url:'https://www.youtube-nocookie.com/embed/'+id+'?autoplay=1&rel=0', eventSlug:video.eventSlug, event};
      }
    });
  } catch {
    host.innerHTML='<section class="section"><h1>Yayın dosyası yüklenemedi.</h1><p role="status">Bağlantını kontrol edip yeniden deneyebilirsin.</p><a class="text-link" href="medya.html">Tüm yayınlara dön</a></section>';
  }
}
async function renderMedia(selector='#media-list'){
 const data=await loadMediaData();
 $(selector).classList.add('ux-media-lead');$(selector).innerHTML=data.videos.length?data.videos.map(videoCard).join(''):`<div class="ux-note"><p>${data.unavailable?'Videolara şu anda ulaşılamıyor. Daha sonra yeniden deneyebilirsin.':'Bu alanda henüz yayımlanmış video bulunmuyor.'}</p><a class="text-link" href="https://www.youtube.com/@archifycom" target="_blank" rel="noopener noreferrer">Archify YouTube kanalını aç</a></div>`;setupVideoPlayers();
}

function categoryPlate(id,events){
 const photos={
  zirve:{stem:'istanbul-zirve-2025-avlu',small:800,width:1272,height:716,alt:'İstanbul Mimarlık Zirvesi 2025 avlusundaki atölye masalarının yukarıdan görünümü.',caption:'Arşivden referans: İstanbul Mimarlık Zirvesi 2025 · Archify tanıtım kitapçığı, s. 14.'},
  festival:{stem:'archfest-2023-acik-sahne',small:449,width:516,height:919,alt:'ARCHFEST 2023 açık hava sahnesi ve arkadan görülen dinleyiciler.',caption:'Arşivden referans: ARCHFEST 2023 · Archify tanıtım kitapçığı, s. 10.'},
  sempozyum:{stem:'izmir-sempozyumu-2023-salon',small:800,width:1600,height:1067,alt:'İzmir Sempozyumu 2023 salonunun üst sıradan genel görünümü.',caption:'Arşivden referans: İzmir Sempozyumu 2023 · Archify tanıtım kitapçığı, s. 9.'}
 };
 const photo=photos[id];
 if(photo){const stem='assets/images/ux/'+photo.stem;if(events.some(event=>(event.gallery||[]).some(image=>image.src===stem+'-1600.webp')))return `<figure class="ux-category-plate ux-category-plate--photo"><img src="${stem}-800.webp" srcset="${stem}-800.webp ${photo.small}w, ${stem}-1600.webp ${photo.width}w" sizes="(max-width: 760px) 92vw, 52vw" width="${photo.width}" height="${photo.height}" alt="${esc(photo.alt)}"><figcaption>${esc(photo.caption)}</figcaption></figure>`;}
 return `<div class="ux-category-plate ux-category-plate--diagram premium-category-plate" aria-hidden="true">${categoryIcon(id)}</div>`;
}
// [codex] A live catalog reload carries publication authority for these archive views.
async function loadPublishedArchive() {
  const edit = editorialPromise.catch(() => staticJSON('data/editorial.json'));
  const records = preview ? catalogPromise.catch(() => staticJSON('data/catalog.json')) : request('events');
  const [editorial, catalog] = await Promise.all([edit, records]);
  if (!Array.isArray(catalog.events)) throw new Error('catalog_unavailable');
  return {events:preview ? catalog.events.map(archiveEvent) : catalog.events, editorial, preview};
}

// [codex] 01a20fd9 · Each edition is resolved against the published event catalog on each refresh.
async function renderFestivalSummit(category) {
  const host=$('#festival-summit');
  $('#category-standard').hidden=true;
  host.hidden=false;
  document.body.dataset.categoryPage=category;
  document.title=(category==='festival'?'Festivaller':'Mimarlık zirveleri')+' · Archify';
  try {
    const {mountFestivalSummit}=await import('./festival-summit.mjs');
    await mountFestivalSummit({host,category,loadArchive:loadPublishedArchive});
  } catch {
    const title=document.createElement('h1'),retry=document.createElement('a');
    title.textContent='Etkinlik arşivi şu anda açılamıyor.';
    retry.className='button';retry.href=location.href;retry.textContent='Yeniden dene';
    host.replaceChildren(title,retry);
  }
}

async function renderCategoryArchive(category) {
  const travel = category === 'yurt-disi-tur';
  const host = $(travel ? '#travel-archive' : '#academy-library');
  $('#category-standard').hidden = true;
  host.hidden = false;
  document.title = travel ? 'Yurt dışı turları · Archify' : 'Atölye kitaplığı · Archify';
  document.body.dataset.categoryPage = category;
  try {
    const mount = travel ? (await import('./travel-archive.mjs')).mountTravelArchive
                         : (await import('./academy-library.mjs')).mountAcademyLibrary;
    await mount({host, loadArchive:loadPublishedArchive});
    if (!travel) {
      const nav=document.createElement('nav');nav.className='section';nav.setAttribute('aria-label','Atölye hesabı');
      const link=document.createElement('a');link.className='text-link';link.href='egitim-ilgilerim.html';link.textContent='Hesabımda eğitim ilgilerimi yönet';
      nav.append(link);host.after(nav);
    }
  } catch {
    host.innerHTML='<section class="section"><h1>'+ (travel?'Tur arşivi':'Atölye kitaplığı') +' yüklenemedi.</h1><p>Bağlantını kontrol edip yeniden deneyebilirsin.</p><a class="button" href="kategori.html?tur='+category+'">Yeniden dene</a></section>';
  }
}

function renderCategory(data){
 const spec=categoryPage(params.get('tur'));
 const setSection=(selector,content)=>{const host=$(selector);host.innerHTML=content;let section=host;while(section&&!section.classList.contains('section'))section=section.parentElement;if(section)section.hidden=!content;else host.hidden=!content;};
 if(!spec){$('#category-intro').innerHTML='<div class="ux-masthead-copy"><p class="eyebrow">Etkinlik türleri</p><h1>Nasıl buluşuyoruz?</h1></div><div class="ux-masthead-aside"><p class="lead">Konuşma, üretim, yolculuk veya sohbet: ilgini çeken alandan başla.</p></div><div class="category-grid">'+CATEGORY_PAGES.map(c=>`<a class="category-tile" data-category="${c.id}" href="kategori.html?tur=${c.id}"><span class="ux-category-mark" aria-hidden="true"></span><h2>${esc(c.name)}</h2><p>${esc(c.kicker)}</p></a>`).join('')+'</div>';setSection('#category-upcoming','');setSection('#category-past','');setSection('#category-series','');return;}
 document.title=spec.name+' · Archify';document.body.dataset.categoryPage=spec.id;
 const selected=data.events.filter(e=>spec.matches.includes(e.category)&&!['draft','cancelled'].includes(e.status)),past=selected.filter(e=>e.archived||(e.endAt&&Date.parse(e.endAt)<Date.now())).sort((a,b)=>(b.year||0)-(a.year||0)),upcoming=homeAvailableEvents(selected,Date.now());
 const series=publicSeries(data.editorial.series).filter(item=>spec.series.includes(item.slug));
 const workshopParents=spec.id==='atolye'?data.events.filter(e=>data.editorial.events[e.slug]?.subprograms?.length||data.editorial.events[e.slug]?.workshops?.length):[];
 $('#category-intro').innerHTML=`<div class="ux-masthead-copy"><p class="eyebrow">${esc(spec.kicker)}</p>${categoryIcon(spec.id,'premium-category-heading-icon')}<h1>${esc(spec.name)}</h1>${categoryPlate(spec.id,selected)}</div><div class="ux-masthead-aside"><p class="lead">${esc(spec.intro)}</p><ul class="category-topics">${spec.topics.map(t=>`<li>${esc(t)}</li>`).join('')}</ul><nav class="category-jump" aria-label="Kategori bölümleri">${upcoming.length?'<a href="#category-upcoming">Yaklaşan etkinlikler</a>':''}${past.length?'<a href="#kategori-arsiv">Geçmiş buluşmalar</a>':''}${series.length||workshopParents.length?'<a href="#kategori-seriler">İlgili programlar</a>':''}<a href="etkinlikler.html">Tüm kategoriler</a></nav>${categoryWayfinder(spec.id)}</div>`;
 setSection('#category-upcoming',upcoming.length?`<div class="editorial-grid">${upcoming.map(e=>card(e,data.editorial)).join('')}</div>`:(!past.length&&!series.length&&!workshopParents.length?`<div class="empty-state"><h2>${esc(spec.name)} için yeni programlar</h2><p>Bu kategoride yayımlanan bir kayıt henüz yok. Yeni buluşmalar için topluluğu takip edebilirsin.</p><a class="button" href="topluluk.html">Topluluğa katıl</a></div>`:''));
 const social=past.filter(e=>e.category!=='Teknik gezi'),technical=past.filter(e=>e.category==='Teknik gezi');
 setSection('#category-past',archiveRows(social,data.editorial)+(technical.length?`<section class="ux-technical-visits"><h2>Türkiye içi teknik geziler</h2>${archiveRows(technical,data.editorial)}</section>`:''));
 setSection('#category-series',seriesRows(series,data)+(workshopParents.length?`<div class="ux-parent-programs"><h2>Zirve ve festival atölyeleri</h2><p>Bu atölyeler, ana etkinliklerin programı içinde gerçekleşti.</p>${workshopParents.map(e=>`<p><a class="text-link" href="${eventURL(e)}#atolyeler">${esc(e.title)} atölyeleri</a></p>`).join('')}</div>`:''));
}
async function renderCommunity(){
 const catalog=await staticJSON('data/community.json');
 const groups=catalog.groups;
 const cities=[...new Set(groups.map(g=>g.city).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'tr'));
 if($('#group-city'))$('#group-city').innerHTML+=$('#group-city').innerHTML.includes('İstanbul')?'':cities.map(city=>`<option>${esc(city)}</option>`).join('');
 if($('#group-category'))$('#group-category').value=params.get('tur')||'';
 if($('#group-city'))$('#group-city').value=params.get('sehir')||'';
 function draw(){
  if(!$('#group-list'))return;
  const type=$('#group-category')?.value||'',city=$('#group-city')?.value||'';
  const selected=groups.filter(g=>(!type||g.category===type)&&(!city||g.city===city));
  if($('#group-count'))$('#group-count').textContent=selected.length?'Toplulukları keşfet; uygun grupları profilinle belirle.':'Bu filtrede topluluk bulunamadı';
  const descriptions={'Duyuru':'Yeni programları ve Archify duyurularını takip et.','Meslek':'Aynı mesleki merakı paylaşanlarla buluş.','Şehir / Bölge':'Yakınındaki mimarlık ve tasarım çevresiyle tanış.','Uluslararası':'Farklı ülkelerden topluluklarla bağlantı kur.'};
  $('#group-list').innerHTML=GROUP_TYPES.map(category=>{const entries=selected.filter(g=>g.category===category);return entries.length?`<section class="ux-community-group" data-group-category="${esc(category)}"><header><h2>${esc(category)}</h2><p>${esc(descriptions[category])}</p></header><div class="ux-community-grid">${entries.map(g=>`<article class="group-row ux-group-card" id="grup-${esc(g.id)}" data-group-id="${esc(g.id)}"><div><p class="group-kicker">${esc(g.city||g.category)}</p><h3>${esc(g.name)}</h3><p>${esc(g.description)}</p></div><div><a class="button button-secondary" href="grup-basvuru.html?grup=${encodeURIComponent(g.id)}" data-analytics-target="community-apply">Uygunluğumu kontrol et<span class="visually-hidden">: ${esc(g.name)}</span></a><p class="group-link-note">Başvuru öncesinde durumuna, alanına ve şehrine uygunluk kontrol edilir.</p></div></article>`).join('')}</div></section>`:'';}).join('')||'<div class="empty-state"><h3>Bu seçimde topluluk bulunamadı.</h3><p>İlgi alanını veya şehir seçimini değiştirerek yeniden bakabilirsin.</p></div>';
 }
 $('#group-filters')?.addEventListener('change',()=>{draw();const next=new URL(location.href);for(const [key,value]of [['tur',$('#group-category')?.value],['sehir',$('#group-city')?.value]])value?next.searchParams.set(key,value):next.searchParams.delete(key);history.replaceState(null,'',next);});
 $('#group-filters')?.addEventListener('submit',e=>e.preventDefault());draw();
 if(/^#grup-[a-z-]+$/.test(location.hash))$(location.hash)?.scrollIntoView?.({block:'start'});
 await setupCommunityFlow(catalog);
}
async function setupCommunityFlow(catalog){
 const [profiles,communities]=await Promise.all([staticJSON('data/community-profiles.json'),catalog?Promise.resolve(catalog):staticJSON('data/community.json')]);
 const accountChoice=preview?null:(await import('./community-account-choice.mjs')).setupCommunityAccountChoice({doc:document,preview});
 await setupCommunityEligibility({document,preview,profiles,groups:communities.groups,request,session,params,accountChoice});
}

function renderSources(data) {
  $('#source-list').innerHTML = data.events.filter(event=>data.editorial.events[event.slug]).map(event => {const edit=data.editorial.events[event.slug];return `<article class="source-row"><h2><a href="${eventURL(event)}">${esc(event.title)}</a></h2><p class="card-meta">${esc([edit.dateLabel || event.year,edit.evidenceLabel].filter(Boolean).join(' · '))}</p>${[edit.source,...(edit.additionalSources || [])].filter(Boolean).map(item=>sourceMarkup(item)).join('')}</article>`;}).join('');
}

async function setupForm() {
  if(['community','community-application'].includes(page))return; // Profile eligibility is the sole public community submission path.
  const form = $('#application-form'), fields = $('#application-fields'), status = $('#form-status'), retry = $('#retry-application');
  const isTeam = page === 'team-application', isCommunity=page==='community-application';
  let endpoint=isCommunity?'community-applications':isTeam?'team-applications':'applications';
  let payment=null,ticketOptions=null,eventQuestions=null;
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
        payment=ticketConfig(await request('tickets/config/'+encodeURIComponent(slug)));
        const catalog=await request('ticket-options/'+encodeURIComponent(slug));
        ticketOptions=renderTicketOptions({document,host:$('#r14-ticket-options'),catalog,paymentAvailable:payment.paymentAvailable});
        if (catalog.classes.some(ticketClass => ticketClass.seatRequired)) {
          const selection = ticketOptions;
          void request('seat-layout/'+encodeURIComponent(slug)).then(plan => {
            if (ticketOptions === selection && plan.eventSlug === slug && plan.layout) {
              selection.setSeatPlan(plan);
            }
          }).catch(() => { /* Seat inventory and the accessible selection list remain available. */ });
        }
        eventQuestions=await setupEventQuestions({document,host:$('#event-questions'),preview,request,eventSlug:slug});
        endpoint=payment.mode==='paid'?'tickets/orders':'applications';
        if(ticketOptions.required){$('#application-event').insertAdjacentHTML('beforeend','<p class="ticket-price"><strong>Bilet sınıfına göre kayıt</strong> · Uygun sınıfı ve gerekiyorsa koltuğu seç.</p>');if(!ticketOptions.available){show('Şu anda uygun bilet sınıfı bulunmuyor.');return;}}
        else {$('#application-event').insertAdjacentHTML('beforeend',`<p class="ticket-price"><strong>${payment.mode==='paid'?esc(money(payment.priceMinor)):'Ücretsiz katılım'}</strong>${payment.mode==='paid'?' · Bilet, ödeme doğrulandıktan sonra oluşur.':' · Başvuru kabulünde kişisel giriş kodu oluşturulur.'}</p>`);if(payment.mode==='paid'&&!payment.paymentAvailable){show('Bu ücretli etkinliğin ödeme bağlantısı şu anda kapalı. Henüz kişisel bilgi veya ödeme alınmıyor.');return;}}
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
      if(endpoint==='tickets/orders'){
        if(!renderOrderReceipt(status,result))throw Object.assign(new Error('network'),{code:'network',status:0});
        completed=true;form.reset();fields.hidden=true;retry.hidden=true;status.className='form-status success';payload=null;status.focus();return;
      }
      if (!result || typeof result.reference!=='string' || !['accepted','received'].includes(result.status)) throw Object.assign(new Error('network'),{code:'network',status:0});
      completed=true;form.reset();fields.hidden=true;retry.hidden=true;status.className='form-status success';
      status.innerHTML=isCommunity?`<strong>Topluluk başvurun alındı.</strong><p>${esc(group.name)} için başvurun ekibe iletildi. Gruba otomatik katılım veya mesaj gönderimi yapılmadı. Başvuru referansını sakla.</p><code>${esc(result.reference)}</code><a class="text-link" href="topluluk.html">Topluluklara dön</a>`:`<strong>${isTeam?'Başvurun alındı.':'Başvurun kaydedildi.'}</strong>${isTeam?'Ekibin değerlendirmesi için iletildi. Bu sonuç ekip kabulü anlamına gelmez.':'Başvuru referansını sakla.'}<code>${esc(result.reference)}</code><p>${payload.noticeConsent?'WhatsApp bilgilendirmesi tercihin kaydedildi. Bu ekran başvuru kaydını doğrular; mesajın teslim edildiğini göstermez.':'Başvurunun kaydı tamamlandı. WhatsApp bilgilendirmesi istemedin.'}</p><a class="text-link" href="${isTeam?'hakkimizda.html':eventURL(event)}">${isTeam?'Archify’ı keşfet':'Etkinliğe dön'}</a>`;
      if(!isTeam&&!isCommunity&&result.ticket){status.insertAdjacentHTML('beforeend','<div id="application-ticket"></div>');renderTicketReceipt($('#application-ticket'),result.ticket);}
      payload=null;status.focus();
    } catch(error) {
      show(['payment_unavailable','paid_registration_required','invalid_ticket_config'].includes(error.code)?ticketError(error):errorMessage(error.code),'error',true);
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
    if(!isTeam&&!isCommunity){try{if(ticketOptions?.required){const selected=ticketOptions.read();payload.selection=selected.selection;endpoint=selected.mode==='paid'?'tickets/orders':'applications';}if(eventQuestions){if(!eventQuestions.validate()){payload=null;return;}Object.assign(payload,eventQuestions.read());}}catch(err){payload=null;show('Bilet sınıfı, koltuk ve zorunlu yanıtları kontrol et.','error',true);return;}}
    void submit();
  });
  $('#phone').addEventListener('input',()=>$('#phone').setCustomValidity(''));
  retry.addEventListener('click',()=>{if(retryKind==='setup')void setup();else void submit();});
  await setup();
}

setupNavigation();
enhanceCategoryIdentity(document,location);
// [codex] R16 private account pages never initialize analytics or provider scripts.
if(['member-dashboard','member-register','company-workspace','network-workspace','vacancy-directory','network-directory'].includes(page)){
  document.querySelectorAll('[data-consent-preferences]').forEach(control=>{control.hidden=true;});
}else{
  providers=setupProviders({document,window,preview,request,session,page});
  analytics=setupAnalytics({document,window,location,preview,request,session,onConsent:choice=>void providers.setConsent(choice),onEvent:event=>providers.measure(event)});
  catalogPromise.then(data=>analytics.allowEvents(data.events)).catch(()=>{});
}

async function downloadCertificate(token){
  if(preview)return;
  const send=()=>fetch(new URL('api/sertifika.php',base),{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json','X-CSRF-Token':csrfToken||''},body:JSON.stringify({token})});
  let response=await send();
  if(!response.ok){let problem;try{problem=await response.json();}catch{}if(['request_verification','csrf_invalid','invalid_csrf'].includes(problem?.error)){await session();response=await send();}else throw Object.assign(new Error('certificate'),{code:problem?.error});}
  if(!response.ok||!response.headers.get('Content-Type')?.includes('application/pdf'))throw new Error('certificate');
  const blob=await response.blob();if(blob.size>5*1024*1024||!blob.size)throw new Error('certificate');
  if($('#ticket-token')?.value.trim()!==token||$('#ticket-receipt')?.hidden)return;
  const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='archify-katilim-sertifikasi.pdf';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
async function main(){
  if(['ticket','checkout'].includes(page)){const badge=$('#r14-badge-button');const clearTicket=()=>{if(badge)badge.disabled=true;window.dispatchEvent(new Event('archify:ticket-clear'));void setupTicketSurvey({document,preview,request,session,token:null});};const verifiedTicket=token=>{if(badge)badge.disabled=false;window.dispatchEvent(new Event('archify:ticket-verified'));void setupTicketSurvey({document,preview,request,session,token}).catch(()=>{});};setupTickets({document,window,location,preview,request,session,certificateDownload:downloadCertificate,onAccepted:()=>void providers.pullConversions(),onTicketLookupStart:clearTicket,onTicketVerified:verifiedTicket});return;}
  if(page==='home'){setupHomeExperience();void renderMedia('#home-media');if(preview){const [catalog,editorial]=await Promise.all([catalogPromise,editorialPromise]);renderHome({events:catalog.events.map(archiveEvent),editorial,live:false});}return;}
  if(['application','team-application'].includes(page)){await setupForm();return;}
  if(page==='community-application'){await setupCommunityFlow();return;}
  if(page==='community'){await renderCommunity();return;}
  if(page==='media'){if(params.has('video'))await renderVideoDetail();else await renderMedia();return;}
  if(!['home','archive','events','series','detail','sources','category'].includes(page))return;
  if(page==='category' && ['festival','zirve'].includes(params.get('tur'))){await renderFestivalSummit(params.get('tur'));return;}
  if(page==='category' && ['yurt-disi-tur','atolye'].includes(params.get('tur'))){await renderCategoryArchive(params.get('tur'));return;}
  const data=await loadData();
  const renderers={home:renderHome,archive:renderArchive,events:renderEvents,series:renderSeries,detail:renderDetail,sources:renderSources,category:renderCategory};
  await renderers[page](data);
  enhanceCategoryIdentity(document,location);
}
// Avoid unhandled fetch failures on pages that do not need the catalogue.
catalogPromise.catch(()=>{});editorialPromise.catch(()=>{});
main().finally(()=>analytics?.pageView()).catch(()=>{
  const host=(page==='series'&&params.get('seri')?$('#series-events'):null)||$('#home-events')||$('#event-list')||$('#upcoming-events')||$('#series-list')||$('#event-detail')||$('#source-list')||$('#group-list')||$('#media-list')||$('#category-upcoming');
  if(host){host.hidden=false;host.innerHTML='<div class="empty-state"><h2>Bağlantıya kısa bir ara.</h2><p>İçerik şu anda yüklenemedi. Sayfayı yenileyebilir veya iletişim sayfasından devam edebilirsin.</p><a class="button" href="iletisim.html">İletişim</a></div>';}
});
