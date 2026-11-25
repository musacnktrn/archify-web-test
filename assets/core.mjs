// [codex] 01a20fe8-199e-7631-8910-07e7d27b753d · public visitor implementation
// [codex] UX revision · 01a20fe8-62df-78c3-a20e-1c904d040938 · archify-web-ozgun-ux-01a20fd9

export const CATEGORIES = ['Zirve', 'Festival', 'Buluşma', 'Sempozyum', 'Atölye', 'Teknik gezi', 'Yurt dışı tur'];
export function normalizeSearch(value = '') {
  return String(value).toLocaleLowerCase('tr-TR').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ı/g, 'i').trim();
}
export function filterEvents(events, { q = '', category = '', year = '', city = '' } = {}) {
  const terms = normalizeSearch(q).split(/\s+/).filter(Boolean);
  return events.filter(event => (!category || event.category === category) && (!year || String(event.year) === year) && (!city || event.city === city) && terms.every(term => normalizeSearch([event.title, event.city, event.category, event.summary, event.year].join(' ')).includes(term)));
}
export function escapeHTML(value = '') {
  return String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[char]));
}
export function safeURL(value, { image = false } = {}) {
  if (typeof value !== 'string' || /[\u0000-\u0020\\]/.test(value)) return '';
  if (image && /^(?:assets|media)\/[a-zA-Z0-9_./-]+$/.test(value) && !value.split('/').includes('..')) return value;
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? url.href : ''; } catch { return ''; }
}
export function normalizePhone(value) {
  const raw = String(value).trim();
  if (!/^[+0-9() .-]+$/.test(raw)) return null;
  const compact = raw.replace(/[() .-]/g, '');
  if (compact.startsWith('+') || compact.startsWith('00')) {
    const international = compact.startsWith('00') ? '+' + compact.slice(2) : compact;
    if (!/^\+[1-9]\d{7,14}$/.test(international)) return null;
    // Turkish numbers keep the existing GSM rule even with an explicit country code.
    if (international.startsWith('+90') && !/^\+905\d{9}$/.test(international)) return null;
    return international;
  }
  if (/^05\d{9}$/.test(compact)) return '+9' + compact;
  if (/^5\d{9}$/.test(compact)) return '+90' + compact;
  if (/^905\d{9}$/.test(compact)) return '+' + compact;
  return null;
}
export function registrationState(event, now = Date.now()) {
  if (!event) return { open: false, label: 'Etkinlik bulunamadı', detail: 'Bağlantıyı kontrol edebilir veya etkinliklere dönebilirsin.' };
  if (event.status === 'cancelled') return { open: false, label: 'Etkinlik iptal edildi', detail: 'Bu etkinlik için başvuru alınmıyor.' };
  if (event.archived || (event.endAt && Date.parse(event.endAt) < now)) return { open: false, label: 'Arşivden bir buluşma', detail: 'Bu etkinlik sona erdi. Yeni buluşmalar için topluluğu takip edebilirsin.' };
  if (event.status !== 'published' || event.registrationOpen !== true) return { open: false, label: 'Başvuru kapalı', detail: 'Bu etkinlik şu anda başvuru almıyor.' };
  if (!event.startAt || !Number.isFinite(Date.parse(event.startAt))) return { open: false, label: 'Tarih duyurulacak', detail: 'Etkinlik tarihi netleştiğinde başvuru durumu burada gösterilecek.' };
  if ((!event.endAt && Date.parse(event.startAt) < now) || (event.endAt && !Number.isFinite(Date.parse(event.endAt)))) return { open: false, label: 'Başvuru kapalı', detail: 'Bu etkinlik şu anda başvuru almıyor.' };
  return { open: true, label: 'Başvuru açık', detail: 'Başvurunu tamamla; son durum ve kapasite kayıt sırasında kontrol edilir.' };
}
export function archiveEvent(event) {
  return { ...event, archived: true, status: 'closed', registrationOpen: false, startAt: null, endAt: null, venue: null, capacity: null };
}
export function mergeEvents(archive, live) {
  const merged = new Map(archive.map(event => [event.slug, archiveEvent(event)]));
  for (const event of live) if (event && typeof event.slug === 'string' && event.status !== 'draft') merged.set(event.slug, event);
  return [...merged.values()];
}
export function apiURL(route, base) {
  const url = new URL('api/index.php', base); url.searchParams.set('r', route); return url;
}
export function errorMessage(code) {
  const messages = {
    event_full: 'Bu etkinliğin kontenjanı doldu. Yeni buluşmalar için topluluğu takip edebilirsin.', capacity_full: 'Bu etkinliğin kontenjanı doldu.',
    registration_closed: 'Etkinliğin başvurusu kapanmış. Etkinlik sayfasındaki güncel durumu kontrol et.', event_closed: 'Bu etkinlik şu anda başvuru almıyor.',
    event_archived: 'Bu etkinlik arşivde; başvuru alınmıyor.', event_cancelled: 'Bu etkinlik iptal edildi. Başvurun alınmadı.',
    not_found: 'Etkinlik bulunamadı. Etkinlik listesine dönerek bağlantıyı yenileyebilirsin.', invalid_group_id:'Topluluk seçimi geçersiz. Topluluk listesinden yeniden seçebilirsin.', event_not_found: 'Etkinlik bulunamadı.',
    invalid_phone: 'Türkiye cep telefonunu 05xx xxx xx xx biçiminde; yabancı numaranı + veya 00 ile başlayan ülke koduyla yaz.', invalid_email: 'Geçerli bir e posta adresi yaz.',
    invalid_input: 'Bilgilerini ve zorunlu alanları kontrol et.', validation_failed: 'Bilgilerini ve zorunlu alanları kontrol et.',
    terms_required: 'Başvuru ve gizlilik açıklamasını okuyup zorunlu onay alanını işaretle.', invalid_name: 'Adını ve soyadını kontrol et.',
    invalid_department: 'İlgilendiğin alanı seç.', invalid_motivation: 'Kendini kısaca anlatan metni kontrol et.',
    rate_limited: 'Kısa sürede çok fazla deneme yapıldı. Biraz bekleyip aynı başvuruyu tekrar deneyebilirsin.',
    csrf_invalid: 'Oturum doğrulaması yenilenmeli. Sayfayı yenilemeden aşağıdaki düğmeyle tekrar dene.', invalid_csrf: 'Oturum doğrulaması yenilenmeli. Tekrar dene.',
    request_verification: 'Oturum doğrulanamadı. Aynı başvuruyu tekrar deneyebilirsin.',
    already_applied: 'Bu telefon için daha önce başvuru alınmış.', duplicate_application: 'Bu telefon için daha önce başvuru alınmış.',
    idempotency_conflict: 'Bu başvuru denemesi farklı bilgilerle eşleşiyor. Yeni kayıt oluşturmadan Archify ile iletişime geç.',
    request_conflict: 'Bu başvuru denemesi farklı bilgilerle eşleşiyor. Archify ile iletişime geç.',
    network: 'Yanıtı alamadık. Başvurunun kaydedilip kaydedilmediği henüz belli değil. Aynı bilgilerle güvenle tekrar deneyebilirsin.',
    service_unavailable: 'Başvuru bağlantısı şu an kullanılamıyor. Biraz sonra tekrar deneyebilirsin.'
  };
  return messages[code] || 'İşlem tamamlanamadı. Bilgilerini kontrol edip aynı başvuruyu tekrar deneyebilirsin.';
}

// Archive grouping leaves unknown dates explicit; source metadata never grants registration.
export function groupEventsByYear(events) {
  const groups=new Map();
  for(const event of events){const year=Number.isInteger(event.year)?event.year:null;if(!groups.has(year))groups.set(year,[]);groups.get(year).push(event);}
  return [...groups].sort(([a],[b])=>(b??0)-(a??0)).map(([year,items])=>({year,label:year?String(year):'Tarihi belirsiz',events:items}));
}
export function sourceMarkup(source,prefix='') {
  if(!source||typeof source.title!=='string'||!source.title.trim())return '';
  const label=escapeHTML(prefix+source.title),url=safeURL(source.url);
  return url?`<a class="source-link" href="${escapeHTML(url)}" target="_blank" rel="noopener noreferrer">${label}</a>`:`<span class="source-link ux-source-text">${label}</span>`;
}
