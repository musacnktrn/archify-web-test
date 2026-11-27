// [codex] 01a20fe8-199e-7631-8910-07e7d27b753d · P38 pure, memory-only public search.
import {normalizeSearch, archiveEvent} from './core.mjs';
import {campusCatalog} from './campus-directory.mjs';
import {photoAlbumData} from './photo-albums.mjs';

const KINDS = Object.freeze(['event','series','album','school','video','action']);
const PAGE_SIZE = 12;
const collator = new Intl.Collator('tr', {sensitivity:'base', numeric:true});
const details = new WeakMap();
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const slug = value => typeof value === 'string' && value.length <= 100 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
const videoId = value => typeof value === 'string' && /^[A-Za-z0-9_-]{11}$/.test(value);
const plain = (value, max) => typeof value === 'string' && [...value].length <= max && !/[\u0000-\u001f\u007f<>]/.test(value) ? value.trim() : '';
const year = value => Number.isInteger(value) && value >= 1900 && value <= 2200 ? value : null;
const key = value => normalizeSearch(value).replace(/[^\p{L}\p{N}]+/gu,' ').replace(/\s+/g,' ').trim();
const visible = item => item.hidden !== true && item.published !== false && item.public !== false;

// These are ordinary public entry pages, never private records, bearer links or an account directory.
const ACTIONS = Object.freeze([
  ['events','Yaklaşan etkinlikler','Yayımlanan etkinlikleri ve güncel başvuru durumlarını incele.','etkinlikler.html','etkinlik başvuru kayıt'],
  ['archive','Etkinlik arşivi','Geçmiş buluşmaların kaynaklı dosyalarını keşfet.','arsiv.html','geçmiş arşiv etkinlik'],
  ['tickets','Biletim ve sertifikam','Kendi biletini açmak ve sertifika durumunu kontrol etmek için giriş sayfası.','bilet.html','bilet sertifika qr'],
  ['community','Topluluklara başvur','Profiline uygun toplulukları kontrol ederek başvuruya geç.','grup-basvuru.html','topluluk grup başvuru whatsapp'],
  ['career','Kariyer ve iş / staj fırsatları','Kariyer alanını ve başvuru yollarını incele.','kariyer.html','kariyer iş staj'],
  ['jobs','İş ve staj ilanları','Yayımlanan ilanları ve güncel koşullarını incele.','ilanlar.html','ilan kariyer iş staj'],
  ['campus','Kampüs rehberi','Üniversiteni tam adıyla veya şehriyle bul.','kampus.html','kampüs okul üniversite'],
  ['albums','Fotoğraf albümleri','Yayımdaki etkinlik fotoğraflarına göz at.','albumler.html','fotoğraf albüm galeri'],
  ['media','Archify yayınları','Video ve söyleşi dosyalarını keşfet.','medya.html','video söyleşi youtube yayın medya'],
  ['workshops','Atölye kitaplığı','Kaynaklı atölye ve eğitim programlarını incele.','kategori.html?tur=atolye','atölye eğitim academy'],
  ['team','Ekibe katıl','Archify ekibine başvuru yolunu aç.','ekibe-katil.html','ekip gönüllü başvuru'],
  ['account','Hesabım','Kendi hesabının giriş sayfasını aç.','hesabim.html','hesap üye üyelik giriş'],
  ['candidate','Kariyer ağına başvur','Aday başvuru formuna ve paylaşım açıklamasına geç.','kariyer-basvuru.html','aday kariyer başvuru'],
  ['company','Firma başvurusu','Kurumlar için kariyer ağı başvuru yolunu aç.','firma-basvuru.html','firma şirket işveren kariyer başvuru'],
  ['partnership','İş birliği','Archify ile kurumsal iş birliği yollarını incele.','is-birligi.html','işbirliği iş birliği sponsorluk kurum'],
  ['contact','İletişim','Archify’nin yayımlanmış kurumsal iletişim yollarına ulaş.','iletisim.html','iletişim ulaş'],
  ['about','Hakkımızda','Archify’nin çalışmalarını ve yaklaşımını tanı.','hakkimizda.html','archify hakkında'],
  ['sources','Kaynaklar','Sitedeki kamu içeriklerinin kaynak açıklamalarını incele.','kaynaklar.html','kaynak fotoğraf lisans']
].map(row => Object.freeze(row)));

