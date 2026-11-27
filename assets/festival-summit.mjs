// [codex] 01a20fe2-64d6-75c3-b882-47be7173d5eb · P28 current-public edition and program archive.
import {categoryIcon, publicSeries} from './premium.mjs';
import {photoAlbumsData} from './photo-albums.mjs';
const mounts = new WeakMap();
const categories = {festival:{label:'Festivaller',singular:'festival',source:'Festival'},zirve:{label:'Zirveler',singular:'zirve',source:'Zirve'}};
const text = (v,max=4000) => typeof v==='string' && v.length<=max && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(v) ? v.trim() : '';
const slugOK = v => typeof v==='string' && v.length<=100 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v);
const yearOK = v => Number.isInteger(v)&&v>=1900&&v<=2200;
const stamp = v => typeof v==='string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,6})?(?:Z|[+-]\d\d:\d\d)$/.test(v) && Number.isFinite(Date.parse(v)) ? Date.parse(v) : null;
const eventURL = slug => 'etkinlik.html?slug='+encodeURIComponent(slug);
const https = value => {try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password?u.href:'';}catch{return '';}};
function dateLabel(event,edit,start,end,year) {
  if(start!==null){const f=new Intl.DateTimeFormat('tr-TR',{day:'numeric',month:'long',year:'numeric',timeZone:'Europe/Istanbul'}),first=f.format(start);return end!==null&&end>=start&&f.format(end)!==first?first+' – '+f.format(end):first;}
  if(event.archived===true && edit.datePrecision==='unknown')return 'Tarih belirtilmemiş';
  if(event.archived===true && edit.datePrecision!=='year' && text(edit.dateLabel,150))return text(edit.dateLabel,150);
  return year!==null?String(year):event.archived===true?'Tarih belirtilmemiş':'Tarih duyurulacak';
}
/** Current event rows own identity, publication, location and gallery. Archived editorial only enriches them. */
export function festivalSummitData(value,category,now=Date.now()) {
  if(!Object.hasOwn(categories,category)||!value||value.unavailable||typeof value.preview!=='boolean'||!Array.isArray(value.events)||value.events.length>500||!value.editorial||!value.editorial.events||typeof value.editorial.events!=='object'||Array.isArray(value.editorial.events))throw Error('festival_summit_unavailable');
  const events=[],seen=new Set();
  for(const e of value.events){
    if(e?.category!==categories[category].source||!['published','closed'].includes(e.status))continue;
    if(!slugOK(e.slug)||!text(e.title,500)||typeof e.archived!=='boolean'||seen.has(e.slug))throw Error('festival_summit_invalid_record');
    seen.add(e.slug);events.push(e);
  }
  const albums=new Map(photoAlbumsData({...value,events}).albums.map(a=>[a.slug,a]));
  const series=publicSeries(value.editorial.series).filter(s=>slugOK(s.slug)&&text(s.title,500)&&s.category===categories[category].source);
  const records=events.map(e=>{
    const edit=e.archived&&Object.hasOwn(value.editorial.events,e.slug)?value.editorial.events[e.slug]||{}:{};
    const start=stamp(e.startAt),end=stamp(e.endAt),historical=e.archived||end!==null&&end<=now||start!==null&&start<=now&&end===null;
    const year=start===null?(yearOK(e.year)?e.year:null):Number(new Intl.DateTimeFormat('en',{year:'numeric',timeZone:'Europe/Istanbul'}).format(start));
    const program=(Array.isArray(edit.program)?edit.program:[]).slice(0,30).map(v=>text(v,500)).filter(Boolean);
    const publishedProgram=(Array.isArray(edit.publishedProgram)?edit.publishedProgram:[]).slice(0,14).filter(d=>text(d?.label,200)&&Array.isArray(d.items)).map(d=>({label:text(d.label,200),items:d.items.slice(0,100).filter(i=>text(i?.title,500)).map(i=>({title:text(i.title,500),time:text(i.time,80)}))})).filter(d=>d.items.length);
    const workshops=[...new Set((Array.isArray(edit.workshops)?edit.workshops:[]).slice(0,100).map(v=>text(v,300)).filter(Boolean))];
    const subprograms=(Array.isArray(edit.subprograms)?edit.subprograms:[]).slice(0,30).filter(v=>['Atölye','Workshop'].includes(v?.category)&&text(v.title,300)).map(v=>text(v.title,300));
    const source=text(edit.source?.title,500)?{title:text(edit.source.title,500),url:https(edit.source.url)}:null;
    const open=!value.preview&&!e.archived&&e.status==='published'&&e.registrationOpen===true&&start!==null&&start>now&&(e.endAt===null||end!==null&&end>start);
    return {slug:e.slug,title:text(e.title,500),year,city:text(e.city,150),venue:text(e.venue,300),summary:text(e.summary),dateLabel:dateLabel(e,edit,start,end,year),start,end,historical,upcoming:!historical&&start!==null&&start>now,open,program,publishedProgram,workshops,subprograms,source,photo:albums.get(e.slug)?.photos[0]||null,photoCount:albums.get(e.slug)?.photos.length||0,series:series.filter(s=>s.slugs.includes(e.slug)).map(s=>({slug:s.slug,title:s.title}))};
  });
  records.sort((a,b)=>Number(b.upcoming)-Number(a.upcoming)||(a.upcoming&&b.upcoming?(a.start-b.start):(b.year||0)-(a.year||0)||(b.start||0)-(a.start||0))||a.title.localeCompare(b.title,'tr'));
  return {records,preview:value.preview,bounded:value.events.length===500};
}

