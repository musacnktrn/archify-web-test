// [codex] 01a20fe8-199e-7631-8910-07e7d27b753d · P11 current-public travel archive, never a booking authority.
const mounts=new WeakMap();
const GROUPS=Object.freeze({europe:{title:'Büyük Avrupa Turu',slugs:['buyuk-avrupa-turu-2024','buyuk-avrupa-turu-2025','buyuk-avrupa-turu-2026']},'italy-spain':{title:'İtalya ve İspanya',slugs:['italya-ispanya-turu-2025','italya-ispanya-turu-2026']},other:{title:'Diğer tur kayıtları',slugs:[]}});
const PARIS_IMAGE='assets/images/archive-r11/buyuk-avrupa-turu-2025-paris-eyfel-1600.webp';
const text=(value,max=4000)=>typeof value==='string'&&value.length<=max&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)?value.trim():'';
const slugOK=value=>typeof value==='string'&&value.length<=160&&/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
const validYear=value=>Number.isInteger(value)&&value>=1900&&value<=2200;
const date=value=>typeof value==='string'&&/(?:Z|[+-]\d{2}:\d{2})$/.test(value)&&Number.isFinite(Date.parse(value))?Date.parse(value):NaN;
const imageURL=value=>typeof value==='string'&&value.length<=1500&&/^(?:assets|media)\/[A-Za-z0-9_./-]+\.(?:webp|png|jpe?g|avif)$/i.test(value)&&!value.split('/').includes('..')?value:'';
const sourceURL=value=>{try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password?u.href:'';}catch{return '';}};
const href=slug=>'etkinlik.html?slug='+encodeURIComponent(slug);
const family=slug=>Object.entries(GROUPS).find(([,value])=>value.slugs.includes(slug))?.[0]||'other';
function photo(event,edit){
 for(const item of Array.isArray(event.gallery)?event.gallery:[]){
  const src=imageURL(item?.src);if(!src)continue;
  const meta=(Array.isArray(edit.photoMetadata)?edit.photoMetadata:[]).find(m=>m?.src===src)||{};
  return {src,thumbnail:imageURL(meta.thumbnailSrc)||src,alt:text(item.alt,1000)||event.title,caption:text(meta.caption,2000)||text(item.alt,1000)||event.title,sourceLabel:text(meta.sourceLabel,1000)};
 }
 return null;
}
function dateLabel(event,edit,historical){
 if(historical&&edit.datePrecision==='year')return validYear(event.year)?String(event.year):/^\d{4}$/.test(edit.dateLabel||'')?edit.dateLabel:'Yıl bilgisi bulunmuyor';
 if(historical&&text(edit.dateLabel,150))return text(edit.dateLabel,150);
 const start=date(event.startAt),end=date(event.endAt),format=new Intl.DateTimeFormat('tr-TR',{day:'numeric',month:'long',year:'numeric',timeZone:'Europe/Istanbul'});
 if(Number.isFinite(start))return format.format(new Date(start))+(Number.isFinite(end)&&format.format(new Date(end))!==format.format(new Date(start))?' – '+format.format(new Date(end)):'');
 return validYear(event.year)?String(event.year):'Tarih belirtilmemiş';
}
/** Editorial describes matching current records only; it never creates or republishes a tour. */
export function travelArchiveData(value,now=Date.now()){
 if(!value||value.unavailable||typeof value.preview!=='boolean'||!Array.isArray(value.events)||!value.editorial||typeof value.editorial.events!=='object'||value.editorial.events===null)throw Error('travel_unavailable');
 const seen=new Set(),historical=[],upcoming=[],ongoing=[],undated=[];
 for(const event of value.events.slice(0,1000)){
  if(!event||!slugOK(event.slug)||seen.has(event.slug)||event.category!=='Yurt dışı tur'||!text(event.title,500))continue;
  if(!['published','closed'].includes(event.status)&&!(value.preview&&event.status===undefined))continue;
  seen.add(event.slug);const edit=value.editorial.events[event.slug]||{},start=date(event.startAt),end=date(event.endAt);
  const history=event.archived===true||Number.isFinite(end)&&end<=now||value.preview&&event.archived===undefined&&!Number.isFinite(start)&&validYear(event.year)&&event.year<=new Date(now).getUTCFullYear();
  const p=photo(event,edit),stops=history&&Array.isArray(edit.routeHighlights)?[...new Set(edit.routeHighlights.map(x=>text(x,100)).filter(Boolean))].slice(0,30):[];
  const paris=history&&event.slug==='buyuk-avrupa-turu-2025'&&p?.src===PARIS_IMAGE;
  if(paris&&!stops.includes('Paris'))stops.push('Paris');
  const source=history&&text(edit.source?.title,500)?{title:text(edit.source.title,500),url:sourceURL(edit.source.url)}:null;
  const row={slug:event.slug,title:text(event.title,500),category:'Yurt dışı tur',summary:text(event.summary),year:validYear(event.year)?event.year:null,city:text(event.city,150),dateLabel:dateLabel(event,edit,history),yearOnly:history&&edit.datePrecision==='year',family:history?family(event.slug):'other',photo:p,stops,paris,source,evidenceLabel:history?text(edit.evidenceLabel,300):'',startAt:Number.isFinite(start)?start:null};
  if(history)historical.push(row);else if(Number.isFinite(start)&&start>now)upcoming.push(row);else if(Number.isFinite(start)&&Number.isFinite(end)&&start<=now&&end>now)ongoing.push(row);else undated.push(row);
 }
 historical.sort((a,b)=>(b.year||0)-(a.year||0)||a.title.localeCompare(b.title,'tr'));
 upcoming.sort((a,b)=>a.startAt-b.startAt||a.slug.localeCompare(b.slug));
 return {historical,upcoming,ongoing,undated,preview:value.preview};
}

