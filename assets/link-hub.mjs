// [codex] 01a20fe8-199e-7631-8910-07e7d27b753d · P42 public publication and shared, inert editor preview.
const THEMES = new Set(['paper', 'ink', 'clay']);
const COVERS = new Set(['model', 'print', 'none']);
const ICONS = new Set(['calendar', 'community', 'video', 'archive', 'career', 'studio', 'partner', 'contact', 'instagram', 'link']);
const ROUTES = new Set('index etkinlikler topluluk medya arsiv kariyer ekibe-katil is-birligi iletisim hakkimizda gizlilik kaynaklar baglantilar albumler arama kampus mesleki-ag kariyer-basvuru firma-basvuru ilanlar seri kategori etkinlik basvuru grup-basvuru'.split(' ').map(name => name + '.html'));
const SLUG = /^[a-z0-9-]{1,100}$/;
const QUERY = {
  'etkinlik.html': ['slug', SLUG], 'basvuru.html': ['slug', SLUG],
  'grup-basvuru.html': ['grup', /^[a-z][a-z0-9-]{0,79}$/],
  'kategori.html': ['tur', /^(zirve|festival|yurt-disi-tur|sempozyum|atolye|sosyal)$/],
  'seri.html': ['seri', SLUG], 'albumler.html': ['etkinlik', SLUG],
  'medya.html': ['video', /^[A-Za-z0-9_-]{11}$/], 'ilanlar.html': ['ilan', /^[a-f0-9]{32}$/]
};
const PRIVATE_PATH = /(?:^|\/)(?:ekip|admin|api|app|platform|member|members|account|accounts|login|logout|recovery|reset|invite|invites|joinchat|private)(?:\/|$|\.)/i;
const PRIVATE_PAGE = /\/(?:hesabim|uye-ol|hesap-kurtarma|eposta-dogrulama|mesleki-kartim|firma-paneli|firma-adaylari|sponsor-paneli|ilan-basvurusu|topluluk-basvurularim|egitim-ilgilerim|etkinlik-gecmisim|bilet|odeme)\.html$/i;
const INVITE_HOSTS = ['localhost', 'local', 'internal', 'test', 'invalid', 'wa.me', 'whatsapp.com', 't.me', 'telegram.me', 'telegram.org'];
const renderers = new WeakMap(), mounts = new WeakMap();
const own = (value, key) => value && typeof value === 'object' ? Object.getOwnPropertyDescriptor(value, key)?.value : undefined;
const text = (value, max, required = false) => typeof value === 'string' && [...value].length <= max && !/[\u0000-\u001f\u007f]/.test(value) && (!required || value.trim()) ? value.trim() : null;