export async function mountFestivalSummit({host,category,loadArchive}) {
  if(!host?.ownerDocument||typeof loadArchive!=='function'||!Object.hasOwn(categories,category))throw TypeError('festival_summit_mount_invalid');
  mounts.get(host)?.();
  const doc=host.ownerDocument,win=doc.defaultView,config=categories[category],originalTitle=doc.title;
  const el=(tag,cls='',value)=>{const n=doc.createElement(tag);if(cls)n.className=cls;if(value!==undefined)n.textContent=value;return n;};
  const root=el('article','festival-summit');root.dataset.category=category;host.replaceChildren(root);
  let alive=true,suspended=doc.visibilityState==='hidden',epoch=0,data=null,ownedTitle='',shown=8,expiryTimer=null,lastFocus=null;
  let filters=readURL(),updateList=null;
  const current=token=>alive&&!suspended&&host.isConnected&&root.parentNode===host&&(token===undefined||token===epoch);
  function readURL(){const u=new URL(win.location.href);return {year:text(u.searchParams.get('yil'),12),city:text(u.searchParams.get('sehir'),150)};}
  function writeURL(){try{const u=new URL(win.location.href);u.searchParams.set('tur',category);for(const [key,param] of [['year','yil'],['city','sehir']]){if(filters[key])u.searchParams.set(param,filters[key]);else u.searchParams.delete(param);}if(u.href!==win.location.href)win.history.replaceState(win.history.state,'',u.href);}catch{/* A sandboxed embed can still use local filters. */}}
  const link=(label,href,key='',cls='fs-link')=>{const a=el('a',cls,label);a.href=href;if(key)a.setAttribute('data-fs-'+key,'');return a;};
  const button=(label,key,action,cls='fs-button')=>{const b=el('button',cls,label);b.type='button';b.setAttribute('data-fs-'+key,'');b.addEventListener('click',()=>{if(current())action();});return b;};
  function clear(){data=null;updateList=null;win.clearTimeout(expiryTimer);expiryTimer=null;root.replaceChildren();}
  function heading(){ownedTitle=config.label+' · Archify';doc.title=ownedTitle;const h=el('h1','fs-title',config.label);h.tabIndex=-1;return h;}
  function header(){const h=el('header','fs-header'),copy=el('div','fs-header-copy'),icon=el('span','fs-icon');icon.innerHTML=categoryIcon(category);copy.append(el('p','fs-kicker','Archify · Program arşivi'),heading());h.append(copy,icon);return h;}
  function state(kind,message){clear();root.dataset.state=kind;root.setAttribute('aria-busy',String(kind==='loading'));root.append(header());const box=el('section','fs-state'),p=el('p','',message);p.setAttribute('role','status');box.append(p);if(kind!=='loading')box.append(button('Yeniden yükle','retry',()=>void load('heading')),link('Etkinlik arşivi','arsiv.html'));root.append(box);}
  function focusKey(){const n=doc.activeElement;if(!root.contains(n))return null;for(const k of ['year','city','refresh','reset','more'])if(n.hasAttribute('data-fs-'+k))return k;return n===root.querySelector('h1')?'heading':null;}
  function restoreFocus(key){if(!key)return;const n=key==='heading'?root.querySelector('h1'):root.querySelector('[data-fs-'+key+']');(n||root.querySelector('h1'))?.focus({preventScroll:true});}
  function figure(row,lead){
    const p=row.photo,f=el('figure','fs-photo'),a=link('', 'albumler.html?etkinlik='+encodeURIComponent(row.slug),'photo','fs-photo-link');a.setAttribute('aria-label',row.title+' fotoğraf albümünü aç');
    const img=el('img');img.src=p.src;img.alt=p.alt;img.width=p.width;img.height=p.height;img.loading=lead?'eager':'lazy';img.decoding='async';
    if(p.variants.length){img.srcset=p.variants.map(v=>v.src+' '+v.width+'w').join(', ');img.sizes='(max-width: 720px) calc(100vw - 40px), (max-width: 1100px) 48vw, 640px';}
    img.addEventListener('error',()=>{if(!current()||!f.isConnected)return;f.replaceChildren(el('p','fs-image-error','Fotoğraf şu anda yüklenemiyor.'));},{once:true});
    a.append(img);const c=el('figcaption','fs-caption');c.append(el('span','fs-caption-event',row.title),el('span','',p.caption));f.append(a,c);return f;
  }
  function record(row,index){
    const article=el('article','fs-edition');article.dataset.fsEvent=row.slug;article.dataset.photo=String(!!row.photo);article.dataset.period=row.historical?'history':row.upcoming?'upcoming':'current';
    const rail=el('div','fs-edition-index');rail.append(el('span',row.year===null?'fs-year fs-year-unknown':'fs-year',row.year===null?'Tarih belirsiz':String(row.year)),el('span','fs-period',row.historical?'Arşiv':row.upcoming?'Yaklaşan buluşma':'Yayımlanan etkinlik'));
    const h=el('header','fs-edition-header'),title=el('h2','fs-event-title');title.append(link(row.title,eventURL(row.slug),'event-link','fs-title-link'));h.append(title);
    const facts=el('p','fs-facts');facts.append(el('span','fs-date',row.dateLabel));if(row.city)facts.append(el('span','fs-city',row.city));h.append(facts);if(row.venue)h.append(el('p','fs-venue',row.venue));
    article.append(rail,h);if(row.photo)article.append(figure(row,index===0));
    const body=el('div','fs-edition-body');if(row.summary)body.append(el('p','fs-summary',row.summary));
    if(row.program.length){const list=el('ul','fs-program-outline');list.setAttribute('aria-label','Yayımlanan programdan');for(const v of row.program)list.append(el('li','',v));body.append(list);}
    if(row.publishedProgram.length||row.workshops.length||row.subprograms.length){
      const details=el('details','fs-program'),summary=el('summary');summary.dataset.fsProgramToggle='';summary.textContent=row.publishedProgram.length?'Yayımlanan günlük program':'Atölye başlıkları';details.append(summary);
      if(row.publishedProgram.length){details.append(el('p','fs-program-note','Etkinlik için duyurulan program.'));for(const day of row.publishedProgram){const section=el('section','fs-program-day');section.append(el('h3','',day.label));const items=el('ul');for(const item of day.items){const li=el('li');if(item.time)li.append(el('span','fs-time',item.time));li.append(el('span','',item.title));items.append(li);}section.append(items);details.append(section);}}
      if(row.workshops.length||row.subprograms.length){const topics=el('section','fs-workshops');topics.append(el('h3','','Ana etkinlik içindeki atölyeler'));const ul=el('ul');for(const v of [...row.workshops,...row.subprograms])ul.append(el('li','',v));topics.append(ul,link('Atölyeleri incele',eventURL(row.slug)+'#atolyeler','workshops'));details.append(topics);}body.append(details);
    }
    const actions=el('nav','fs-actions');actions.setAttribute('aria-label',row.title+' bağlantıları');actions.append(link('Etkinlik dosyası',eventURL(row.slug),'detail'));
    if(row.publishedProgram.length)actions.append(link('Günlük program',eventURL(row.slug)+'#archive-program-title','program'));
    else if(!row.historical)actions.append(link('Program ve ayrıntılar',eventURL(row.slug)+'#event-program','program'));
    if(row.photoCount)actions.append(link('Fotoğraf albümü ('+row.photoCount+')','albumler.html?etkinlik='+encodeURIComponent(row.slug),'album'));
    if(row.open&&row.start>Date.now())actions.append(link('Başvur', 'basvuru.html?slug='+encodeURIComponent(row.slug),'apply','fs-apply'));
    body.append(actions);
    const notes=el('div','fs-edition-notes');for(const s of row.series)notes.append(link(s.title+' serisi','seri.html?seri='+encodeURIComponent(s.slug),'series'));
    if(row.source){const p=el('p','fs-source');p.append(doc.createTextNode('Kaynak: '));if(row.source.url){const a=link(row.source.title,row.source.url,'source');a.target='_blank';a.rel='noopener noreferrer';p.append(a);}else p.append(doc.createTextNode(row.source.title));notes.append(p);}if(notes.children.length)body.append(notes);
    article.append(body);return article;
  }
  function render(value){
    clear();data=value;root.dataset.state=value.records.length?'ready':'empty';root.setAttribute('aria-busy','false');root.append(header());
    const tools=el('div','fs-tools'),form=el('form','fs-filters');form.setAttribute('aria-label',config.label+' için yıl ve şehir');form.addEventListener('submit',e=>e.preventDefault());
    const years=[...new Set(value.records.map(r=>r.year).filter(v=>v!==null))].sort((a,b)=>b-a).map(v=>[String(v),String(v)]);if(value.records.some(r=>r.year===null))years.push(['unknown','Yılı belirsiz']);
    const cities=[...new Set(value.records.map(r=>r.city).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'tr')).map(v=>[v,v]);if(value.records.some(r=>!r.city))cities.push(['unknown','Şehri belirsiz']);
    const control=(key,label,choices)=>{const wrap=el('label','fs-filter'),select=el('select');select.setAttribute('data-fs-'+key,'');const all=el('option','','Tümü');all.value='';select.append(all);for(const [val,name]of choices){const o=el('option','',name);o.value=val;select.append(o);}if(!choices.some(([v])=>v===filters[key]))filters[key]='';select.value=filters[key];wrap.append(el('span','',label),select);form.append(wrap);select.addEventListener('change',()=>{if(!current()||!data)return;filters[key]=select.value;shown=8;writeURL();updateList();});return select;};
    const year=control('year','Yıl',years),city=control('city','Şehir',cities);writeURL();
    tools.append(form,button('Yenile','refresh',()=>void load('refresh'),'fs-refresh'));root.append(tools);
    const results=el('div','fs-results'),count=el('p');count.setAttribute('role','status');count.setAttribute('aria-live','polite');count.dataset.fsCount='';const reset=button('Filtreleri temizle','reset',()=>{filters={year:'',city:''};year.value='';city.value='';shown=8;writeURL();updateList();year.focus({preventScroll:true});},'fs-reset');results.append(count,reset);root.append(results);
    const list=el('div','fs-editions'),bottom=el('div','fs-bottom');root.append(list,bottom);
    updateList=()=>{
      if(!current()||!data)return;
      const selected=data.records.filter(r=>(!filters.year||(r.year===null?'unknown':String(r.year))===filters.year)&&(!filters.city||(r.city||'unknown')===filters.city));
      list.replaceChildren();bottom.replaceChildren();reset.hidden=!filters.year&&!filters.city;count.textContent=selected.length+' '+config.singular+' kaydı';
      if(!selected.length){const p=el('p','fs-empty',data.records.length?'Bu yıl ve şehir için yayımlanmış kayıt bulunmuyor. Filtreleri temizleyerek diğer buluşmaları görebilirsin.':'Şu anda yayımlanmış '+config.singular+' kaydı bulunmuyor.');p.dataset.fsEmpty='';list.append(p);}
      for(const [i,row]of selected.slice(0,shown).entries())list.append(record(row,i));
      if(selected.length>shown)bottom.append(button('Diğer '+config.label.toLocaleLowerCase('tr-TR')+' · '+(selected.length-shown)+' kayıt','more',()=>{const before=shown;shown+=8;updateList();const first=list.children[before]?.querySelector('h2 a');first?.focus({preventScroll:true});},'fs-more'));
      if(data.bounded)bottom.append(el('p','fs-limit','En fazla 500 güncel etkinlik kaydı içinde arama yapılıyor.'));
      if(data.preview)bottom.append(el('p','fs-preview','Önizleme · Başvurular bu görünümde kapalı.'));
      bottom.append(link('Tüm etkinlik arşivi','arsiv.html','archive'));
    };
    updateList();
    const starts=value.records.filter(r=>r.open&&r.start>Date.now()).map(r=>r.start);
    if(starts.length)expiryTimer=win.setTimeout(()=>{if(current())void load(focusKey());},Math.min(2147483647,Math.max(1,Math.min(...starts)-Date.now()+10)));
  }
  async function load(focus=null){
    if(!current())return;
    const token=++epoch;state('loading','Güncel etkinlikler yükleniyor.');
    try{const value=await loadArchive();if(!current(token))return;render(festivalSummitData(value,category));}
    catch{if(current(token))state('error','Güncel etkinliklere ulaşılamıyor. Bağlantını kontrol edip yeniden dene.');}
    if(current(token)&&focus)restoreFocus(focus);
  }
  function suspend(){if(!alive)return;lastFocus=focusKey()||lastFocus;epoch++;suspended=true;state('loading','Güncel kayıtlar sayfaya döndüğünde yenilenecek.');}
  function resume(force=false){if(!alive||doc.visibilityState==='hidden'||(!suspended&&!force))return;suspended=false;const focus=lastFocus;lastFocus=null;void load(focus);}
  const visibility=()=>doc.visibilityState==='hidden'?suspend():resume(true);
  const pageshow=e=>resume(e.persisted),pagehide=()=>suspend();
  const popstate=()=>{filters=readURL();shown=8;if(current())void load(focusKey());};
  doc.addEventListener('visibilitychange',visibility);win.addEventListener('pagehide',pagehide);win.addEventListener('pageshow',pageshow);win.addEventListener('popstate',popstate);
  const observer=new win.MutationObserver(()=>{if(!host.isConnected||root.parentNode!==host)cleanup();});observer.observe(doc.documentElement,{childList:true,subtree:true});
  function cleanup(){if(!alive)return;alive=false;epoch++;win.clearTimeout(expiryTimer);data=null;updateList=null;observer.disconnect();doc.removeEventListener('visibilitychange',visibility);win.removeEventListener('pagehide',pagehide);win.removeEventListener('pageshow',pageshow);win.removeEventListener('popstate',popstate);root.remove();if(doc.title===ownedTitle)doc.title=originalTitle;if(mounts.get(host)===cleanup)mounts.delete(host);}
  mounts.set(host,cleanup);if(suspended)state('loading','Güncel kayıtlar sayfaya döndüğünde yüklenecek.');else await load();return cleanup;
}