function duplicates(items, field, valid) {
  const counts = new Map();
  for (const item of items) if (record(item) && valid(item[field])) counts.set(item[field], (counts.get(item[field]) || 0) + 1);
  return new Set([...counts].filter(([,count]) => count > 1).map(([id]) => id));
}

/** Sources have already been fetched by the caller. null means unavailable; [] means a valid empty publication. */
export function buildSiteSearchIndex(sources = {}) {
  sources = record(sources) ? sources : {};
  const preview = sources.preview === true;
  const entries = [], search = new Map();
  const coverage = new Map(KINDS.map(kind => [kind, {kind, state:'unavailable', count:0}]));
  const setState = (kind, state) => {coverage.get(kind).state = state;};
  const add = (kind, identity, title, description, href, meta = {}, words = '') => {
    const id = kind + ':' + identity;
    if (search.has(id)) return;
    const item = Object.freeze({id,kind,title,description,href,meta:Object.freeze({city:meta.city || null,year:meta.year ?? null,category:meta.category || null})});
    entries.push(item);
    search.set(id, {title:key(title), text:key([title, words, meta.city, meta.year, meta.category].filter(v => v !== null && v !== undefined).join(' ')), order:entries.length});
    coverage.get(kind).count++;
  };

  const currentEvents = new Map();
  if (Array.isArray(sources.events)) {
    let partial = sources.events.length >= 500;
    const repeated = duplicates(sources.events.slice(0,501),'slug',slug);
    for (const source of sources.events.slice(0,500)) {
      if (!record(source) || !slug(source.slug) || repeated.has(source.slug)) {partial=true;continue;}
      if (!visible(source) || ['draft','cancelled'].includes(source.status)) continue;
      const event = source.status === undefined && preview ? archiveEvent(source) : source;
      const title = plain(event.title,500);
      if (!title || !['published','closed'].includes(event.status)) {partial=true;continue;}
      const city = plain(event.city,150), category = plain(event.category,100), eventYear = year(event.year);
      currentEvents.set(event.slug, {...event,title,city,category,year:eventYear});
      const description = [category,city,eventYear].filter(Boolean).join(' · ') || 'Etkinlik dosyası';
      add('event',event.slug,title,description,'etkinlik.html?slug='+encodeURIComponent(event.slug),{city,category,year:eventYear},'etkinlik');
    }
    setState('event',partial?'partial':'ready');

    const editReady = record(sources.editorial) && record(sources.editorial.events);
    let albumPartial = partial || !editReady;
    for (const event of currentEvents.values()) {
      if (!Array.isArray(event.gallery) || event.gallery.length>40) {albumPartial=true;continue;}
      const edit = editReady && Object.hasOwn(sources.editorial.events,event.slug) && record(sources.editorial.events[event.slug]) ? sources.editorial.events[event.slug] : {};
      // Poster metadata cannot turn a publicity image into a photograph result.
      const posters = new Set((Array.isArray(edit.posterMetadata)?edit.posterMetadata:[]).map(p=>p?.src));
      const gallery = event.gallery.filter(p=>record(p) && p.kind !== 'poster' && !posters.has(p.src));
      try {
        const album = photoAlbumData({preview,event:{...event,gallery},editorial:{events:{[event.slug]:edit}}},event.slug);
        if (!album?.photos.length) continue;
        add('album',event.slug,event.title,album.photos.length+' fotoğraf · '+([event.city,event.year].filter(Boolean).join(' · ')||'Etkinlik albümü'),
          'albumler.html?etkinlik='+encodeURIComponent(event.slug),{city:event.city,category:event.category,year:event.year},'albüm fotoğraf galeri');
      } catch {albumPartial=true;}
    }
    setState('album',albumPartial?'partial':'ready');

    if (record(sources.editorial) && Array.isArray(sources.editorial.series)) {
      const definitions = sources.editorial.series;
      let seriesPartial = partial || definitions.length>200;
      const repeatedSeries = duplicates(definitions.slice(0,201),'slug',slug);
      for (const item of definitions.slice(0,200)) {
        if (!record(item) || !slug(item.slug) || repeatedSeries.has(item.slug) || !plain(item.title,500)
            || !Array.isArray(item.slugs) || item.slugs.length>500 || !item.slugs.every(slug)) {seriesPartial=true;continue;}
        if (!visible(item)) continue;
        const members = [...new Set(item.slugs)].map(id=>currentEvents.get(id)).filter(Boolean);
        if (!members.length) continue;
        const category = plain(item.category,100);
        add('series',item.slug,plain(item.title,500),members.length+' yayımlanmış etkinlik','seri.html?seri='+encodeURIComponent(item.slug),{category},
          ['seri',...members.flatMap(e=>[e.title,e.city,e.year,e.category])].filter(Boolean).join(' '));
      }
      setState('series',seriesPartial?'partial':'ready');
    }
  }

  if (sources.profiles !== null && sources.profiles !== undefined) {
    try {
      const catalog = campusCatalog(sources.profiles);
      for (const school of catalog.schools) add('school',school.id,school.name,school.city || 'Şehir bilgisi belirtilmemiş',
        'kampus.html?okul='+encodeURIComponent(school.id),{city:school.city},'okul üniversite kampüs');
      setState('school','ready');
    } catch {/* malformed/unavailable catalog has no stale replacement */}
  }

  if (record(sources.media) && sources.media.unavailable !== true && Array.isArray(sources.media.videos)) {
    const videos = sources.media.videos;
    let partial = videos.length>200;
    const repeated = duplicates(videos.slice(0,201),'id',videoId);
    for (const item of videos.slice(0,200)) {
      if (!record(item) || !videoId(item.id) || repeated.has(item.id) || !plain(item.title,500)) {partial=true;continue;}
      if (!visible(item) || (item.status !== undefined && item.status !== 'published')) continue;
      try {
        const url = new URL(item.url);
        if (url.origin!=='https://www.youtube.com' || url.pathname!=='/watch' || url.username || url.password || url.hash
            || url.searchParams.getAll('v').length!==1 || url.searchParams.get('v')!==item.id) {partial=true;continue;}
      } catch {partial=true;continue;}
      const subtitle = plain(item.subtitle,500), category = plain(item.kind,100);
      const event = currentEvents.get(item.eventSlug);
      add('video',item.id,plain(item.title,500),[subtitle,category].filter(Boolean).join(' · ') || 'Archify yayını',
        'medya.html?video='+encodeURIComponent(item.id),{category},['video yayın medya youtube',subtitle,event?.title,event?.city].filter(Boolean).join(' '));
    }
    setState('video',partial?'partial':'ready');
  }

  for (const [id,title,description,href,words] of ACTIONS) add('action',id,title,description,href,{},words);
  setState('action','ready');
  const index = Object.freeze({entries:Object.freeze(entries),coverage:Object.freeze([...coverage.values()].map(item=>Object.freeze(item)))});
  details.set(index,search);
  return index;
}

