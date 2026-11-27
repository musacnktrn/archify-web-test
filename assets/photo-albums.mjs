// [codex] 01a20fe8-62df-78c3-a20e-1c904d040938 · P19 current-public albums, existing images only.
import {archiveGallery} from './archive-photos.mjs';
const mounts = new WeakMap();
const slugOK = value => typeof value === 'string' && value.length <= 100 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
const text = (value, max = 2000) => typeof value === 'string' && value.length <= max && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value) ? value.trim() : '';
const imagePath = value => typeof value === 'string' && value.length <= 1000 && /^(?:assets|media)\/[A-Za-z0-9_./-]+\.(?:webp|png|jpe?g|avif)$/i.test(value) && !value.split('/').some(p => p === '..' || p === '.') ? value : '';
const yearOK = value => Number.isInteger(value) && value >= 1900 && value <= 2200;
const stamp = value => typeof value === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,6})?(?:Z|[+-]\d\d:\d\d)$/.test(value) && Number.isFinite(Date.parse(value)) ? Date.parse(value) : NaN;
const normalize = value => String(value).toLocaleLowerCase('tr-TR').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ı/g, 'i');
const albumURL = slug => 'albumler.html?etkinlik=' + encodeURIComponent(slug);
const eventURL = slug => 'etkinlik.html?slug=' + encodeURIComponent(slug);
function envelope(value) {
  if (!value || typeof value.preview !== 'boolean' || !value.editorial || !value.editorial.events || typeof value.editorial.events !== 'object' || Array.isArray(value.editorial.events)) throw Error('albums_unavailable');
}
function dateLabel(event, edit) {
  const start = stamp(event.startAt), end = stamp(event.endAt);
  if (Number.isFinite(start)) {
    const format = new Intl.DateTimeFormat('tr-TR', {day:'numeric',month:'long',year:'numeric',timeZone:'Europe/Istanbul'});
    const first = format.format(start), last = Number.isFinite(end) && end >= start ? format.format(end) : first;
    return first === last ? first : first + ' – ' + last;
  }
  if (event.archived === true && edit.datePrecision !== 'unknown' && text(edit.dateLabel, 150)) return text(edit.dateLabel, 150);
  return yearOK(event.year) ? String(event.year) : 'Tarih belirtilmemiş';
}
function albumRecord(event, editorial, resolvePhotos) {
  if (!event || !slugOK(event.slug) || !text(event.title, 500) || !['published','closed'].includes(event.status)) return null;
  if (!Array.isArray(event.gallery) || event.gallery.length > 40) throw Error('invalid_album_gallery');
  const edit = Object.hasOwn(editorial.events,event.slug) ? editorial.events[event.slug] || {} : {};
  const allowed = new Set(event.gallery.map(item => imagePath(item?.src)).filter(Boolean));
  const normalized = resolvePhotos(event, edit);
  if (!Array.isArray(normalized) || normalized.length > 40) throw Error('invalid_album_photos');
  const seen = new Set(), photos = [];
  for (const item of normalized) {
    const src = imagePath(item?.src);
    if (!src || !allowed.has(src) || seen.has(src)) continue;
    seen.add(src);
    const width = Number.isInteger(item.width) && item.width > 0 && item.width <= 20000 ? item.width : 1200;
    const height = Number.isInteger(item.height) && item.height > 0 && item.height <= 20000 ? item.height : 800;
    const variants = (Array.isArray(item.variants) ? item.variants.slice(0,8) : []).filter(v => imagePath(v?.src) && Number.isInteger(v.width) && v.width > 0 && v.width <= width).map(v => ({src:v.src,width:v.width}));
    photos.push({src,alt:text(item.alt,1000)||event.title,caption:text(item.caption)||text(item.alt,1000)||event.title,sourceLabel:text(item.sourceLabel,500),thumbnailSrc:imagePath(item.thumbnailSrc)||src,width,height,variants});
  }
  return {slug:event.slug,title:text(event.title,500),city:text(event.city,150),category:text(event.category,100),venue:text(event.venue,300),year:yearOK(event.year)?event.year:null,dateLabel:dateLabel(event,edit),startAt:Number.isFinite(stamp(event.startAt))?stamp(event.startAt):null,photos};
}
/** Publication is the only photo authority; editorial fields only enrich exact current src values. */
export function photoAlbumsData(value, resolvePhotos = archiveGallery) {
  envelope(value);
  if (!Array.isArray(value.events) || value.events.length > 500) throw Error('albums_unavailable');
  const seen = new Set(), albums = [];
  for (const event of value.events) {
    const album = albumRecord(event,value.editorial,resolvePhotos);
    if (!album) continue;
    if (seen.has(album.slug)) throw Error('duplicate_album');
    seen.add(album.slug);if (album.photos.length) albums.push(album);
  }
  albums.sort((a,b) => (b.year||0)-(a.year||0) || (b.startAt||0)-(a.startAt||0) || a.title.localeCompare(b.title,'tr'));
  return {albums,preview:value.preview,bounded:value.events.length===500};
}
export function photoAlbumData(value, slug, resolvePhotos = archiveGallery) {
  envelope(value);
  if (!slugOK(slug)) return null;
  if (value.event === null) return null;
  if (!value.event || value.event.slug !== slug) throw Error('album_mismatch');
  return albumRecord(value.event,value.editorial,resolvePhotos);
}

