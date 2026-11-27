// [codex] 01a20fe2-64d6-75c3-b882-47be7173d5eb · P12: current-public workshop discovery, no enrollment authority.
const mounts = new WeakMap();
const clean = (value, max = 4000) => typeof value === 'string' && value.length <= max && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value) ? value.trim() : '';
const slugOK = value => typeof value === 'string' && value.length <= 160 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
const stamp = value => typeof value === 'string' && /(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value)) ? Date.parse(value) : NaN;
const validYear = value => Number.isInteger(value) && value >= 1900 && value <= 2200;
const imageURL = value => typeof value === 'string' && value.length <= 1500 && /^(?:assets|media)\/[A-Za-z0-9_./-]+\.(?:webp|png|jpe?g|avif)$/i.test(value) && !value.split('/').includes('..') ? value : '';
const sourceURL = value => { try { const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password ? u.href : ''; } catch { return ''; } };
const normalize = value => String(value).toLocaleLowerCase('tr-TR').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ı/g, 'i');
const eventURL = row => 'etkinlik.html?slug=' + encodeURIComponent(row.slug) + (row.kind === 'program' ? '#atolyeler' : '');
function source(value) { return clean(value?.title, 500) ? { title: clean(value.title, 500), url: sourceURL(value.url) } : null; }
function dateLabel(event, edit, historical) {
  if (historical && edit.datePrecision === 'unknown') return 'Tarih belirtilmemiş';
  if (historical && edit.datePrecision === 'year') return validYear(event.year) ? String(event.year) : 'Yıl belirtilmemiş';
  if (historical && clean(edit.dateLabel, 150)) return clean(edit.dateLabel, 150);
  const start = stamp(event.startAt), end = stamp(event.endAt);
  const format = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Istanbul' });
  if (Number.isFinite(start)) { const first = format.format(new Date(start)); return first + (Number.isFinite(end) && format.format(new Date(end)) !== first ? ' – ' + format.format(new Date(end)) : ''); }
  return historical && validYear(event.year) ? String(event.year) : 'Tarih belirtilmemiş';
}
function photo(event, edit, standalone) {
  const items = Array.isArray(event.gallery) ? event.gallery.slice(0, 100) : [];
  const chosen = items.find(item => imageURL(item?.src) && (standalone || /atölye|workshop|üretim|çizim/i.test(clean(item.alt, 1000))));
  if (!chosen) return null;
  const meta = (Array.isArray(edit.photoMetadata) ? edit.photoMetadata : []).find(item => item?.src === chosen.src) || {};
  // Metadata only enriches an exact currently authorized image; it cannot resurrect one.
  return { src: chosen.src, alt: clean(chosen.alt, 1000) || clean(event.title, 500), caption: clean(meta.caption, 2000) || clean(chosen.alt, 1000), sourceLabel: clean(meta.sourceLabel, 500) };
}

/** A parent event is the identity and publication authority for every topic underneath it. */
export function academyLibraryData(value, now = Date.now()) {
  if (!value || value.unavailable || typeof value.preview !== 'boolean' || !Array.isArray(value.events) || !value.editorial || !value.editorial.events || typeof value.editorial.events !== 'object' || Array.isArray(value.editorial.events)) throw Error('academy_unavailable');
  const seen = new Set(), records = [];
  for (const event of value.events.slice(0, 500)) {
    if (!event || !slugOK(event.slug) || seen.has(event.slug) || !clean(event.title, 500) || !['published', 'closed'].includes(event.status)) continue;
    seen.add(event.slug);
    const start = stamp(event.startAt), end = stamp(event.endAt), historical = event.archived === true || Number.isFinite(end) && end <= now || Number.isFinite(start) && start <= now && !Number.isFinite(end);
    const edit = historical && Object.hasOwn(value.editorial.events, event.slug) ? value.editorial.events[event.slug] || {} : {};
    const standalone = ['Atölye', 'Workshop'].includes(event.category);
    const topics = historical && Array.isArray(edit.workshops) ? [...new Set(edit.workshops.slice(0, 100).map(title => clean(title, 300)).filter(Boolean))] : [];
    const subprograms = historical && Array.isArray(edit.subprograms) ? edit.subprograms.slice(0, 30).filter(item => item && ['Atölye', 'Workshop'].includes(item.category) && clean(item.title, 300)).map(item => ({ title: clean(item.title, 300), description: clean(item.description, 2000) })) : [];
    if (!standalone && !(historical && ['Zirve', 'Festival'].includes(event.category) && (topics.length || subprograms.length))) continue;
    const open = !value.preview && !historical && event.archived === false && event.status === 'published' && event.registrationOpen === true && Number.isFinite(start) && start > now && (!Number.isFinite(end) || end > start);
    const period = historical ? 'history' : Number.isFinite(start) && start > now ? 'upcoming' : 'current';
    records.push({ slug: event.slug, title: clean(event.title, 500), kind: standalone ? 'standalone' : 'program', category: clean(event.category, 100), summary: clean(event.summary, 4000), city: clean(event.city, 150), venue: clean(event.venue, 300), year: validYear(event.year) ? event.year : null, dateLabel: dateLabel(event, edit, historical), datePrecision: historical ? clean(edit.datePrecision, 30) : '', historical, period, open, startAt: Number.isFinite(start) ? start : null, topics, subprograms, source: source(topics.length ? edit.workshopSource : edit.source) || source(edit.source), photo: photo(event, edit, standalone) });
  }
  records.sort((a, b) => Number(a.historical) - Number(b.historical) || (!a.historical && !b.historical ? (a.startAt ?? Infinity) - (b.startAt ?? Infinity) : (b.year || 0) - (a.year || 0)) || a.title.localeCompare(b.title, 'tr'));
  return { records, preview: value.preview };
}