export async function mountTravelArchive({host,loadArchive}){
 mounts.get(host)?.();const doc=host.ownerDocument,win=doc.defaultView;
 const el=(tag,cls='',content)=>{const n=doc.createElement(tag);if(cls)n.className=cls;if(content!==undefined)n.textContent=content;return n;};
 const a=(label,url,cls='ta-link')=>{const n=el('a',cls,label);n.href=url;return n;};
 const button=(label,action,cls='ta-button')=>{const n=el('button',cls,label);n.type='button';n.dataset.travelAction=action;return n;};
 const root=el('article','travel-archive');host.replaceChildren(root);let alive=true,generation=0,selection='all',year='',data=null;
 const originalTitle=doc.title,ownedTitle='Yurt dışı turları · Archify';doc.title=ownedTitle;
 const current=stamp=>alive&&root.parentNode===host&&host.isConnected&&(stamp===undefined||generation===stamp);
 function source(row){const wrap=el('p','ta-source');wrap.dataset.travelSource='';if(!row.source){wrap.textContent='Kaynak: yayımlanan etkinlik kaydı';return wrap;}wrap.append(el('span','','Kaynak: '));if(row.source.url){const link=a(row.source.title,row.source.url,'ta-source-link source-link');link.target='_blank';link.rel='noopener noreferrer';wrap.append(link);}else wrap.append(el('span','',row.source.title));return wrap;}
 function image(row,hero=false){const figure=el('figure',hero?'ta-hero-photo':'ta-record-photo'),link=a('',href(row.slug),hero?'ta-photo-link':'ta-record-image-link'),img=el('img');img.src=row.photo.thumbnail;img.alt=row.photo.alt;img.loading='lazy';img.decoding='async';link.append(img);const caption=el('figcaption');caption.append(el('span','ta-photo-event',row.title),el('span','',row.photo.caption));if(row.photo.sourceLabel)caption.append(el('span','ta-photo-source',row.photo.sourceLabel));figure.append(link,caption);return figure;}
 function record(row,all){
  const card=el('article','ta-record');card.dataset.travelSlug=row.slug;card.id='tur-'+row.slug;
  const index=el('div','ta-record-index',row.year?String(row.year):'Arşiv');index.setAttribute('aria-hidden','true');card.append(index);
  const body=el('div','ta-record-body'),top=el('div','ta-record-top');top.append(el('p','ta-kicker',GROUPS[row.family].title));
  const h=el('h3');const titleLink=a(row.title,href(row.slug),'ta-record-title');titleLink.dataset.travelEventLink='';h.append(titleLink);top.append(h,el('p','ta-date',row.dateLabel));if(row.yearOnly)top.append(el('p','ta-precision','Bu kayıtta yalnız yıl bilgisi yayımlanmış.'));body.append(top);
  if(row.summary)body.append(el('p','ta-summary',row.summary));
  if(row.stops.length){const route=el('section','ta-stops');route.dataset.travelRoute='';route.append(el('h4','','Kaynakta yer alan duraklar'));const list=el('ul');for(const stop of row.stops)list.append(el('li','',stop));route.append(list,el('p','ta-route-note',row.paris?'Paris durağı: 30 Temmuz 2025 tarihli fotoğraf kaydı.':'Bu durak seçkisi gün gün program veya ziyaret sırası değildir.'));body.append(route);}
  else body.append(el('p','ta-route-missing','Ayrıntılı durak listesi bu kayıtta yayımlanmamış.'));
  body.append(source(row));const links=el('div','ta-record-actions');links.append(a('Turun etkinlik dosyası',href(row.slug),'ta-link ta-file-link'));
  const related=all.filter(item=>item.slug!==row.slug&&item.family===row.family&&row.family!=='other');if(related.length){const nav=el('nav','ta-related');nav.setAttribute('aria-label',row.title+' · diğer yıllar');nav.append(el('span','','Diğer yıllar'));for(const item of related){const link=a(String(item.year||item.title),href(item.slug));link.dataset.travelRelated=item.slug;link.setAttribute('aria-label',item.title);nav.append(link);}links.append(nav);}body.append(links);card.append(body);
  if(row.photo)card.append(image(row));return card;
 }
 function liveSection(rows,label,marker){if(!rows.length)return;const section=el('section','ta-live');section.dataset[marker]='';const heading=el('div','ta-section-heading');heading.append(el('p','ta-kicker','GÜNCEL ETKİNLİK KAYITLARI'),el('h2','',label));section.append(heading);const grid=el('div','ta-live-grid');for(const row of rows){const card=el('article','ta-live-card');card.dataset.travelSlug=row.slug;card.append(el('p','ta-date',row.dateLabel),el('h3','',row.title));if(row.summary)card.append(el('p','',row.summary));const link=a('Etkinlik dosyasını incele',href(row.slug));link.dataset.travelEventLink='';card.append(link);grid.append(card);}section.append(grid);root.append(section);}
 function state(kind,title,detail){data=null;root.replaceChildren();root.dataset.travelState=kind;root.removeAttribute('aria-busy');const section=el('section','ta-empty'),h=el('h1','',title);h.tabIndex=-1;section.append(el('p','ta-kicker','ARCHIFY / YOLCULUKLAR'),h,el('p','',detail));const actions=el('div','ta-actions');actions.append(a('Tüm etkinlikler','etkinlikler.html'));if(kind==='error'){const retry=button('Yeniden dene','retry');retry.addEventListener('click',()=>void load(true));actions.append(retry);}section.append(actions);root.append(section);}
 function render(){
  root.replaceChildren();root.dataset.travelState='ready';root.removeAttribute('aria-busy');
  const hero=el('header','ta-hero'),copy=el('div','ta-hero-copy');copy.append(el('p','ta-kicker','ARCHIFY TRAVEL / TUR ARŞİVİ'));
  const h1=el('h1','ta-title','Birlikte görülen kentler.');h1.tabIndex=-1;copy.append(h1,el('p','ta-lead','Yurt dışı yolculuklarını yılları, kaynakta yer alan durakları ve kendi arşiv kayıtlarıyla keşfet.'));
  const actions=el('div','ta-actions');if(data.historical.length)actions.append(a('Tur kayıtlarına bak','#travel-records','ta-primary'));if(data.upcoming.length)actions.append(a('Yaklaşan turlar','#travel-upcoming'));actions.append(a('Tüm etkinlikler','etkinlikler.html'));copy.append(actions);hero.append(copy);
  const illustrated=data.historical.find(row=>row.photo);if(illustrated)hero.append(image(illustrated,true));else{const paper=el('div','ta-cover');paper.setAttribute('aria-hidden','true');paper.append(el('span','ta-cover-label','ARCHIFY / TRAVEL'),el('strong','ta-cover-word','KENT\nDEFTERİ'),el('span','ta-cover-years',[...new Set(data.historical.map(row=>row.year).filter(Boolean))].join(' / ')||'YOLCULUK KAYITLARI'));hero.append(paper);}root.append(hero);
  liveSection(data.upcoming,'Yaklaşan turlar','travelUpcoming');const upcoming=root.querySelector('[data-travel-upcoming]');if(upcoming)upcoming.id='travel-upcoming';liveSection(data.ongoing,'Devam eden turlar','travelOngoing');liveSection(data.undated,'Diğer yayımlanan tur kayıtları','travelUndated');
  const section=el('section','ta-archive');section.id='travel-records';const heading=el('div','ta-section-heading'),labels=el('div');labels.append(el('p','ta-kicker','YILLARA GÖRE YOLCULUKLAR'),el('h2','','Tur defterleri'));const refresh=button('Kayıtları yenile','refresh','ta-refresh');refresh.addEventListener('click',()=>void load(true));heading.append(labels,refresh);section.append(heading);
  if(!data.historical.length){section.append(el('p','ta-no-history','Şu anda yayımlanmış tarihsel tur kaydı bulunmuyor.'));root.append(section);return;}
  const toolbar=el('div','ta-toolbar'),families=el('div','ta-family-filters');families.setAttribute('role','group');families.setAttribute('aria-label','Tur arşivini seç');
  const present=new Set(data.historical.map(row=>row.family));if(selection!=='all'&&!present.has(selection))selection='all';
  for(const [id,label]of[['all','Tüm turlar'],...Object.entries(GROUPS).filter(([id])=>present.has(id)).map(([id,g])=>[id,g.title])]){const b=button(label,'filter','ta-filter');b.dataset.travelFamily=id;b.setAttribute('aria-pressed',String(selection===id));b.addEventListener('click',()=>{selection=id;update();});families.append(b);}toolbar.append(families);
  const yearLabel=el('label','ta-year'),yearSelect=el('select');yearSelect.dataset.travelYear='';const all=el('option','','Tüm yıllar');all.value='';yearSelect.append(all);for(const y of [...new Set(data.historical.map(row=>row.year).filter(Boolean))].sort((a,b)=>b-a)){const option=el('option','',String(y));option.value=String(y);yearSelect.append(option);}if(![...yearSelect.options].some(o=>o.value===year))year='';yearSelect.value=year;yearLabel.append(el('span','','Yıl'),yearSelect);toolbar.append(yearLabel);section.append(toolbar);
  const count=el('p','ta-results');count.dataset.travelResults='';count.setAttribute('role','status');count.setAttribute('aria-live','polite');const list=el('div','ta-records');section.append(count,list);root.append(section);
  const officialSeries=Array.isArray(data.series)?data.series.find(s=>s?.slug==='yurt-disi-turlari'&&Array.isArray(s.slugs)&&data.historical.some(row=>s.slugs.includes(row.slug))):null;
  function update(){
    if(!data||!current())return;
    for(const b of families.querySelectorAll('button'))b.setAttribute('aria-pressed',String(b.dataset.travelFamily===selection));
    const selected=data.historical.filter(row=>(selection==='all'||row.family===selection)&&(!year||String(row.year)===year));count.textContent=selected.length+' tur kaydı';list.replaceChildren();
    if(!selected.length){const empty=el('div','ta-filter-empty');empty.append(el('p','','Bu seçimde yayımlanmış tur kaydı yok.'));const clear=button('Tüm kayıtları göster','clear');clear.addEventListener('click',()=>{selection='all';year='';yearSelect.value='';update();families.querySelector('button').focus({preventScroll:true});});empty.append(clear);list.append(empty);return;}
    for(const row of selected)list.append(record(row,data.historical));
  }
  yearSelect.addEventListener('change',()=>{year=yearSelect.value;update();});update();
  if(officialSeries){const footer=el('div','ta-series-link');footer.append(el('p','','Yolculuklar, Archify’nin yurt dışı turları serisinde bir araya geliyor.'),a('Tur serisinin arşivi','seri.html?seri=yurt-disi-turlari'));section.append(footer);}
 }
 async function load(focus=false){const stamp=++generation;state('loading','Tur arşivi açılıyor.','Yayımlanan yolculuk kayıtları yükleniyor.');root.setAttribute('aria-busy','true');try{const value=await loadArchive();if(!current(stamp))return;data=travelArchiveData(value);data.series=Array.isArray(value.editorial.series)?value.editorial.series:[];if(!data.historical.length&&!data.upcoming.length&&!data.ongoing.length&&!data.undated.length)state('empty','Yeni bir sayfa için yer var.','Şu anda yayımlanmış tur kaydı bulunmuyor. Diğer etkinlik arşivlerine göz atabilirsin.');else render();}catch{if(current(stamp))state('error','Tur kayıtlarına kısa bir ara.','Güncel tur arşivine şu anda ulaşılamıyor. Yeniden deneyebilirsin.');}if(focus&&current(stamp))root.querySelector('h1')?.focus({preventScroll:true});}
 const observer=new win.MutationObserver(()=>{if(root.parentNode!==host||!host.isConnected)cleanup();});observer.observe(doc.documentElement,{childList:true,subtree:true});
 function cleanup(){if(!alive)return;alive=false;generation++;data=null;observer.disconnect();root.remove();if(doc.title===ownedTitle)doc.title=originalTitle;if(mounts.get(host)===cleanup)mounts.delete(host);}
 mounts.set(host,cleanup);await load();return cleanup;
}
