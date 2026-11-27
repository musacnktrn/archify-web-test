// [codex] 01a20fe2-64d6-75c3-b882-47be7173d5eb · P38 public, memory-only wayfinding.
const mounted = new WeakMap();
const kinds = ['event', 'series', 'album', 'school', 'video', 'action'];
const plural = {all: 'Tümü', event: 'Etkinlikler', series: 'Seriler', album: 'Albümler', school: 'Üniversiteler', video: 'Videolar', action: 'İşlemler'};
const singular = {event: 'Etkinlik', series: 'Seri', album: 'Albüm', school: 'Üniversite', video: 'Video', action: 'İşlem'};
const states = {ready: 'Yüklendi', partial: 'Kısmen yüklendi', unavailable: 'Şu anda yüklenemedi'};
const whole = value => Number.isSafeInteger(value) && value >= 0;
const string = (value, max, empty = false) => typeof value === 'string' && [...value].length <= max && (empty || value.trim() !== '') && !/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value);
const fail = () => { throw Error('invalid_search_response'); };
const links = {
  event: /^etkinlik\.html\?slug=[a-z0-9]+(?:-[a-z0-9]+)*$/,
  series: /^seri\.html\?seri=[a-z0-9]+(?:-[a-z0-9]+)*$/,
  album: /^albumler\.html\?etkinlik=[a-z0-9]+(?:-[a-z0-9]+)*$/,
  school: /^kampus\.html\?okul=[a-z0-9]+(?:-[a-z0-9]+)*$/,
  video: /^medya\.html\?video=[A-Za-z0-9_-]{11}$/,
  action: /^(?:[a-z0-9]+(?:-[a-z0-9]+)*\.html|kategori\.html\?tur=atolye)$/,
};

function pageDto(value) {
  if (!value || !Array.isArray(value.items) || value.items.length > 12 || value.pageSize !== 12
    || !whole(value.total) || !whole(value.page) || !whole(value.pages) || (value.total > 0 && (value.page < 1 || value.page > value.pages))
    || value.total < value.items.length || !value.counts || !Array.isArray(value.coverage) || value.coverage.length !== kinds.length) fail();
  const counts = {};
  for (const kind of kinds) { if (!whole(value.counts[kind])) fail(); counts[kind] = value.counts[kind]; }
  const coverage = value.coverage.map(row => {
    if (!row || !kinds.includes(row.kind) || !Object.hasOwn(states, row.state) || !whole(row.count)) fail();
    return {kind: row.kind, state: row.state, count: row.count};
  });
  if (new Set(coverage.map(row => row.kind)).size !== kinds.length) fail();
  const items = value.items.map(item => {
    if (!item || !string(item.id, 300) || !kinds.includes(item.kind) || !string(item.title, 1000)
      || !string(item.description, 8000, true) || typeof item.href !== 'string' || !links[item.kind].test(item.href) || !item.meta) fail();
    const meta = {};
    for (const key of ['city', 'category']) {
      const v = item.meta[key]; if (!(v === null || v === undefined || string(v, 500, true))) fail(); meta[key] = v || null;
    }
    const year = item.meta.year;
    if (!(year === null || year === undefined || (Number.isInteger(year) && year >= 1900 && year <= 2200) || string(year, 40, true))) fail();
    meta.year = year === undefined || year === '' ? null : year;
    return {id: item.id, kind: item.kind, title: item.title, description: item.description, href: item.href, meta};
  });
  if (new Set(items.map(item => item.id)).size !== items.length) fail();
  return {items, counts, coverage, total: value.total, page: value.page, pages: value.pages};
}

