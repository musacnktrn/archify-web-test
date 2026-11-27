// [codex] 01a20fe2-64d6-75c3-b882-47be7173d5eb · P16 public school catalogue only.
const mounts=new WeakMap(),PAGE_SIZE=24,UNKNOWN_CITY='bilinmiyor';
const idOK=v=>typeof v==='string'&&v.length<=100&&/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v);
const plain=(v,max)=>typeof v==='string'&&v.trim().length>0&&Array.from(v).length<=max&&!/[\u0000-\u001f\u007f<>]/.test(v);
const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const collator=new Intl.Collator('tr',{sensitivity:'base',numeric:true});
export function campusSearchKey(value){return String(value??'').toLocaleLowerCase('tr-TR').normalize('NFD').replace(/\p{M}/gu,'').replace(/ı/g,'i').replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');}
export function campusCatalog(value){
 const bad=()=>{throw Error('campus_catalog_invalid');};
 if(!value||value.version!=='r12-1'||!Array.isArray(value.cities)||!Array.isArray(value.schools)||value.cities.length<1||value.cities.length>1000||value.schools.length<1||value.schools.length>1000)bad();
 const cities=value.cities.map(c=>{if(!exact(c,['id','label'])||!idOK(c.id)||!plain(c.label,200))bad();return {id:c.id,label:c.label};});
 const cityMap=new Map(cities.map(c=>[c.id,c]));if(cityMap.size!==cities.length||cityMap.has(UNKNOWN_CITY))bad();
 const schools=value.schools.map(s=>{if(!exact(s,['id','name','cityId'])||!idOK(s.id)||!plain(s.name,200)||!(s.cityId===null||cityMap.has(s.cityId)))bad();const city=s.cityId===null?null:cityMap.get(s.cityId).label;return {id:s.id,name:s.name,cityId:s.cityId,city,search:campusSearchKey(s.name+' '+(city||''))};});
 if(new Set(schools.map(s=>s.id)).size!==schools.length)bad();schools.sort((a,b)=>collator.compare(a.name,b.name)||a.id.localeCompare(b.id));cities.sort((a,b)=>collator.compare(a.label,b.label));return {version:value.version,cities,schools,unknown:schools.filter(s=>s.cityId===null).length,representedCities:new Set(schools.map(s=>s.cityId).filter(Boolean)).size};
}
export function campusResults(catalog,{query='',city='',page=1}={}){
 const key=campusSearchKey(query),terms=key.split(' ').filter(Boolean),matches=catalog.schools.filter(s=>(city===''||(city===UNKNOWN_CITY?s.cityId===null:s.cityId===city))&&terms.every(term=>s.search.includes(term)));
 if(key){const rank=s=>{const name=campusSearchKey(s.name);return name===key?0:name.startsWith(key)?1:name.includes(key)?2:3;};matches.sort((a,b)=>rank(a)-rank(b)||collator.compare(a.name,b.name)||a.id.localeCompare(b.id));}
 const pages=Math.max(1,Math.ceil(matches.length/PAGE_SIZE)),current=Math.min(Math.max(1,page),pages);return {total:matches.length,page:current,pages,rows:matches.slice((current-1)*PAGE_SIZE,current*PAGE_SIZE)};
}

export async function mountCampusDirectory({host,readCatalog,readSchoolEvents,schoolId,initialCity,initialQuery}={}){
 if(!host?.ownerDocument||typeof readCatalog!=='function')throw TypeError('campus_mount_invalid');mounts.get(host)?.();
 const doc=host.ownerDocument,win=doc.defaultView,originalTitle=doc.title;let ownedTitle=null;
 const el=(tag,cls='',value)=>{const node=doc.createElement(tag);if(cls)node.className=cls;if(value!==undefined)node.textContent=value;return node;};
 const root=el('article','campus-directory'),body=el('div','cd-body'),status=el('p','cd-status');status.setAttribute('role','status');status.setAttribute('aria-live','polite');status.tabIndex=-1;root.append(status,body);host.replaceChildren(root);
 let alive=true,suspended=false,sequence=0,data=null,state=null,observer;
 const live=()=>alive&&!suspended&&host.isConnected&&root.parentNode===host;
 const say=(message,error=false)=>{status.textContent=message;status.classList.toggle('cd-status-error',error);};
 const title=value=>{ownedTitle=value+' · Archify';doc.title=ownedTitle;};
 const setState=value=>root.dataset.campusState=value;
 const button=(label,marker,action,cls='cd-button')=>{const n=el('button',cls,label);n.type='button';n.setAttribute('data-campus-'+marker,'');n.addEventListener('click',()=>{if(live())void action();});return n;};
 const href=(next={})=>{const u=new URL('kampus.html',win.location.href);for(const key of ['sehir','q','sayfa']){const value=next[key]??'';if(value!==''&&value!==1)u.searchParams.set(key,String(value));}if(next.okul)u.searchParams.set('okul',next.okul);return u.pathname+u.search;};
 const routeLink=(label,next,marker,cls='cd-link')=>{const n=el('a',cls,label);n.href=href(next);if(marker)n.setAttribute('data-campus-'+marker,'');n.addEventListener('click',event=>{if(!live()||event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;event.preventDefault();const u=new URL(n.href);win.history.pushState(null,'',u);state=parseRoute();render({focus:true});});return n;};
 function parseRoute(overrides={}){
  const params=new URL(win.location.href).searchParams;let invalid=['okul','sehir','q','sayfa'].some(k=>params.getAll(k).length>1);
  const school=overrides.schoolId===undefined?params.get('okul'):overrides.schoolId;
  const city=overrides.initialCity===undefined?(params.get('sehir')||''):(overrides.initialCity??'');
  const query=overrides.initialQuery===undefined?(params.get('q')||''):(overrides.initialQuery??'');
  const rawPage=params.get('sayfa')||'1';if(!/^[1-9][0-9]{0,3}$/.test(rawPage))invalid=true;
  if(school!==null&&!idOK(school)||typeof city!=='string'||city!==''&&!idOK(city)||typeof query!=='string'||Array.from(query).length>120||/[\u0000-\u001f\u007f]/.test(query))invalid=true;
  return {school,city,query:typeof query==='string'?query.trim():'',page:Number(rawPage)||1,invalid};
 }
 function updateList({query='',city='',page=1},focus){const u=new URL(win.location.href);u.searchParams.delete('okul');for(const [key,value]of [['q',query.trim()],['sehir',city],['sayfa',page===1?'':String(page)]])value?u.searchParams.set(key,value):u.searchParams.delete(key);win.history.pushState(null,'',u);state=parseRoute();render({focus});}
 function heading(name,kicker='ARCHIFY / KAMPÜS REHBERİ'){
  const head=el('header','cd-header');head.append(el('p','cd-eyebrow',kicker));const h=el('h1','cd-title',name);h.tabIndex=-1;head.append(h);return head;
 }
 function faq(){
  const box=el('section','cd-faq');box.setAttribute('aria-labelledby','campus-faq-title');const h=el('h2','','Okuldan topluluğa');h.id='campus-faq-title';box.append(h);
  for(const [q,a]of [
   ['Bu rehber neyi gösteriyor?','Yayımlanmış okul kataloğundaki üniversite adlarını ve varsa şehir bilgisini. Bir okulun listede bulunması, o okulda Archify temsilciliği, ortaklığı veya belirli bir bölüm bulunduğunu göstermez.'],
   ['Hangi şehri seçmeliyim?','Öğrenciysen eğitim aldığın şehri; mezun veya çalışansan bulunduğun şehri seç. Grup başvurusunda okul, durum, alan ve şehir birlikte kontrol edilir.'],
   ['Okulum listede yoksa ne yapabilirim?','Grup başvurusunda “Okulum listede yok” seçeneğiyle okul adını yazabilirsin. Öğrenci okul bilgisi doğrulanamıyorsa şehir ve bölge grupları önerilmez; kayıt ekip incelemesine gider.'],
   ['Buradan doğrudan gruba katılabilir miyim?','Önce uygunluğunu kontrol eder, sonra önerilen topluluklardan birini seçerek başvurursun. Başvuru otomatik grup üyeliği veya mesaj gönderimi oluşturmaz.']
  ]){const item=el('details'),summary=el('summary','',q);item.append(summary,el('p','',a));box.append(item);}return box;
 }
 function invalid(message){setState('invalid');title('Kampüs rehberi');body.replaceChildren(heading('Okul kaydı bulunamadı'),el('p','cd-lead',message),routeLink('Kampüs rehberine dön',{},'back','cd-button cd-primary'));say('Bağlantı kontrol edilmeli.',true);}
 function toolbar(){const tools=el('div','cd-tools');tools.append(button('Kataloğu yenile','refresh',()=>load(true),'cd-link-button'));return tools;}
 function schoolRow(s,index){const row=el('article','cd-school');row.dataset.campusSchool=s.id;const number=el('span','cd-row-index',String(index).padStart(2,'0'));number.setAttribute('aria-hidden','true');row.append(number);const content=el('div','cd-school-copy'),h=el('h3');h.append(routeLink(s.name,{okul:s.id,sehir:state.city,q:state.query,sayfa:state.page},'open','cd-school-title'));content.append(h,el('p','cd-school-city',s.city||'Şehir bilgisi belirtilmemiş'));row.append(content);const arrow=el('span','cd-arrow','↗');arrow.setAttribute('aria-hidden','true');row.append(arrow);return row;}
 function directory(){
  const result=campusResults(data,state);state.page=result.page;setState(result.total?'ready':'empty');title('Kampüs rehberi');body.replaceChildren();
  const hero=heading('Kampüs rehberi'),top=el('div','cd-hero-grid'),intro=el('div');intro.append(el('p','cd-lead','Üniversiteni bul. Şehrinden ve ilgi alanından topluluğa uzanan ilk adımı seç.'));const stat=el('p','cd-catalog-count');stat.append(el('strong','',String(data.schools.length)),el('span','','üniversite kaydı'));top.append(intro,stat);hero.append(top,toolbar());body.append(hero);
  const section=el('section','cd-index');section.setAttribute('aria-labelledby','campus-index-title');const header=el('div','cd-index-heading'),h=el('h2','','Üniversiteler');h.id='campus-index-title';header.append(h,el('span','cd-index-note',state.query?'Ad eşleşmesine göre':'Ada göre · A–Z'));section.append(header);
  const form=el('form','cd-filters');form.setAttribute('role','search');form.setAttribute('aria-label','Üniversite bul');const searchLabel=el('label','cd-field'),search=el('input');search.type='search';search.id='campus-query';search.name='q';search.maxLength=120;search.autocomplete='off';search.value=state.query;search.placeholder='Üniversite veya şehir adı';searchLabel.append(el('span','','Üniversite / şehir ara'),search);
  const cityLabel=el('label','cd-field'),city=el('select');city.id='campus-city';city.name='sehir';const option=(label,value)=>{const n=el('option','',label);n.value=value;return n;};city.append(option('Tüm şehirler',''));for(const c of data.cities)city.append(option(c.label,c.id));city.append(option('Şehir bilgisi belirtilmemiş',UNKNOWN_CITY));city.value=state.city;cityLabel.append(el('span','','Şehre göre'),city);const submit=el('button','cd-button cd-primary','Bul');submit.type='submit';submit.dataset.campusSearch='';form.append(searchLabel,cityLabel,submit);
  form.addEventListener('submit',event=>{event.preventDefault();if(live()&&form.reportValidity())updateList({query:search.value,city:city.value,page:1},'results');});city.addEventListener('change',()=>{if(live())updateList({query:search.value,city:city.value,page:1},'city');});section.append(form);
  const meta=el('div','cd-results-meta'),summary=el('p','cd-results-summary',result.total+' kayıt'+(result.total?' · '+((result.page-1)*PAGE_SIZE+1)+'–'+Math.min(result.page*PAGE_SIZE,result.total)+' arası':''));summary.id='campus-results-status';summary.tabIndex=-1;summary.setAttribute('role','status');summary.setAttribute('aria-live','polite');meta.append(summary);if(state.query||state.city)meta.append(button('Filtreleri temizle','clear',()=>updateList({},'search'),'cd-link-button'));section.append(meta);
  if(result.rows.length){const list=el('div','cd-school-list');for(let i=0;i<result.rows.length;i++)list.append(schoolRow(result.rows[i],(result.page-1)*PAGE_SIZE+i+1));section.append(list);}else{const empty=el('div','cd-empty');empty.append(el('h3','','Bu seçimde okul bulunamadı'),el('p','','Adın bir bölümünü veya başka bir şehri deneyebilirsin.'));const a=el('a','cd-link','Okulum listede yok');a.href='grup-basvuru.html';empty.append(a);section.append(empty);}
  const nav=el('nav','cd-pagination');nav.setAttribute('aria-label','Üniversite listesi sayfaları');if(result.page>1)nav.append(button('← Önceki','previous',()=>updateList({query:state.query,city:state.city,page:result.page-1},'results')));const at=el('span','',result.page+' / '+result.pages);at.dataset.campusPage='';at.setAttribute('aria-label','Sayfa '+result.page+', toplam '+result.pages);nav.append(at);if(result.page<result.pages)nav.append(button('Sonraki →','next',()=>updateList({query:state.query,city:state.city,page:result.page+1},'results')));section.append(nav);body.append(section,faq());say(result.total+' okul kaydı listelenebilir.');
 }
 function detail(s){
  setState('ready');title(s.name);body.replaceChildren();const back=routeLink('← Üniversite listesine dön',{sehir:state.city,q:state.query,sayfa:state.page},'back');body.append(back);const head=heading(s.name);head.classList.add('cd-detail-header');head.dataset.campusDetail=s.id;head.append(el('p','cd-detail-city',s.city||'Şehir bilgisi belirtilmemiş'),toolbar());body.append(head);
  const grid=el('div','cd-detail-grid'),record=el('section','cd-record');record.append(el('p','cd-eyebrow','KATALOG KAYDI'),el('h2','','Okul bilgisi'));const facts=el('dl');for(const [label,value]of [['Üniversite',s.name],['Katalogdaki şehir',s.city||'Henüz belirtilmemiş']])facts.append(el('dt','',label),el('dd','',value));record.append(facts);if(!s.city)record.append(el('p','cd-note','Başvuruda okulunu ve eğitim aldığın şehri belirt. Bilgi eşleşmesi ekip incelemesi gerektirebilir.'));grid.append(record);
  const invitation=el('section','cd-invitation');invitation.append(el('p','cd-eyebrow','SONRAKİ ADIM'),el('h2','','Uygun grubunu bul'),el('p','','Durumunu, bölümünü / mesleğini ve şehrini seçerek katılabileceğin toplulukları kontrol et.'));const apply=el('a','cd-button cd-primary','Topluluklara başvur');apply.href='grup-basvuru.html?okul='+encodeURIComponent(s.id);apply.dataset.campusApply='';invitation.append(apply,el('p','cd-note','Bu bağlantı yalnız okul seçimini taşır. Başvuru için bilgilerini kontrol edip onaylaman gerekir.'));grid.append(invitation);body.append(grid);
  if(readSchoolEvents!==undefined){
   const slot=el('section','cd-school-events');
   slot.dataset.schoolEvents=s.id;
   slot.append(el('h2','','Kampüsle bağlantılı etkinlikler'));
   const content=el('div');slot.append(content);body.append(slot);
   const active=()=>live()&&slot.isConnected&&state.school===s.id&&!doc.hidden;
   if(typeof readSchoolEvents==='function'){
    void import('./campus-event-list.mjs').then(module=>{
     if(active())return module.mountSchoolEvents({host:content,school:s,read:readSchoolEvents,active});
    }).catch(()=>{if(active())content.textContent='Etkinlik bölümü açılamadı. Sayfayı yenileyebilirsin.';});
   } else content.textContent='Güncel kampüs bağlantıları sunuculu sitede görüntülenir.';
  }
  if(s.cityId){const related=data.schools.filter(row=>row.id!==s.id&&row.cityId===s.cityId).slice(0,6);if(related.length){const section=el('section','cd-related');section.append(el('h2','',s.city+' içindeki diğer kayıtlar'));const list=el('ul');for(const row of related){const li=el('li');li.append(routeLink(row.name,{okul:row.id},'related'));list.append(li);}section.append(list,routeLink('Şehirdeki tüm üniversiteler',{sehir:s.cityId},'city-link'));body.append(section);}}
  body.append(faq());say('Okul kaydı yüklendi.');
 }
 function render({focus=false}={}){
  if(!live()||!data)return;
  if(state.invalid||state.city!==''&&state.city!==UNKNOWN_CITY&&!data.cities.some(c=>c.id===state.city)){invalid('Bağlantıdaki okul, şehir veya arama bilgisi geçerli değil. Rehberden yeniden seçim yapabilirsin.');}
  else if(state.school!==null){const row=data.schools.find(s=>s.id===state.school);if(row)detail(row);else invalid('Bu okul kimliği yayımlanmış katalogda bulunmuyor. Üniversite adını rehberde arayabilirsin.');}
  else directory();
  if(focus){const target=focus==='search'?body.querySelector('#campus-query'):focus==='city'?body.querySelector('#campus-city'):focus==='results'?body.querySelector('#campus-results-status'):body.querySelector('h1');target?.focus({preventScroll:focus==='city'});}
 }
 async function load(focus=false){
  if(!live())return;const token=++sequence;data=null;setState('loading');root.setAttribute('aria-busy','true');say('Kampüs rehberi yükleniyor…');body.replaceChildren(heading('Kampüs rehberi'),el('p','cd-loading','Üniversite kataloğu hazırlanıyor.'));
  try{const value=await readCatalog();if(!live()||sequence!==token)return;data=campusCatalog(value);render({focus});}
  catch{if(!live()||sequence!==token)return;data=null;setState('error');title('Kampüs rehberi');body.replaceChildren(heading('Kampüs rehberi'),el('p','cd-empty','Üniversite kataloğu şu anda yüklenemiyor. Yeniden deneyebilirsin.'),button('Yeniden yükle','retry',()=>load(true),'cd-button cd-primary'));say('Katalog yüklenemedi.',true);}
  finally{if(live()&&sequence===token)root.setAttribute('aria-busy','false');}
 }
 function hide(){if(!alive)return;sequence++;suspended=true;data=null;body.replaceChildren();setState('loading');say('Geri döndüğünde katalog yeniden yüklenecek.');}
 function show(event){if(!alive||!(suspended||event.persisted))return;suspended=false;state=parseRoute();void load(false);}
 function pop(){if(live()){state=parseRoute();void load(true);}}
 function visible(){if(doc.visibilityState==='visible'&&live())void load(false);}
 function cleanup(){if(!alive)return;alive=false;sequence++;data=null;observer?.disconnect();win.removeEventListener('pagehide',hide);win.removeEventListener('pageshow',show);win.removeEventListener('popstate',pop);doc.removeEventListener('visibilitychange',visible);root.remove();if(doc.title===ownedTitle)doc.title=originalTitle;if(mounts.get(host)===cleanup)mounts.delete(host);}
 observer=new win.MutationObserver(()=>{if(root.parentNode!==host||!host.isConnected)cleanup();});observer.observe(doc.documentElement,{childList:true,subtree:true});win.addEventListener('pagehide',hide);win.addEventListener('pageshow',show);win.addEventListener('popstate',pop);doc.addEventListener('visibilitychange',visible);mounts.set(host,cleanup);state=parseRoute({schoolId,initialCity,initialQuery});await load();return cleanup;
}