/** No arbitrary query, fragment, private account, bearer or direct invitation targets. */
export function linkHubURL(value, origin = null) {
  if (typeof value !== 'string' || !value || value.length > 500 || /[\s\\\u0000-\u001f\u007f#%<>]/.test(value) || value.includes('..')) return null;
  if (!value.startsWith('https://')) {
    const relative = value.startsWith('./') ? value.slice(2) : value;
    const [path, query, extra] = relative.split('?');
    if (!ROUTES.has(path) || extra !== undefined) return null;
    if (query === undefined) return path;
    const rule = QUERY[path], parts = [...new URLSearchParams(query)];
    if (!rule || parts.length !== 1 || parts[0][0] !== rule[0] || !rule[1].test(parts[0][1])) return null;
    const canonical = new URLSearchParams(parts).toString();
    return query === canonical ? path + '?' + canonical : null;
  }
  try {
    const url = new URL(value), host = url.hostname.toLowerCase();
    if (url.protocol !== 'https:' || url.username || url.password || url.port || url.hash || host.length > 253 || !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(host)) return null;
    if (INVITE_HOSTS.some(blocked => host === blocked || host.endsWith('.' + blocked))) return null;
    const ownHosts = new Set(['archify.com.tr']);
    try { if (origin) ownHosts.add(new URL(origin).hostname.toLowerCase().replace(/^www\./, '')); } catch {}
    if (ownHosts.has(host.replace(/^www\./, ''))) {
      return linkHubURL(url.pathname.replace(/^\/+/, '') + url.search) ? url.href : null;
    }
    if (PRIVATE_PATH.test(url.pathname) || PRIVATE_PAGE.test(url.pathname)) return null;
    if (value.includes('?') && !url.search) return null;
    if (url.search) {
      const pairs = [...url.searchParams], seen = new Set();
      const limits = {id: 80, page: 6, slug: 100, v: 11, utm_source: 40, utm_medium: 40, utm_campaign: 80, utm_content: 80, utm_term: 80};
      if (pairs.length > 9 || url.search.slice(1).split('&').length !== pairs.length) return null;
      for (const [key, content] of pairs) {
        if (!Object.hasOwn(limits, key) || seen.has(key) || content.length > limits[key] || !/^[A-Za-z0-9_-]+$/.test(content) || /[0-9]{7}/.test(content)) return null;
        if (key === 'page' && !/^[1-9][0-9]{0,5}$/.test(content)) return null;
        if (key === 'v' && (!['youtube.com', 'www.youtube.com'].includes(host) || url.pathname !== '/watch' || content.length !== 11)) return null;
        seen.add(key);
      }
    }
    return url.href;
  } catch { return null; }
}

export function normalizeLinkHub(value, {origin = null} = {}) {
  const title = text(own(value, 'title'), 64, true), bio = text(own(value, 'bio'), 180);
  const theme = own(value, 'theme'), cover = own(value, 'cover'), layout = own(value, 'layout'), links = own(value, 'links');
  if (!title || bio === null || !THEMES.has(theme) || !COVERS.has(cover) || !['cards', 'compact'].includes(layout) || !Array.isArray(links) || links.length > 30) throw Error('link_hub_unavailable');
  const seen = new Set(), safe = [];
  for (const item of links) {
    if (own(item, 'visible') !== true) continue;
    const id = own(item, 'id'), label = text(own(item, 'label'), 72, true), description = text(own(item, 'description'), 140), section = text(own(item, 'section'), 40), icon = own(item, 'icon');
    const url = linkHubURL(own(item, 'url'), origin);
    if (typeof id !== 'string' || !/^[a-z][a-z0-9-]{0,39}$/.test(id) || seen.has(id) || !label || description === null || section === null || !ICONS.has(icon) || !url) continue;
    seen.add(id); safe.push({id, label, description, section, icon, url, visible: true});
  }
  const featuredId = safe.some(item => item.id === own(value, 'featuredId')) ? own(value, 'featuredId') : null;
  return {title, bio, theme, cover, layout, featuredId, links: safe};
}

const PATHS = {
  calendar: ['M5 5h22v23H5z', 'M5 12h22M10 3v5M22 3v5M10 17h4M18 17h4M10 22h4'],
  community: ['M12 9a4 4 0 1 0 8 0 4 4 0 0 0-8 0', 'M7 27v-3a9 9 0 0 1 18 0v3M4 11a3 3 0 0 0 0 6M28 11a3 3 0 0 1 0 6'],
  video: ['M3 6h26v20H3z', 'm13 11 8 5-8 5z'],
  archive: ['M5 9h22v19H5zM3 4h26v5H3z', 'M12 15h8M16 15v7'],
  career: ['M4 11h24v16H4z', 'M11 11V5h10v6M4 18h24M14 16v4h4v-4'],
  studio: ['M4 4h24v24H4z', 'M4 14h13V4M17 14v14M23 14h5M4 22h6'],
  partner: ['m3 12 7-7 7 7-7 7z', 'm15 20 7-7 7 7-7 7zM10 19l5 5M17 8l5 5'],
  contact: ['M3 7h26v19H3z', 'm3 7 13 11L29 7M3 26l9-10M29 26l-9-10'],
  instagram: ['M9 3h14a6 6 0 0 1 6 6v14a6 6 0 0 1-6 6H9a6 6 0 0 1-6-6V9a6 6 0 0 1 6-6z', 'M10 16a6 6 0 1 0 12 0 6 6 0 0 0-12 0M23 8h.01'],
  link: ['m13 8 3-3a7 7 0 0 1 10 10l-4 4M19 24l-3 3A7 7 0 0 1 6 17l4-4', 'm11 21 10-10'],
  arrow: ['M7 25 25 7M7 7h18v18'],
  share: ['M16 21V3m-6 6 6-6 6 6M7 14H4v15h24V14h-3'],
  copy: ['M11 3h18v20H11zM6 9H3v20h18v-3']
};
function svg(document, name) {
  const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  icon.setAttribute('viewBox', '0 0 32 32'); icon.setAttribute('fill', 'none'); icon.setAttribute('aria-hidden', 'true'); icon.setAttribute('focusable', 'false');
  for (const d of PATHS[name] || PATHS.link) {
    const path = document.createElementNS(icon.namespaceURI, 'path'); path.setAttribute('d', d); icon.append(path);
  }
  return icon;
}
function element(document, tag, className, content) {
  const node = document.createElement(tag); if (className) node.className = className; if (content !== undefined) node.textContent = content; return node;
}
export function cleanLinkHubURL(location) {
  try {
    const current = new URL(location.href);
    if (!['https:', 'http:'].includes(current.protocol)) return null;
    current.username = ''; current.password = '';
    return new URL('baglantilar.html', current).href;
  } catch { return null; }
}

/** Same presentation in the public page and staff shadow DOM. Inert preview performs no navigation or sharing. */
export function renderLinkHub(host, value, {interactive = true, assetBase = './'} = {}) {
  const page = normalizeLinkHub(value, {origin: host.ownerDocument.defaultView?.location.origin}); renderers.get(host)?.();
  const document = host.ownerDocument, window = document.defaultView, el = (tag, cls, content) => element(document, tag, cls, content);
  const prefix = assetBase === '../' ? '../' : './'; let alive = true;
  const root = el('section', 'bio-hub'); root.dataset.theme = page.theme; root.dataset.cover = page.cover; root.dataset.layout = page.layout; root.dataset.hubState = page.links.length ? 'ready' : 'empty';
  const frame = el('div', 'bio-frame'); root.append(frame);
  const profile = el('header', 'bio-profile');
  if (page.cover !== 'none') {
    const figure = el('figure', 'bio-cover bio-cover--' + page.cover);
    if (page.cover === 'model') {
      const img = el('img'); img.src = prefix + 'assets/images/ux/acik-kesit-800.webp'; img.srcset = prefix + 'assets/images/ux/acik-kesit-800.webp 800w, ' + prefix + 'assets/images/ux/acik-kesit-1600.webp 1536w';
      img.sizes = '(max-width: 700px) calc(100vw - 36px), 360px'; img.width = 1536; img.height = 1024; img.alt = 'Açık Kesit: Archify için üretilmiş kavramsal mimari maket.'; img.decoding = 'async'; figure.append(img);
      figure.append(el('figcaption', 'bio-cover-caption', 'Açık Kesit · kavramsal maket'));
    } else {
      figure.setAttribute('aria-hidden', 'true'); const mark = el('img', 'bio-cover-mark'); mark.src = prefix + 'assets/archify.svg'; mark.alt = ''; mark.width = 651; mark.height = 150; figure.append(mark, el('span', 'bio-print-line'), el('span', 'bio-print-circle'));
    }
    profile.append(figure);
  }
  const identity = el('div', 'bio-identity'); identity.append(el('p', 'bio-eyebrow', 'Bağlantılar'));
  const title = el('h1', 'bio-title', page.title); title.tabIndex = -1; identity.append(title);
  if (page.bio) identity.append(el('p', 'bio-description', page.bio)); profile.append(identity);
  const tools = el('div', 'bio-tools'), feedback = el('p', 'bio-share-status'); feedback.setAttribute('role', 'status'); feedback.setAttribute('aria-live', 'polite'); feedback.dataset.hubShareStatus = '';
  const makeButton = (label, icon, key) => { const button = el('button', 'bio-tool'); button.type = 'button'; button.dataset[key] = ''; button.append(svg(document, icon), el('span', '', label)); if (!interactive) button.disabled = true; tools.append(button); return button; };
  const share = makeButton('Paylaş', 'share', 'hubShare'), copy = makeButton('Bağlantıyı kopyala', 'copy', 'hubCopy');
  const manual = el('div', 'bio-manual-copy'); manual.hidden = true;
  const inputLabel = el('label', '', 'Sayfa bağlantısı'), input = el('input'); input.readOnly = true; input.setAttribute('aria-label', 'Kopyalanacak sayfa bağlantısı'); inputLabel.append(input); manual.append(inputLabel);
  profile.append(tools, feedback, manual); frame.append(profile);
  const content = el('div', 'bio-content'); frame.append(content);
  function card(item, featured = false) {
    const link = el('a', 'bio-link' + (featured ? ' bio-featured' : '')); link.dataset.hubLink = item.id;
    if (featured) link.dataset.hubFeatured = '';
    if (interactive) link.href = item.url; else { link.setAttribute('aria-disabled', 'true'); link.tabIndex = -1; }
    const external = item.url.startsWith('https://'); if (interactive && external) { link.target = '_blank'; link.rel = 'noopener noreferrer'; }
    const icon = el('span', 'bio-link-icon'); icon.append(svg(document, item.icon)); const body = el('span', 'bio-link-body');
    body.append(el('span', 'bio-link-label', item.label)); if (item.description) body.append(el('span', 'bio-link-description', item.description));
    const arrow = el('span', 'bio-link-arrow'); arrow.append(svg(document, 'arrow'));
    link.append(icon, body, arrow); if (external) link.append(el('span', 'bio-sr', ' (yeni sekmede açılır)'));
    return link;
  }
  const featured = page.links.find(item => item.id === page.featuredId);
  if (featured) content.append(card(featured, true));
  let group = null, lastSection = null;
  for (const item of page.links.filter(item => item !== featured)) {
    if (!group || lastSection !== item.section) {
      const section = el('section', 'bio-section'); if (item.section) section.append(el('h2', 'bio-section-title', item.section));
      group = el('div', 'bio-link-list'); section.append(group); content.append(section); lastSection = item.section;
    }
    group.append(card(item));
  }
  if (!page.links.length) { const empty = el('div', 'bio-empty'); empty.append(el('h2', '', 'Bağlantılar burada yer alacak.'), el('p', '', 'Şu anda yayımlanmış bağlantı bulunmuyor.')); empty.setAttribute('role', 'status'); content.append(empty); }
  host.replaceChildren(root);
  const url = cleanLinkHubURL(window?.location);
  async function copyURL() {
    if (!alive || !interactive || !url) return;
    try {
      if (!window.navigator.clipboard?.writeText) throw Error('clipboard_unavailable');
      await window.navigator.clipboard.writeText(url); if (alive) feedback.textContent = 'Bağlantı kopyalandı.';
    } catch {
      if (!alive) return; input.value = url; manual.hidden = false; feedback.textContent = 'Adresi seçip cihazının kopyalama komutunu kullanabilirsin.'; input.focus(); input.select();
    }
  }
  async function shareURL() {
    if (!alive || !interactive || !url) return;
    if (!window.navigator.share) { await copyURL(); return; }
    try { await window.navigator.share({title: page.title, url}); if (alive) feedback.textContent = 'Paylaşım penceresi kapatıldı.'; }
    catch (error) { if (alive && error?.name !== 'AbortError') await copyURL(); }
  }
  if (interactive && url) { copy.addEventListener('click', copyURL); share.addEventListener('click', shareURL); }
  else { copy.disabled = true; share.disabled = true; }
  const dispose = () => { alive = false; copy.removeEventListener('click', copyURL); share.removeEventListener('click', shareURL); if (renderers.get(host) === dispose) renderers.delete(host); };
  renderers.set(host, dispose); return {root, dispose};
}

/** The live GET is the only authority. Failed reads never fall back to a prior or bundled publication. */
export function mountLinkHub({host, loadPage, preview = false}) {
  mounts.get(host)?.();
  const document = host.ownerDocument, window = document.defaultView; let alive = true, generation = 0, controller = null, rendered = null;
  const current = stamp => alive && stamp === generation && host.isConnected;
  function state(kind) {
    rendered?.dispose(); rendered = null;
    const root = element(document, 'section', 'bio-hub bio-state'); root.dataset.hubState = kind;
    const title = element(document, 'h1', 'bio-title', 'Archify bağlantıları'); title.tabIndex = -1;
    const status = element(document, 'p', 'bio-description', kind === 'error' ? 'Bağlantılar şu anda yüklenemiyor. Yeniden deneyebilirsin.' : 'Güncel bağlantılar yükleniyor.'); status.setAttribute('role', 'status');
    root.append(element(document, 'p', 'bio-eyebrow', 'Bağlantılar'), title, status);
    if (kind === 'error') { const retry = element(document, 'button', 'bio-retry', 'Yeniden dene'); retry.type = 'button'; retry.dataset.hubRetry = ''; retry.addEventListener('click', () => void refresh(true)); root.append(retry); }
    root.setAttribute('aria-busy', String(kind === 'loading')); host.replaceChildren(root);
  }
  async function refresh(focus = false) {
    if (!alive) return; const stamp = ++generation; controller?.abort(); controller = new window.AbortController(); state('loading');
    try {
      const response = await loadPage(controller.signal); if (!current(stamp)) return;
      const value = preview ? response : own(response, 'page');
      if (!preview && (!Number.isInteger(own(response, 'revision')) || own(response, 'revision') < 0)) throw Error('invalid_publication');
      rendered = renderLinkHub(host, value);
    } catch { if (current(stamp)) state('error'); }
    if (focus && current(stamp)) host.querySelector('h1')?.focus({preventScroll: true});
  }
  function suspend() { generation++; controller?.abort(); state('loading'); }
  const visibility = () => { if (document.hidden) suspend(); else void refresh(); };
  const show = event => { if (event.persisted) void refresh(); };
  document.addEventListener('visibilitychange', visibility); window.addEventListener('pagehide', suspend); window.addEventListener('pageshow', show);
  const dispose = () => { if (!alive) return; alive = false; generation++; controller?.abort(); rendered?.dispose(); document.removeEventListener('visibilitychange', visibility); window.removeEventListener('pagehide', suspend); window.removeEventListener('pageshow', show); host.replaceChildren(); if (mounts.get(host) === dispose) mounts.delete(host); };
  mounts.set(host, dispose); void refresh(); return {refresh, dispose};
}

export function bootLinkHub(document, window) {
  const host = document.querySelector('#link-hub');
  if (!host || document.body?.dataset.page !== 'links' || !/\/baglantilar\.html$/.test(window.location.pathname)) return null;
  const preview = document.querySelector('meta[name="deployment"]')?.content !== 'server';
  const base = new URL('./', window.location.href);
  return mountLinkHub({host, preview, loadPage: async signal => {
    const url = new URL(preview ? 'data/link-hub.json' : 'api/index.php', base); if (!preview) url.searchParams.set('r', 'link-hub');
    const controller = new window.AbortController(), timeout = window.setTimeout(() => controller.abort(), 12000);
    const abort = () => controller.abort(); signal.addEventListener('abort', abort, {once: true});
    try {
      if (signal.aborted) throw Error('aborted');
      const response = await window.fetch(url, {credentials: 'same-origin', cache: 'no-store', signal: controller.signal});
      if (!response.ok) throw Error('link_hub_unavailable'); return await response.json();
    } finally { window.clearTimeout(timeout); signal.removeEventListener('abort', abort); }
  }});
}
if (typeof document !== 'undefined' && typeof window !== 'undefined') bootLinkHub(document, window);