/** Only readSources() performs I/O; queries never leave this closure or enter a URL. */
export function mountSiteSearch({host, readSources, buildIndex, search}) {
  mounted.get(host)?.();
  const doc = host.ownerDocument, win = doc.defaultView;
  const el = (tag, className, text) => {
    const node = doc.createElement(tag); if (className) node.className = className;
    if (text !== undefined) node.textContent = text; return node;
  };
  const root = el('section', 'site-search'); root.dataset.siteSearch = ''; root.dataset.searchMode = 'initial';
  const header = el('header', 'ss-masthead'), title = el('div');
  title.append(el('h1', 'ss-title', 'Archify’de ara'));
  header.append(title, el('p', 'ss-intro', 'Etkinlik, albüm, üniversite veya yapmak istediğin işlemi bul.'));
  const form = el('form', 'ss-form'); form.dataset.searchForm = ''; form.setAttribute('role', 'search'); form.setAttribute('aria-label', 'Archify içinde ara');
  const label = el('label', 'ss-input-label', 'Ne arıyorsun?'); label.htmlFor = 'site-search-query';
  const box = el('div', 'ss-search-box'), symbol = el('span', 'ss-search-symbol'); symbol.setAttribute('aria-hidden', 'true');
  const input = el('input', 'ss-query'); input.id = 'site-search-query'; input.type = 'search'; input.maxLength = 240;
  input.placeholder = 'Etkinlik, şehir veya üniversite'; input.autocomplete = 'off'; input.spellcheck = false; input.setAttribute('autocapitalize', 'off');
  const submit = el('button', 'ss-submit', 'Ara'); submit.type = 'submit'; box.append(symbol, input, submit);
  const formFoot = el('div', 'ss-form-foot');
  const privacy = el('p', 'ss-privacy', 'Araman bu sayfada kalır; kaydedilmez.'); privacy.id = 'site-search-privacy'; input.setAttribute('aria-describedby', privacy.id);
  const clear = el('button', 'ss-text-button', 'Temizle'); clear.type = 'button'; clear.dataset.searchAction = 'clear';
  formFoot.append(privacy, clear); form.append(label, box, formFoot);
  const layout = el('div', 'ss-layout'), directory = el('aside', 'ss-directory'), filters = el('div', 'ss-kinds');
  directory.append(el('h2', '', 'İçerik türü')); filters.setAttribute('role', 'group'); filters.setAttribute('aria-label', 'İçerik türünü seç'); directory.append(filters);
  const content = el('div', 'ss-content'), headingRow = el('div', 'ss-heading-row'), heading = el('h2', 'ss-results-title', 'Hızlı erişim'); heading.tabIndex = -1;
  const status = el('p', 'ss-status'); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite'); status.setAttribute('aria-atomic', 'true');
  headingRow.append(heading, status);
  const warning = el('p', 'ss-warning'); warning.hidden = true; warning.dataset.searchPartial = '';
  const resultHost = el('div'); resultHost.dataset.searchResults = '';
  const pages = el('nav', 'ss-pagination'); pages.setAttribute('aria-label', 'Arama sonucu sayfaları'); pages.hidden = true;
  const sourceFoot = el('div', 'ss-source-foot'), sourceDetails = el('details'), sourceSummary = el('summary', '', 'Aranabilen içerik'), coverageHost = el('dl', 'ss-coverage'); coverageHost.dataset.searchCoverage = '';
  sourceDetails.append(sourceSummary, coverageHost);
  const refresh = el('button', 'ss-text-button', 'İçeriği yenile'); refresh.type = 'button'; refresh.dataset.searchAction = 'refresh';
  sourceFoot.append(sourceDetails, refresh); content.append(headingRow, warning, resultHost, pages, sourceFoot); layout.append(directory, content); root.append(header, form, layout); host.replaceChildren(root);
  let alive = true, suspended = doc.hidden, generation = 0, loading = false, index = null, query = '', kind = 'all', page = 1, browsing = false, composing = false;
  const current = () => alive && root.parentNode === host;
  const visible = () => current() && !suspended && !doc.hidden;
  const buttons = new Map();
  function button(text, action, run, className = 'ss-page-button') {
    const node = el('button', className, text); node.type = 'button'; node.dataset.searchAction = action;
    node.addEventListener('click', () => { if (visible() && !node.disabled) run(); }); return node;
  }
  for (const value of ['all', ...kinds]) {
    const node = el('button', 'ss-kind'); node.type = 'button'; node.dataset.searchKind = value;
    const count = el('span', 'ss-kind-count', '—'); count.setAttribute('aria-hidden', 'true');
    node.append(el('span', 'ss-kind-name', plural[value]), count);
    node.addEventListener('click', () => {
      if (!visible() || loading || index === null) return;
      kind = value; page = 1; browsing = true; render();
    }); filters.append(node); buttons.set(value, {node, count});
  }
  function controls() {
    refresh.disabled = loading || !visible(); submit.disabled = loading || !visible();
    clear.disabled = !visible() || (!query && kind === 'all' && !browsing);
    for (const [value, item] of buttons) { item.node.disabled = loading || index === null || !visible(); item.node.setAttribute('aria-pressed', String(kind === value)); }
    root.setAttribute('aria-busy', String(loading));
  }
  function resetResults() {
    resultHost.replaceChildren(); pages.replaceChildren(); pages.hidden = true; coverageHost.replaceChildren(); warning.hidden = true; sourceDetails.open = false;
    sourceSummary.textContent = 'Aranabilen içerik';
    for (const [value, item] of buttons) { item.count.textContent = '—'; item.node.setAttribute('aria-label', plural[value]); }
  }
  function notice(title, description, withBrowse = false) {
    const empty = el('div', 'ss-empty'); empty.append(el('h3', '', title), el('p', '', description));
    if (withBrowse) empty.append(button('Tüm içerikleri göster', 'browse', () => { query = ''; input.value = ''; kind = 'all'; browsing = true; page = 1; render(true); }, 'ss-text-button'));
    resultHost.append(empty);
  }
  function render(focus = false) {
    if (!visible() || index === null || loading) { controls(); return; }
    const queryValid = [...query].length <= 120 && !/[\u0000-\u001f\u007f]/.test(query);
    input.setCustomValidity(queryValid ? '' : 'En fazla 120 karakterlik bir arama ifadesi yaz.');
    if (!queryValid) {
      resetResults(); root.dataset.searchState = 'invalid'; status.textContent = 'Arama ifadesini kontrol et.';
      notice('En fazla 120 karakter', 'Daha kısa bir ifade yaz; satır sonu veya kontrol karakteri kullanma.'); controls(); return;
    }
    const initial = !query.trim() && kind === 'all' && !browsing;
    let result;
    try { result = pageDto(search(index, {query, kind: initial ? 'action' : kind, page})); }
    catch { index = null; resetResults(); root.dataset.searchState = 'error'; status.textContent = 'İçerik dizini doğrulanamadı.'; notice('İçerik yeniden yüklenmeli', 'İçeriği yenileyerek tekrar deneyebilirsin.'); controls(); return; }
    page = result.page || 1;
    root.dataset.searchMode = initial ? 'initial' : 'results';
    heading.textContent = initial ? 'Hızlı erişim' : kind === 'all' ? 'Arama sonuçları' : plural[kind];
    const unavailable = result.coverage.filter(row => row.state !== 'ready');
    const selected = initial ? 'action' : kind;
    const selectedUnavailable = selected === 'all' ? result.coverage.every(row => row.state === 'unavailable') : result.coverage.find(row => row.kind === selected)?.state === 'unavailable';
    warning.hidden = unavailable.length === 0;
    warning.textContent = unavailable.length ? 'Bazı içerikler eksik olabilir: ' + unavailable.map(row => plural[row.kind]).join(', ') + '. İçeriği yenileyerek tekrar kontrol edebilirsin.' : '';
    for (const [value, item] of buttons) {
      const count = value === 'all' ? Object.values(result.counts).reduce((sum, n) => sum + n, 0) : result.counts[value];
      item.count.textContent = String(count); item.node.setAttribute('aria-label', plural[value] + ', ' + count + ' sonuç');
    }
    coverageHost.replaceChildren();
    for (const value of kinds) {
      const row = result.coverage.find(c => c.kind === value), entry = el('div');
      entry.append(el('dt', '', plural[value]), el('dd', '', states[row.state] + (row.state === 'unavailable' ? '' : ' · ' + row.count + ' kayıt'))); coverageHost.append(entry);
    }
    sourceSummary.textContent = 'Aranabilen içerik · ' + (unavailable.length ? 'eksik kaynak var' : '6 içerik türü');
    resultHost.replaceChildren(); pages.replaceChildren(); pages.hidden = result.pages <= 1;
    const list = el('ol', 'ss-results'); list.start = (page - 1) * 12 + 1;
    for (const item of result.items) {
      const row = el('li', 'ss-result'); row.dataset.searchResult = item.kind; row.dataset.searchId = item.id;
      const anchor = el('a', 'ss-result-link'); anchor.href = item.href;
      const copy = el('div', 'ss-result-copy'); copy.append(el('span', 'ss-result-kind', singular[item.kind]), el('h3', 'ss-result-title', item.title));
      if (item.description) copy.append(el('p', 'ss-result-description', item.description));
      const meta = el('p', 'ss-result-meta');
      const description = item.description.toLocaleLowerCase('tr');
      const facts = [...new Set([item.meta.city, item.meta.year, item.meta.category].filter(value => value !== null).map(String))];
      for (const value of facts) if (!description.includes(value.toLocaleLowerCase('tr'))) meta.append(el('span', '', value));
      if (meta.childNodes.length) copy.append(meta);
      const arrow = el('span', 'ss-result-arrow', '→'); arrow.setAttribute('aria-hidden', 'true'); anchor.append(copy, arrow); row.append(anchor); list.append(row);
    }
    if (result.items.length) resultHost.append(list);
    else if (selectedUnavailable) notice('Bu içerik şu anda aranamadı', 'Kaynak yüklenemediği için sonuç gösterilemiyor. İçeriği yenileyerek tekrar deneyebilirsin.');
    else notice(unavailable.length ? 'Yüklenen içeriklerde sonuç yok' : 'Sonuç bulunamadı', query.trim() ? 'Daha kısa bir ifade deneyebilir veya içerik türünü değiştirebilirsin.' : 'Bu türde gösterilecek içerik bulunmuyor.', true);
    if (initial && result.items.length) resultHost.append(button('Tüm içerikleri göster', 'browse', () => { browsing = true; page = 1; render(true); }, 'ss-text-button'));
    if (result.pages > 1) {
      const previous = button('← Önceki', 'previous', () => { page--; render(true); }); previous.disabled = page <= 1;
      const next = button('Sonraki →', 'next', () => { page++; render(true); }); next.disabled = page >= result.pages;
      pages.append(previous, el('span', 'ss-page-count', page + ' / ' + result.pages), next);
    }
    root.dataset.searchState = selectedUnavailable ? 'unavailable' : result.total ? 'ready' : 'empty';
    status.textContent = result.total + (initial ? ' işlem bağlantısı' : ' sonuç') + (result.pages > 1 ? ' · Sayfa ' + page + ' / ' + result.pages : '') + (unavailable.length ? ' · Eksik içerik' : '');
    controls(); if (focus) heading.focus({preventScroll: true});
  }
  function updateQuery() { query = input.value; page = 1; render(); }
  input.addEventListener('compositionstart', () => { composing = true; });
  input.addEventListener('compositionend', () => { composing = false; if (visible()) updateQuery(); });
  input.addEventListener('input', () => { if (visible() && !composing) updateQuery(); });
  form.addEventListener('submit', event => { event.preventDefault(); event.stopPropagation(); if (visible()) { query = input.value; page = 1; render(true); } });
  function clearQuery() { if (!visible()) return; query = ''; input.value = ''; input.setCustomValidity(''); kind = 'all'; page = 1; browsing = false; composing = false; render(); input.focus({preventScroll: true}); }
  clear.addEventListener('click', clearQuery);
  input.addEventListener('keydown', event => { if (event.key === 'Escape' && !event.isComposing) { event.preventDefault(); clearQuery(); } });
  refresh.addEventListener('click', () => { if (visible() && !refresh.disabled) void load(true); });
  async function load(focus = false) {
    if (!visible()) return;
    const turn = ++generation; index = null; loading = true; resetResults(); root.dataset.searchState = 'loading'; status.textContent = 'İçerik hazırlanıyor…'; controls();
    try {
      const sources = await readSources();
      if (!visible() || turn !== generation) return;
      index = buildIndex(sources); loading = false; render(focus);
    } catch {
      if (!visible() || turn !== generation) return;
      index = null; loading = false; resetResults(); root.dataset.searchState = 'error'; status.textContent = 'İçerik yüklenemedi.';
      notice('Şu anda arama yapılamıyor', 'İçeriği yenileyerek tekrar deneyebilirsin.'); controls();
    }
  }
  function hide() { if (!current()) return; suspended = true; generation++; index = null; loading = false; resetResults(); root.dataset.searchState = 'hidden'; status.textContent = 'Döndüğünde içerik yeniden kontrol edilecek.'; controls(); }
  function show() { if (!current() || doc.hidden) return; suspended = false; void load(); }
  const visibility = () => doc.hidden ? hide() : suspended && show();
  const pageShow = event => { if (event.persisted || suspended) show(); };
  doc.addEventListener('visibilitychange', visibility); win.addEventListener('pagehide', hide); win.addEventListener('pageshow', pageShow);
  function dispose() {
    if (!alive) return; alive = false; generation++; index = null; query = ''; input.value = '';
    doc.removeEventListener('visibilitychange', visibility); win.removeEventListener('pagehide', hide); win.removeEventListener('pageshow', pageShow);
    root.remove(); if (mounted.get(host) === dispose) mounted.delete(host);
  }
  mounted.set(host, dispose);
  if (suspended) hide(); else void load();
  return dispose;
}