export async function mountAcademyLibrary({ host, loadArchive }) {
  if (!host?.ownerDocument || typeof loadArchive !== 'function') throw TypeError('academy_mount_invalid');
  mounts.get(host)?.();
  const doc = host.ownerDocument, win = doc.defaultView;
  const el = (tag, cls = '', content) => { const n = doc.createElement(tag); if (cls) n.className = cls; if (content !== undefined) n.textContent = content; return n; };
  const link = (label, url, cls = 'al-link') => { const n = el('a', cls, label); n.href = url; return n; };
  const button = (label, action, cls = 'al-button') => { const n = el('button', cls, label); n.type = 'button'; n.dataset.academyAction = action; return n; };
  const root = el('article', 'academy-library'); host.replaceChildren(root);
  const originalTitle = doc.title, ownedTitle = 'Atölye kitaplığı · Archify'; doc.title = ownedTitle;
  let alive = true, suspended = false, generation = 0, data = null, query = '', selectedEvent = '', kind = '';
  const current = token => alive && !suspended && root.parentNode === host && host.isConnected && (token === undefined || token === generation);
  function sourceNode(row) {
    const node = el('p', 'al-source'); node.dataset.academySource = '';
    if (!row.source) { node.textContent = 'Kaynak: yayımlanan etkinlik kaydı'; return node; }
    node.append(el('span', '', 'Kaynak: '));
    if (row.source.url) { const a = link(row.source.title, row.source.url, 'al-source-link'); a.target = '_blank'; a.rel = 'noopener noreferrer'; node.append(a); }
    else node.append(el('span', '', row.source.title));
    return node;
  }
  function record(row, terms) {
    const card = el('article', 'al-record al-record--' + row.kind); card.dataset.academySlug = row.slug; card.dataset.academyKind = row.kind;
    const content = el('div', 'al-record-content'), heading = el('div', 'al-record-heading');
    heading.append(el('p', 'al-eyebrow', row.kind === 'program' ? 'ETKİNLİĞİN İÇİNDE' : 'BAĞIMSIZ ATÖLYE'));
    const h = el('h3'); h.append(link(row.title, eventURL(row), 'al-record-title')); heading.append(h);
    const facts = [row.dateLabel, row.venue || row.city].filter(Boolean); heading.append(el('p', 'al-facts', facts.join(' · ')));
    if (row.datePrecision === 'year') heading.append(el('p', 'al-precision', 'Bu kayıtta yalnız yıl bilgisi bulunuyor.'));
    const status = row.historical ? 'Geçmiş çalışma' : row.open ? 'Başvuru açık' : row.period === 'upcoming' ? 'Yaklaşan etkinlik · başvuru kapalı' : 'Yayımlanan etkinlik · başvuru kapalı';
    heading.append(el('p', 'al-status', status)); content.append(heading);
    if (row.summary) content.append(el('p', 'al-summary', row.summary));
    if (row.topics.length) {
      const topicBox = el('div', 'al-topics'); topicBox.append(el('h4', '', 'Birlikte denenen konular'));
      const list = el('ul'); const parentText = normalize([row.title, row.summary, row.city, row.venue].join(' '));
      for (const topic of row.topics.filter(title => !terms.length || terms.every(t => parentText.includes(t) || normalize(title).includes(t)))) {
        const li = el('li'); li.dataset.academyTopic = ''; li.append(el('span', 'al-topic-mark', '↗'), el('span', '', topic)); list.append(li);
      }
      topicBox.append(list, el('p', 'al-parent-note', 'Bu başlıklar ana etkinlik programının parçasıdır.')); content.append(topicBox);
    } else if (row.subprograms.length) {
      const block = el('div', 'al-general-program'); block.dataset.academyGeneral = '';
      for (const sub of row.subprograms) { block.append(el('h4', '', sub.title)); if (sub.description) block.append(el('p', '', sub.description)); }
      block.append(el('p', 'al-parent-note', 'Ayrıntılı atölye adları bu kayıtta yer almıyor.')); content.append(block);
    }
    content.append(sourceNode(row)); const actions = el('div', 'al-record-actions');
    const detail = link(row.kind === 'program' ? 'Ana etkinliğin programını aç' : 'Atölye kaydını incele', eventURL(row)); detail.dataset.academyEventLink = ''; actions.append(detail);
    if (row.open) {
      const apply = link('Etkinliğe başvur', 'basvuru.html?slug=' + encodeURIComponent(row.slug), 'al-apply'); apply.dataset.academyApply = '';
      apply.addEventListener('click', event => { if (!current() || !row.startAt || row.startAt <= Date.now()) { event.preventDefault(); if (current()) void load(true); } }); actions.append(apply);
    }
    content.append(actions); card.append(content);
    if (row.photo) {
      const figure = el('figure', 'al-photo'), img = el('img'); img.src = row.photo.src; img.alt = row.photo.alt; img.loading = 'lazy'; img.decoding = 'async';
      figure.append(img); const caption = el('figcaption'); caption.append(el('span', 'al-photo-event', row.title)); if (row.photo.caption) caption.append(el('span', '', row.photo.caption)); if (row.photo.sourceLabel) caption.append(el('span', 'al-photo-source', row.photo.sourceLabel)); figure.append(caption); card.append(figure);
    }
    return card;
  }
  function state(type, title, message) {
    data = null; root.replaceChildren(); root.dataset.academyState = type; root.removeAttribute('aria-busy');
    const section = el('section', 'al-state'), h = el('h1', '', title); h.tabIndex = -1;
    section.append(el('p', 'al-eyebrow', 'ARCHIFY / ATÖLYE KİTAPLIĞI'), h, el('p', '', message));
    if (type === 'error' || type === 'empty') { const retry = button('Yeniden dene', 'retry'); retry.dataset.academyRetry = ''; retry.addEventListener('click', () => void load(true)); section.append(retry); }
    section.append(link('Tüm etkinliklere dön', 'etkinlikler.html')); root.append(section);
  }
  function render() {
    root.replaceChildren(); root.dataset.academyState = 'ready'; root.removeAttribute('aria-busy');
    const header = el('header', 'al-header'), copy = el('div', 'al-header-copy');
    const title = el('h1', 'al-title', 'Atölye defterleri'); title.tabIndex = -1;
    copy.append(el('p', 'al-eyebrow', 'ARCHIFY / BİRLİKTE ÜRETİM'), title, el('p', 'al-lead', 'Bağımsız atölyeler ve zirve ya da festival içindeki çalışmalar. Konuya veya etkinliğe göre keşfet.'));
    const nav = el('nav', 'al-header-nav'); nav.setAttribute('aria-label', 'Atölye kitaplığı'); nav.append(link('Çalışmaları keşfet', '#academy-records'), link('Tüm etkinlikler', 'etkinlikler.html')); copy.append(nav); header.append(copy);
    root.append(header);
    const section = el('section', 'al-library'); section.id = 'academy-records'; const heading = el('div', 'al-section-heading');
    heading.append(el('h2', '', 'Bir konu seç, izini sür.')); const refresh = button('Kayıtları yenile', 'refresh', 'al-refresh'); refresh.dataset.academyRefresh = ''; refresh.addEventListener('click', () => void load(true)); heading.append(refresh); section.append(heading);
    section.append(el('p', 'al-section-note', 'Bağımsız atölyeler ve ana etkinlik içindeki çalışmalar. Geçmiş kayıtlar yeni başvuru açmaz.'));
    const form = el('form', 'al-filters'); form.setAttribute('role', 'search'); form.setAttribute('aria-label', 'Atölye ve konu ara'); form.addEventListener('submit', e => { e.preventDefault(); update(); });
    const searchLabel = el('label', 'al-search-label'), search = el('input'); search.type = 'search'; search.maxLength = 120; search.value = query; search.placeholder = 'Örn. eskiz, ahşap, malzeme'; search.dataset.academyQuery = ''; searchLabel.append(el('span', '', 'Konu veya sözcük'), search); form.append(searchLabel);
    const eventLabel = el('label'), eventSelect = el('select'); eventSelect.dataset.academyEvent = ''; const all = el('option', '', 'Tüm etkinlikler'); all.value = ''; eventSelect.append(all);
    for (const row of data.records) { const option = el('option', '', row.title); option.value = row.slug; eventSelect.append(option); }
    if (!data.records.some(row => row.slug === selectedEvent)) selectedEvent = ''; eventSelect.value = selectedEvent; eventLabel.append(el('span', '', 'Etkinlik'), eventSelect); form.append(eventLabel);
    const kindLabel = el('label'), kindSelect = el('select'); kindSelect.dataset.academyKind = '';
    for (const [id, label] of [['', 'Tüm çalışmalar'], ['standalone', 'Bağımsız atölyeler'], ['program', 'Etkinlik içindeki atölyeler']]) { const option = el('option', '', label); option.value = id; kindSelect.append(option); }
    kindSelect.value = kind; kindLabel.append(el('span', '', 'Çalışma türü'), kindSelect); form.append(kindLabel);
    const clear = button('Filtreleri temizle', 'clear', 'al-clear'); clear.addEventListener('click', () => { query = ''; selectedEvent = ''; kind = ''; search.value = ''; eventSelect.value = ''; kindSelect.value = ''; update(); search.focus({ preventScroll: true }); }); form.append(clear); section.append(form);
    const count = el('p', 'al-results'); count.dataset.academyResults = ''; count.setAttribute('role', 'status'); count.setAttribute('aria-live', 'polite'); const list = el('div', 'al-records'); section.append(count, list); root.append(section);
    function update() {
      if (!data || !current()) return;
      const terms = normalize(query).trim().split(/\s+/).filter(Boolean);
      const selected = data.records.filter(row => (!selectedEvent || row.slug === selectedEvent) && (!kind || row.kind === kind) && terms.every(term => normalize([row.title, row.summary, row.city, row.venue, ...row.topics, ...row.subprograms.map(s => s.title)].join(' ')).includes(term)));
      count.textContent = selected.length + ' etkinlik kaydı' + (query.trim() ? ' · “' + query.trim() + '”' : ''); list.replaceChildren();
      if (!selected.length) { list.append(el('p', 'al-no-results', 'Bu seçimde çalışma bulunamadı. Başka bir sözcük deneyebilir veya filtreleri temizleyebilirsin.')); return; }
      for (const [label, test] of [['Gelecek buluşmalar', r => !r.historical && r.period === 'upcoming'], ['Güncel etkinlik kayıtları', r => !r.historical && r.period !== 'upcoming'], ['Bağımsız atölye defterleri', r => r.historical && r.kind === 'standalone'], ['Ana etkinliğin içinde', r => r.historical && r.kind === 'program']]) {
        const rows = selected.filter(test); if (!rows.length) continue;
        const group = el('section', 'al-record-group'); group.append(el('h2', 'al-group-title', label)); for (const row of rows) group.append(record(row, terms)); list.append(group);
      }
    }
    search.addEventListener('input', () => { query = search.value.slice(0, 120); update(); }); eventSelect.addEventListener('change', () => { selectedEvent = eventSelect.value; update(); }); kindSelect.addEventListener('change', () => { kind = kindSelect.value; update(); }); update();
  }
  async function load(focus = false) {
    if (!current()) return; const token = ++generation; state('loading', 'Atölye defteri açılıyor.', 'Yayımlanan çalışmalar yükleniyor.'); root.setAttribute('aria-busy', 'true');
    try { const value = await loadArchive(); if (!current(token)) return; data = academyLibraryData(value); if (data.records.length) render(); else state('empty', 'Yeni çalışmalara yer var.', 'Şu anda yayımlanmış atölye kaydı bulunmuyor. Diğer etkinliklere göz atabilir veya kayıtları yeniden yükleyebilirsin.'); }
    catch { if (current(token)) state('error', 'Kitaplığa kısa bir ara.', 'Güncel atölye kayıtlarına şu anda ulaşılamıyor. Bağlantını kontrol edip yeniden dene.'); }
    if (focus && current(token)) root.querySelector('h1')?.focus({ preventScroll: true });
  }
  function pagehide() { if (!alive) return; generation++; suspended = true; state('loading', 'Atölye kayıtları yenilenecek.', 'Geri döndüğünde güncel çalışmalar yüklenir.'); }
  function pageshow(event) { if (!alive || !(suspended || event.persisted)) return; suspended = false; void load(); }
  function visibility() { if (doc.visibilityState === 'visible' && !suspended) void load(); }
  win.addEventListener('pagehide', pagehide); win.addEventListener('pageshow', pageshow); doc.addEventListener('visibilitychange', visibility);
  const observer = new win.MutationObserver(() => { if (root.parentNode !== host || !host.isConnected) cleanup(); }); observer.observe(doc.documentElement, { childList: true, subtree: true });
  function cleanup() { if (!alive) return; alive = false; generation++; data = null; observer.disconnect(); win.removeEventListener('pagehide', pagehide); win.removeEventListener('pageshow', pageshow); doc.removeEventListener('visibilitychange', visibility); root.remove(); if (doc.title === ownedTitle) doc.title = originalTitle; if (mounts.get(host) === cleanup) mounts.delete(host); }
  mounts.set(host, cleanup); await load(); return cleanup;
}