export async function mountPhotoAlbums({host,loadArchive,loadEvent,resolvePhotos=archiveGallery,openGallery,closeGallery,selectedSlug=null}) {
  if (!host?.ownerDocument || ![loadArchive,loadEvent,resolvePhotos,openGallery,closeGallery].every(fn=>typeof fn==='function')) throw TypeError('albums_mount_invalid');
  mounts.get(host)?.();
  const doc=host.ownerDocument,win=doc.defaultView,originalTitle=doc.title;
  const media=typeof win.matchMedia==='function'?win.matchMedia('(max-width: 700px)'):null;
  const el=(tag,cls='',value)=>{const n=doc.createElement(tag);if(cls)n.className=cls;if(value!==undefined)n.textContent=value;return n;};
  const root=el('article','photo-albums');host.replaceChildren(root);
  let alive=true,suspended=doc.visibilityState==='hidden',epoch=0,busy=false,data=null,ownedTitle='',shown=12;
  let narrow=media?media.matches:win.innerWidth<=700,mobileExpanded=false,setDisclosure=null;
  let filters={query:'',city:'',year:'',category:''};
  const current=token=>alive&&!suspended&&host.isConnected&&root.parentNode===host&&(token===undefined||token===epoch);
  const link=(label,href,cls='pa-link')=>{const a=el('a',cls,label);a.href=href;return a;};
  const button=(label,key,action,cls='pa-button')=>{const b=el('button',cls,label);b.type='button';b.setAttribute('data-albums-'+key,'');b.addEventListener('click',()=>{if(current()&&!busy)void action();});return b;};
  const title=value=>{ownedTitle=value+' · Archify';doc.title=ownedTitle;const h=el('h1','pa-title',value);h.tabIndex=-1;return h;};
  function setState(value){root.dataset.albumsState=value;root.setAttribute('aria-busy',String(busy));}
  function clear(){data=null;setDisclosure=null;closeGallery();root.replaceChildren();}
  function links(){const nav=el('nav','pa-links');nav.setAttribute('aria-label','Albüm bağlantıları');nav.append(link('Tüm albümler','albumler.html'),link('Etkinlik arşivi','arsiv.html'));return nav;}
  function state(kind,heading,message,retry=true){
    clear();setState(kind);const section=el('section','pa-state');section.append(title(heading));
    const p=el('p','pa-lead',message);p.setAttribute('role','status');section.append(p);
    if(retry)section.append(button('Yeniden yükle','retry',()=>load(true)));
    section.append(links());root.append(section);
  }
  function image(photo,{lead=false,thumbnail=false}={}){
    const img=el('img');img.src=thumbnail?photo.thumbnailSrc:photo.src;img.alt=photo.alt;img.width=photo.width;img.height=photo.height;img.decoding='async';img.loading=lead?'eager':'lazy';
    if(lead){img.setAttribute('fetchpriority','high');if(photo.variants.length>1){img.srcset=photo.variants.map(v=>v.src+' '+v.width+'w').join(', ');img.sizes='(max-width: 700px) 100vw, 90vw';}}
    // A failed source never turns into a different event or a stock image.
    img.addEventListener('error',()=>{img.hidden=true;const note=el('p','pa-image-error','Bu fotoğraf şu anda yüklenemiyor.');img.after(note);},{once:true});return img;
  }
  function caption(photo){const c=el('figcaption','pa-caption');c.append(el('span','',photo.caption));if(photo.sourceLabel)c.append(el('span','pa-source',photo.sourceLabel));return c;}
  function facts(album){return [album.dateLabel,album.city,album.category].filter(Boolean).join(' · ');}
  function photoButton(album,index,{lead=false}={}){
    const photo=album.photos[index],b=el('button','pa-photo-open');b.type='button';b.dataset.albumPhoto=String(index);
    b.setAttribute('aria-label',album.title+' · Fotoğraf '+(index+1)+' / '+album.photos.length+': '+photo.alt+', büyüt');
    b.append(image(photo,{lead,thumbnail:!lead}));b.append(el('span','pa-photo-action','Fotoğrafı büyüt'));
    b.addEventListener('click',()=>{if(current()&&!busy)void verifyPhoto(album.slug,photo.src);});return b;
  }
  function renderDetail(album,notice=''){
    clear();data=album;busy=false;setState(album.photos.length?'ready':'empty');
    const header=el('header','pa-detail-header'),main=el('div');main.append(el('p','pa-kicker','Fotoğraf albümü'),title(album.title),el('p','pa-meta',facts(album)));
    const nav=links();nav.append(link('Etkinlik dosyasını aç',eventURL(album.slug)));header.append(main,nav);root.append(header);
    const toolbar=el('div','pa-detail-toolbar');toolbar.append(el('p','pa-photo-count',album.photos.length+' fotoğraf'),button('Güncel albümü yükle','refresh',()=>load(true),'pa-refresh'));root.append(toolbar);
    if(notice){const n=el('p','pa-notice',notice);n.setAttribute('role','status');root.append(n);}
    if(!album.photos.length){const n=el('p','pa-empty','Bu etkinliğin şu anda yayımlanmış fotoğrafı bulunmuyor.');n.setAttribute('role','status');root.append(n);return;}
    const lead=el('figure','pa-lead-photo');lead.append(photoButton(album,0,{lead:true}),caption(album.photos[0]));root.append(lead);
    if(album.photos.length>1){const section=el('section','pa-gallery');section.setAttribute('aria-label','Albüm fotoğrafları');const grid=el('div','pa-photo-grid');section.append(grid);root.append(section);
      const append=(from,to)=>{for(let i=from;i<to;i++){const f=el('figure','pa-photo');f.append(photoButton(album,i),caption(album.photos[i]));grid.append(f);}};
      let end=Math.min(shown,album.photos.length);append(1,end);
      const progress=el('p','pa-progress');progress.setAttribute('role','status');progress.textContent=end+' / '+album.photos.length+' fotoğraf gösteriliyor.';
      const more=button('Diğer fotoğrafları göster','more',()=>{const next=Math.min(end+12,album.photos.length);append(end,next);end=next;shown=next;progress.textContent=end+' / '+album.photos.length+' fotoğraf gösteriliyor.';if(end===album.photos.length){more.disabled=true;more.textContent='Tüm fotoğraflar gösteriliyor';}});
      section.append(progress);if(end<album.photos.length)section.append(more);
    }
  }
  function renderIndex(value){
    clear();data=value;busy=false;setState(value.albums.length?'ready':'empty');
    const header=el('header','pa-index-header'),copy=el('div');copy.append(el('p','pa-kicker','Archify arşivi'),title('Fotoğraf albümleri'),el('p','pa-lead','Etkinliklerin yayımlanmış fotoğraflarını şehir, yıl veya buluşma türüne göre gez.'));
    const aside=el('div','pa-index-aside');aside.append(link('Etkinlik arşivi','arsiv.html'),button('Güncel albümleri yükle','refresh',()=>load(true),'pa-refresh'));header.append(copy,aside);root.append(header);
    if(!value.albums.length){const p=el('p','pa-empty','Şu anda yayımlanmış fotoğraf albümü bulunmuyor.');p.setAttribute('role','status');root.append(p);return;}
    const form=el('form','pa-filters');form.setAttribute('aria-label','Fotoğraf albümlerini süz');form.addEventListener('submit',event=>event.preventDefault());
    const field=(label,control)=>{const wrap=el('label','pa-field');wrap.append(el('span','',label),control);form.append(wrap);return control;};
    const q=el('input');q.type='search';q.maxLength=120;q.autocomplete='off';q.dataset.albumsQuery='';q.value=filters.query;field('Etkinlik ara',q);
    const control=(key,label,choices)=>{const select=el('select');select.setAttribute('data-albums-'+key,'');const all=el('option','','Tümü');all.value='';select.append(all);for(const [val,name] of choices){const option=el('option','',name);option.value=val;select.append(option);}if(!choices.some(([v])=>v===filters[key]))filters[key]='';select.value=filters[key];field(label,select);select.addEventListener('change',()=>{filters[key]=select.value;shown=12;update();});return select;};
    const values=key=>[...new Set(value.albums.map(a=>a[key]).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'tr')).map(v=>[v,v]);
    control('city','Şehir',values('city'));const years=[...new Set(value.albums.map(a=>a.year).filter(v=>v!==null))].sort((a,b)=>b-a).map(v=>[String(v),String(v)]);if(value.albums.some(a=>a.year===null))years.push(['unknown','Yılı belirtilmemiş']);control('year','Yıl',years);control('category','Buluşma türü',values('category'));
    const filterTools=el('section','pa-filter-tools'),disclosure=el('details','pa-filter-disclosure'),summary=el('summary'),activeCount=el('span','pa-filter-count');summary.dataset.albumsFilterToggle='';summary.append(el('span','','Albümleri süz'),activeCount);disclosure.append(summary,form);
    let expectedToggle=null;
    setDisclosure=()=>{const wanted=!narrow||mobileExpanded;if(disclosure.open!==wanted){expectedToggle=wanted;disclosure.open=wanted;}};
    disclosure.addEventListener('toggle',()=>{if(!current())return;if(expectedToggle!==null&&disclosure.open===expectedToggle){expectedToggle=null;return;}expectedToggle=null;if(narrow)mobileExpanded=disclosure.open;else setDisclosure?.();});
    setDisclosure();const clearFilters=button('Filtreleri temizle','clear',reset,'pa-refresh');clearFilters.hidden=true;filterTools.append(disclosure,clearFilters);root.append(filterTools);
    const result=el('p','pa-results');result.dataset.albumsResults='';result.setAttribute('role','status');root.append(result);const grid=el('div','pa-album-grid');root.append(grid);const footer=el('div','pa-index-footer');root.append(footer);
    function reset(){filters={query:'',city:'',year:'',category:''};shown=12;q.value='';form.querySelectorAll('select').forEach(n=>n.value='');update();if(narrow&&!disclosure.open)summary.focus();else q.focus();}
    function update(){
      if(!current())return;const terms=normalize(filters.query).trim().split(/\s+/).filter(Boolean);
      const filtered=value.albums.filter(a=>(!filters.city||a.city===filters.city)&&(!filters.category||a.category===filters.category)&&(!filters.year||(filters.year==='unknown'?a.year===null:String(a.year)===filters.year))&&terms.every(t=>normalize([a.title,a.city,a.category,a.year].join(' ')).includes(t)));
      grid.replaceChildren();footer.replaceChildren();const active=Object.values(filters).filter(Boolean).length;activeCount.textContent=active?active+' etkin filtre':'';clearFilters.hidden=active===0;const slice=filtered.slice(0,shown);result.textContent=filtered.length+' albüm · '+filtered.reduce((n,a)=>n+a.photos.length,0)+' fotoğraf'+(slice.length<filtered.length?' · '+slice.length+' albüm gösteriliyor':'')+(active?' · '+active+' etkin filtre':'');
      for(const album of slice){const card=el('article','pa-album-card');card.dataset.albumSlug=album.slug;const a=link('',albumURL(album.slug),'pa-album-link');a.append(image(album.photos[0],{thumbnail:true}));const body=el('div','pa-album-copy');body.append(el('p','pa-meta',facts(album)),el('h2','',album.title),el('p','pa-card-count',album.photos.length+' fotoğraf'));a.append(body);card.append(a);grid.append(card);}
      if(!filtered.length){const empty=el('div','pa-filter-empty');empty.append(el('h2','','Bu seçimle eşleşen albüm yok.'));grid.append(empty);}
      if(slice.length<filtered.length)footer.append(button('Diğer albümleri göster','more',()=>{const first=shown;shown+=12;update();grid.querySelectorAll('.pa-album-link')[first]?.focus({preventScroll:true});}));
      if(value.bounded)footer.append(el('p','pa-scope','Bu görünüm, servisin döndürdüğü en fazla 500 etkinliğin fotoğraflı albümlerini içerir.'));
    }
    q.addEventListener('input',()=>{filters.query=q.value.slice(0,120).trim();shown=12;update();});update();
  }
  async function load(focus=false){
    if(!current())return;const token=++epoch;busy=true;state('loading','Fotoğraf albümleri','Yayımlanan fotoğraflar yükleniyor.',false);
    if(selectedSlug!==null&&!slugOK(selectedSlug)){busy=false;state('missing','Albüm bulunamadı','Bağlantı geçersiz. Yayımlanan albümlerden devam edebilirsin.',false);return;}
    try{
      if(selectedSlug===null){const value=await loadArchive();if(!current(token))return;renderIndex(photoAlbumsData(value,resolvePhotos));}
      else {const value=await loadEvent(selectedSlug);if(!current(token))return;const album=photoAlbumData(value,selectedSlug,resolvePhotos);if(album)renderDetail(album);else{busy=false;state('missing','Albüm şu anda bulunamıyor','Etkinlik yayımlanmıyor veya bu bağlantıyla eşleşmiyor. Diğer albümlere bakabilirsin.');}}
    }catch{if(current(token)){busy=false;state('error','Albümler yüklenemedi','Güncel yayına ulaşılamıyor. Fotoğrafları yeniden yükleyebilirsin.');}}
    finally{if(current(token)){busy=false;root.setAttribute('aria-busy','false');if(focus)root.querySelector('h1')?.focus({preventScroll:true});}}
  }
  async function verifyPhoto(slug,src){
    if(!current()||busy)return;const token=++epoch;busy=true;state('loading','Fotoğraf kontrol ediliyor','Albümün güncel yayını okunuyor.',false);
    try{const value=await loadEvent(slug);if(!current(token))return;const album=photoAlbumData(value,slug,resolvePhotos);if(!album){busy=false;state('missing','Albüm şu anda bulunamıyor','Bu etkinliğin yayını değişmiş. Diğer albümlere bakabilirsin.');return;}
      const index=album.photos.findIndex(photo=>photo.src===src);shown=Math.max(shown,index+1);renderDetail(album,index<0?'Seçtiğin fotoğraf artık bu albümde yayımlanmıyor.':'');
      if(index>=0&&current(token))openGallery({photos:album.photos,index,trigger:root.querySelector('[data-album-photo="'+index+'"]')});else root.querySelector('h1')?.focus({preventScroll:true});
    }catch{if(current(token)){busy=false;state('error','Fotoğraf açılamadı','Güncel albüm doğrulanamadı. Yeniden yükleyebilirsin.');}}
    finally{if(current(token)){busy=false;root.setAttribute('aria-busy','false');}}
  }
  function retire(){if(!alive)return;epoch++;busy=false;suspended=true;state('loading','Fotoğraf albümleri','Döndüğünde güncel fotoğraflar yeniden yüklenecek.',false);}
  function resume(){if(!alive||doc.visibilityState==='hidden')return;suspended=false;void load();}
  const visibility=()=>doc.visibilityState==='hidden'?retire():resume();
  const pageshow=event=>{if(suspended||event.persisted)resume();};
  const widthChange=()=>{const next=media?media.matches:win.innerWidth<=700;if(next!==narrow){narrow=next;setDisclosure?.();}};
  function cleanup(){if(!alive)return;alive=false;epoch++;clear();observer.disconnect();doc.removeEventListener('visibilitychange',visibility);win.removeEventListener('pagehide',retire);win.removeEventListener('pageshow',pageshow);if(media?.removeEventListener)media.removeEventListener('change',widthChange);else win.removeEventListener('resize',widthChange);root.remove();if(doc.title===ownedTitle)doc.title=originalTitle;if(mounts.get(host)===cleanup)mounts.delete(host);}
  const observer=new win.MutationObserver(()=>{if(!host.isConnected||root.parentNode!==host)cleanup();});observer.observe(doc.documentElement,{childList:true,subtree:true});
  doc.addEventListener('visibilitychange',visibility);win.addEventListener('pagehide',retire);win.addEventListener('pageshow',pageshow);mounts.set(host,cleanup);
  if(media?.addEventListener)media.addEventListener('change',widthChange);else win.addEventListener('resize',widthChange);
  if(suspended)state('loading','Fotoğraf albümleri','Sayfa açıldığında güncel albümler yüklenecek.',false);else await load();
  return cleanup;
}