/** Query is transient input only. No URL, analytics, persistence, logging or query cache exists here. */
export function searchSite(index, {query='',kind='all',page=1} = {}) {
  const search = details.get(index);
  const counts = Object.fromEntries(KINDS.map(value=>[value,0]));
  const coverage = search ? index.coverage : [];
  const empty = () => ({items:[],total:0,page:1,pages:1,pageSize:PAGE_SIZE,counts,coverage});
  if (!search || typeof query !== 'string' || [...query].length>120 || /[\u0000-\u001f\u007f]/.test(query)) return empty();
  const needle = key(query), terms = needle.split(' ').filter(Boolean);
  kind = KINDS.includes(kind) ? kind : 'all';
  const matches = index.entries.filter(item=>terms.every(term=>search.get(item.id).text.includes(term)));
  for (const item of matches) counts[item.kind]++;
  const selected = matches.filter(item=>kind==='all'||item.kind===kind);
  const rank = item => {
    const content = search.get(item.id);
    if (!needle) return item.kind==='action' ? 0 : 1;
    return content.title===needle ? 0 : content.title.startsWith(needle) ? 1 : terms.every(term=>content.title.includes(term)) ? 2 : 3;
  };
  selected.sort((a,b)=>rank(a)-rank(b)
    || (!needle&&a.kind==='action'&&b.kind==='action' ? search.get(a.id).order-search.get(b.id).order : 0)
    || collator.compare(a.title,b.title) || KINDS.indexOf(a.kind)-KINDS.indexOf(b.kind) || a.id.localeCompare(b.id));
  const pages = Math.max(1,Math.ceil(selected.length/PAGE_SIZE));
  const current = Number.isInteger(page) && page>0 ? Math.min(page,pages) : 1;
  return {items:selected.slice((current-1)*PAGE_SIZE,current*PAGE_SIZE),total:selected.length,page:current,pages,pageSize:PAGE_SIZE,counts,coverage};
}
