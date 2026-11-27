// [codex] 01a20fe2-64d6-75c3-b882-47be7173d5eb · P14 selected visibility; no identity inference, storage or outbound access.
const mounts=new WeakMap();
export const networkStatuses=Object.freeze({draft:'Taslak',pending:'İncelemede',published:'Yayında',changes_requested:'Düzeltme istendi',withdrawn:'Yayından kaldırıldı'});
const defaultFields=[['architecture','Mimarlık'],['interior-architecture','İç mimarlık'],['landscape-architecture','Peyzaj mimarlığı'],['urban-planning','Şehir ve bölge planlama'],['other','Diğer']].map(([id,label])=>({id,label}));
export const networkId=v=>typeof v==='string'&&/^[a-f0-9]{32}$/.test(v);
const integer=v=>Number.isInteger(v)&&v>0&&v<=99999999;
const text=(v,max)=>typeof v==='string'&&v.trim().length>0&&Array.from(v).length<=max&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v);
const code=v=>typeof v==='string'&&/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v)&&v.length<=160;
const date=v=>typeof v==='string'&&/(?:Z|[+-]\d{2}:\d{2})$/.test(v)&&Number.isFinite(Date.parse(v));
const fail=()=>{throw Object.assign(Error('invalid_network_response'),{code:'invalid_network_response'});};
const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
export function networkPublic(v){if(!exact(v,['publicId','displayName','field','cityId','bio'])||!networkId(v.publicId)||!text(v.displayName,120)||!code(v.field)||!(v.cityId===null||code(v.cityId))||!(v.bio===null||text(v.bio,1600)))fail();return {publicId:v.publicId,displayName:v.displayName,field:v.field,cityId:v.cityId,bio:v.bio};}
export function networkPrivate(v){
 if(!exact(v,['publicId','revision','contentRevision','status','card','preview','consentRevision','publishedRevision','reviewNote','createdAt','updatedAt'])||!networkId(v.publicId)||!integer(v.revision)||!integer(v.contentRevision)||v.contentRevision>v.revision||!Object.hasOwn(networkStatuses,v.status)||!date(v.createdAt)||!date(v.updatedAt)||!(v.reviewNote===null||text(v.reviewNote,1000)))fail();
 const c=v.card;if(!exact(c,['displayName','field','cityId','bio','visibility'])||!exact(c.visibility,['city','bio'])||typeof c.visibility.city!=='boolean'||typeof c.visibility.bio!=='boolean')fail();
 const all=networkPublic({publicId:v.publicId,displayName:c.displayName,field:c.field,cityId:c.cityId,bio:c.bio}),preview=networkPublic(v.preview);
 if(preview.publicId!==v.publicId||preview.displayName!==all.displayName||preview.field!==all.field||preview.cityId!==(c.visibility.city?all.cityId:null)||preview.bio!==(c.visibility.bio?all.bio:null))fail();
 if(v.consentRevision!==( ['pending','published'].includes(v.status)?v.contentRevision:null)||v.publishedRevision!==(v.status==='published'?v.contentRevision:null))fail();
 return {...v,card:{displayName:all.displayName,field:all.field,cityId:all.cityId,bio:all.bio,visibility:{...c.visibility}},preview};
}
export function networkCatalog(value,fallback={}){
 const result={};for(const key of ['fields','cities']){let rows=value?.[key]??fallback[key]??(key==='fields'?defaultFields:[]);if(!Array.isArray(rows)||rows.length>200)fail();result[key]=rows.map(r=>{if(!r||!code(r.id)||!text(r.label,180))fail();return{id:r.id,label:r.label};});if(new Set(result[key].map(r=>r.id)).size!==result[key].length)fail();}return result;
}
export function networkPage(value,privateView=false){
 if(!value||!date(value.asOf)||!Array.isArray(value.profiles)||value.profiles.length>50||!(value.nextCursor===null||networkId(value.nextCursor)))fail();
 const profiles=value.profiles.map(privateView?networkPrivate:networkPublic);if(new Set(profiles.map(p=>p.publicId)).size!==profiles.length||profiles.some((p,i)=>i&&p.publicId<=profiles[i-1].publicId)||value.nextCursor!==null&&value.nextCursor!==profiles.at(-1)?.publicId)fail();return {...value,profiles,nextCursor:value.nextCursor};
}
export function networkError(error){return ({invalid_network_response:'Gelen kayıt doğrulanamadı. Güncel durumu yeniden yükle.',network_revision_conflict:'Kayıt başka bir işlemde değişti. Güncel durumu yeniden yükleyip incele.',network_request_conflict:'Bu işlem kimliği başka içerikle kullanılmış. Güncel durumu yeniden yükle.',network_transition_invalid:'Bu işlem güncel durumda kullanılamıyor.',network_consent_required:'Gösterilen içerik için ayrı yayın rızanı belirt.',network_contact_not_allowed:'Telefon, e-posta veya bağlantı ekleme. Mesleki çalışmalarını sade metinle anlat.',invalid_network_text:'Ad ve açıklamayı kontrol et; iletişim bilgisi veya işaretleme kullanma.',invalid_network_input:'Alanları ve seçtiğin görünürlüğü kontrol et.',invalid_network_visibility:'Görünürlük seçimini kontrol et.',invalid_network_field:'Mesleki alanını listeden seç.',invalid_network_city:'Şehrini listeden seç.',network_member_unavailable:'Bu hesap için yayın işlemi şu anda kullanılamıyor.',network_profile_not_found:'Bu mesleki kart şu anda görünür değil.',network_unavailable:'Mesleki kart alanı şu anda açık değil.',member_unavailable:'Üye çalışma alanı şu anda açık değil.',member_authentication_required:'Üye oturumunu yeniden doğrulamalısın.',authentication_required:'Ekip oturumunu yeniden doğrulamalısın.',forbidden:'Bu görünüm için güncel yetkin bulunmuyor.',request_verification:'Oturum doğrulaması yenilenmeli.'})[error?.code||error?.message]||'İşlem doğrulanamadı. Yeniden deneyebilirsin.';}

/** Shared leaf lifecycle; private payloads remain in memory only and are retired on authorization or navigation changes. */
export function createNetworkSurface({host,api,isCurrent=()=>true,className,title,heading='h1',report=()=>{},explain=()=>'',privateView=true}){
 if(!host?.ownerDocument||typeof api!=='function')throw TypeError('network_mount_invalid');mounts.get(host)?.();const doc=host.ownerDocument,win=doc.defaultView;
 const el=(tag,cls='',value)=>{const n=doc.createElement(tag);if(cls)n.className=cls;if(value!==undefined)n.textContent=value;return n;};
 const root=el('section',className+' network-surface'),header=el('header','np-header'),h=el(heading,'',title),tools=el('div','np-tools'),status=el('p','np-status'),body=el('div','np-body'),retry=el('div','np-retry');h.tabIndex=-1;header.append(el('p','np-eyebrow',privateView?'ARCHIFY / ÖZEL ÇALIŞMA ALANI':'ARCHIFY / MESLEKİ AĞ'),h,tools);status.setAttribute('role','status');status.setAttribute('aria-live','polite');status.tabIndex=-1;root.append(header,status,retry,body);host.replaceChildren(root);
 let alive=true,sealed=false,suspended=false,sequence=0,busy=false,pending=null,reader=null,onClear=()=>{},refreshAfterWrite=false;
 const current=()=>{if(!alive||sealed||suspended)return false;if(!host.isConnected||root.parentNode!==host||!isCurrent()){cleanup();return false;}return true;};
 const active=()=>current()&&!busy&&!pending;
 const say=(message,error=false,quiet=false)=>{status.textContent=message;status.classList.toggle('np-error',error);status.dataset.quiet=String(quiet);};
 const lock=()=>{root.setAttribute('aria-busy',String(busy));for(const n of root.querySelectorAll('button,input,select,textarea,fieldset'))n.disabled=busy||Boolean(pending)||n.dataset.locked==='true';for(const n of retry.querySelectorAll('button'))n.disabled=busy;};
 function clear(){sequence++;pending=null;busy=false;refreshAfterWrite=false;onClear();body.replaceChildren();tools.replaceChildren();retry.replaceChildren();root.removeAttribute('aria-busy');}
 function denied(e){return [401,403].includes(e?.status)||['forbidden','authentication_required','member_authentication_required','member_session_changed'].includes(e?.code);}
 function terminal(e){clear();sealed=true;root.dataset.networkState='denied';say('Özel görünüm kapatıldı.',true);body.append(el('p','np-empty',networkError(e)));status.focus({preventScroll:true});}
 function button(label,marker,action,cls='np-button'){const n=el('button',cls,label);n.type='button';n.setAttribute('data-network-'+marker,'');n.addEventListener('click',()=>{if(active())void action();});return n;}
 function link(label,href,cls='np-link'){const n=el('a',cls,label);n.href=href;return n;}
 const detailMessage=e=>networkError(e)||(typeof explain==='function'?explain(e):'');
 function retryView(mutation=false){retry.replaceChildren();retry.append(el('p','',mutation?'Son işlemin sonucu doğrulanamadı. Aynı isteği güvenle yeniden deneyebilirsin.':'Güncel görünümü yeniden yükleyebilirsin.'));const b=el('button','np-button',mutation?'Aynı işlemi yeniden dene':'Yeniden yükle');b.type='button';b.setAttribute(mutation?'data-network-retry':'data-network-reload','');b.addEventListener('click',()=>{if(current()&&!busy){if(mutation&&pending)void send();else void reader?.();}});retry.append(b);
  if(mutation){const read=el('button','np-button np-secondary','Güncel durumu oku');read.type='button';read.dataset.networkReload='';read.addEventListener('click',()=>{if(current()&&!busy){pending=null;void reader?.();}});retry.append(read);}}
 async function read(route,query,apply){if(!active())return false;const token=++sequence;busy=true;refreshAfterWrite=false;onClear();body.replaceChildren();tools.replaceChildren();retry.replaceChildren();root.dataset.networkState='loading';say('Güncel kayıtlar yükleniyor…');lock();try{const value=await api(route,undefined,query);if(!current()||token!==sequence)return false;apply(value);if(!['empty','preview'].includes(root.dataset.networkState))root.dataset.networkState='ready';say('Güncel görünüm yüklendi.',false,true);return true;}catch(e){if(!current()||token!==sequence)return false;if(denied(e)){terminal(e);return false;}onClear();body.replaceChildren(el('p','np-empty',detailMessage(e)));root.dataset.networkState='error';say(detailMessage(e),true);retryView();report(detailMessage(e),true);return false;}finally{if(current()&&token===sequence){busy=false;lock();}}}
 async function send(){if(!current()||busy||!pending)return;const token=++sequence,op=pending;busy=true;lock();say('İşlem kaydediliyor…');try{const result=await api(op.route,op.body);if(!current()||token!==sequence)return;const parsed=op.parse(result);pending=null;busy=false;retry.replaceChildren();
  if(refreshAfterWrite){refreshAfterWrite=false;onClear();body.replaceChildren();tools.replaceChildren();root.dataset.networkState='loading';say('Güncel kayıtlar yeniden kontrol ediliyor…');if(doc.visibilityState==='visible')void reader?.();}
  else{root.dataset.networkState='ready';say(result?.replayed?'Önceki isteğin güncel sonucu yüklendi.':'İşlem kaydedildi.');op.apply(parsed);if(token===sequence)status.focus({preventScroll:true});}
 }catch(e){if(!current()||token!==sequence)return;if(denied(e)){terminal(e);return;}busy=false;onClear();body.replaceChildren();tools.replaceChildren();root.dataset.networkState='error';say(detailMessage(e),true);if(e?.status>=400&&e.status<500){pending=null;refreshAfterWrite=false;}if(doc.visibilityState==='visible')retryView(Boolean(pending));report(detailMessage(e),true);}finally{if(current()&&token===sequence){busy=false;lock();}}}
 function mutate(route,body,parse,apply){if(!active())return;const bytes=new Uint8Array(16);win.crypto.getRandomValues(bytes);const requestId=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');pending={route,body:JSON.parse(JSON.stringify({...body,requestId})),parse,apply};void send();}
 function setReader(load){reader=load;return load;}
 function pagehide(){if(!alive||!reader)return;clear();suspended=true;root.dataset.networkState='loading';say('Geri döndüğünde güncel görünüm yüklenecek.');}
 function pageshow(e){if(!alive||sealed||!(suspended||e.persisted))return;suspended=false;void reader?.();}
 function visible(){
  if(!current()||!reader)return;
  if(doc.visibilityState==='hidden'){
   if(pending){refreshAfterWrite=true;onClear();body.replaceChildren();tools.replaceChildren();retry.replaceChildren();}
   else clear();
   root.dataset.networkState='loading';say('Geri döndüğünde güncel görünüm kontrol edilecek.');return;
  }
  if(doc.visibilityState!=='visible')return;
  if(pending){refreshAfterWrite=true;if(!busy){root.dataset.networkState='error';say('Son işlemin sonucu henüz doğrulanmadı.',true);retryView(true);lock();}return;}
  // Supersede only reads: a visible return always gets a fresh generation, even if a former GET remains in flight.
  sequence++;busy=false;void reader();
 }
 win.addEventListener('pagehide',pagehide);win.addEventListener('pageshow',pageshow);doc.addEventListener('visibilitychange',visible);
 const observer=new win.MutationObserver(()=>{if(root.parentNode!==host||!host.isConnected)cleanup();});observer.observe(doc.documentElement,{childList:true,subtree:true});
 function cleanup(){if(!alive)return;clear();alive=false;observer.disconnect();win.removeEventListener('pagehide',pagehide);win.removeEventListener('pageshow',pageshow);doc.removeEventListener('visibilitychange',visible);root.remove();if(mounts.get(host)===cleanup)mounts.delete(host);}
 mounts.set(host,cleanup);return {doc,win,root,body,tools,status,retry,el,button,link,current,active,read,mutate,setReader,say,cleanup,setClear(fn){onClear=fn;},state(value){root.dataset.networkState=value;},lock};
}
export function networkCardNode(surface,profile,options,{detail=false,linked=false}={}){
 const p=networkPublic(profile),{el,link}=surface,card=el('article','np-card');card.dataset.networkCard=p.publicId;
 const mark=el('span','np-monogram',Array.from(p.displayName.trim())[0].toLocaleUpperCase('tr-TR'));mark.setAttribute('aria-hidden','true');card.append(mark);
 const body=el('div','np-card-copy'),field=options.fields.find(x=>x.id===p.field)?.label||'Mesleki alan';body.append(el('p','np-eyebrow',field));const title=el(detail?'h2':'h3');if(linked)title.append(link(p.displayName,'mesleki-ag.html?profil='+encodeURIComponent(p.publicId),'np-card-title'));else title.textContent=p.displayName;body.append(title);
 if(p.cityId){const city=options.cities.find(x=>x.id===p.cityId)?.label;if(city)body.append(el('p','np-card-city',city));}
 if(p.bio)body.append(el('p','np-bio',p.bio));if(linked)body.append(link('Mesleki kartı incele','mesleki-ag.html?profil='+encodeURIComponent(p.publicId)));card.append(body);return card;
}
function addSelect(s,parent,label,name,options,value='',optional=false){const wrap=s.el('label','np-field'),input=s.el('select');input.name=name;const placeholder=s.el('option','','Seç');placeholder.value='';input.append(placeholder);for(const row of options){const o=s.el('option','',row.label);o.value=row.id;input.append(o);}input.value=value;input.required=!optional;wrap.append(s.el('span','',label),input);parent.append(wrap);return input;}
export async function mountNetworkWorkspace({host,api,isCurrent=()=>true,cities,fields}){
 const s=createNetworkSurface({host,api,isCurrent,className:'network-workspace',title:'Mesleki kartın'});let profile=null,options=networkCatalog(null,{cities,fields}),dirty=false;
 s.setClear(()=>{profile=null;dirty=false;});const parseMutation=value=>{if(typeof value?.replayed!=='boolean')fail();return networkPrivate(value.profile);};
 function render(p){profile=p;dirty=false;s.body.replaceChildren();s.tools.replaceChildren();s.tools.append(s.button('Yenile','refresh',load,'np-button np-secondary'));s.state('ready');
  s.body.append(s.el('p','np-lead','Mesleki çalışmalarını kendi seçtiğin bilgilerle tanıt. Bu kart, özel üyelik ve kariyer başvurularından ayrıdır.'));
  const state=s.el('div','np-workspace-state');state.append(s.el('span','np-status-label',p?networkStatuses[p.status]:'Henüz kart oluşturmadın'));if(p?.status==='published')state.append(s.link('Yayımlanan kartı aç','mesleki-ag.html?profil='+p.publicId));s.body.append(state);
  if(p?.reviewNote){const feedback=s.el('aside','np-feedback');feedback.append(s.el('h2','','İnceleme notu'),s.el('p','',p.reviewNote));s.body.append(feedback);}
  const grid=s.el('div','np-editor-grid'),form=s.el('form','np-form');form.id='network-card-form';const fs=s.el('fieldset');fs.append(s.el('legend','','Kart bilgilerin'));
  const nameLabel=s.el('label','np-field'),name=s.el('input');name.name='displayName';name.required=true;name.maxLength=120;name.autocomplete='off';name.value=p?.card.displayName||'';nameLabel.append(s.el('span','','Kamuya görünen ad'),name);fs.append(nameLabel);
  const field=addSelect(s,fs,'Mesleki alan','field',options.fields,p?.card.field||''),city=addSelect(s,fs,'Şehir (isteğe bağlı)','cityId',options.cities,p?.card.cityId||'',true);
  const cityLabel=s.el('label','np-check'),showCity=s.el('input');showCity.type='checkbox';showCity.name='showCity';showCity.checked=p?.card.visibility.city===true;cityLabel.append(showCity,s.el('span','','Şehrim kamuya görünsün'));fs.append(cityLabel);
  const bioLabel=s.el('label','np-field'),bio=s.el('textarea');bio.name='bio';bio.rows=5;bio.maxLength=1600;bio.value=p?.card.bio||'';bioLabel.append(s.el('span','','Mesleki çalışmaların (isteğe bağlı)'),bio,s.el('small','','Telefon, e-posta, bağlantı ve üçüncü kişilere ait bilgi ekleme.'));fs.append(bioLabel);
  const bioVisibility=s.el('label','np-check'),showBio=s.el('input');showBio.type='checkbox';showBio.name='showBio';showBio.checked=p?.card.visibility.bio===true;bioVisibility.append(showBio,s.el('span','','Bu açıklama kamuya görünsün'));fs.append(bioVisibility);
  fs.append(s.el('p','np-note','Görünen ad ve mesleki alan, yayınladığında daima görünür. Şehir ve açıklamayı ayrı ayrı seçebilirsin.'));
  if(p?.status==='published')fs.append(s.el('p','np-notice','Değişikliği kaydettiğinde mevcut yayın kapanır. Yeni sürüm için yeniden rıza ve inceleme gerekir.'));
  const save=s.el('button','np-button np-primary','Taslağı kaydet ve önizle');save.type='submit';save.dataset.networkSave='';fs.append(save);form.append(fs);grid.append(form);
  const aside=s.el('aside','np-preview');aside.dataset.networkPreview='';aside.append(s.el('p','np-eyebrow','YAYIN ÖNİZLEMESİ'),s.el('h2','','İnsanların göreceği kart'));
  if(p){aside.append(networkCardNode(s,p.preview,options),s.el('p','np-note','Kaydedilmiş sürüm '+p.contentRevision+' · Bu önizleme sunucunun yayın görünümüdür.'));}
  else aside.append(s.el('p','np-empty','Bilgilerini kaydettiğinde yalnız görünür seçtiğin alanları burada inceleyebilirsin.'));
  const publication=s.el('div','np-publish-controls');
  if(p&&['draft','changes_requested','withdrawn'].includes(p.status)){
   const label=s.el('label','np-check'),consent=s.el('input');consent.type='checkbox';consent.dataset.networkConsent='';label.append(consent,s.el('span','','Yukarıdaki ad, alan ve seçtiğim bilgilerin kamuya yayımlanması için bu sürümü incelemeye göndermeyi kabul ediyorum.'));publication.append(label);
   const submit=s.button('İncelemeye gönder','submit',()=>{if(dirty||!consent.checked)return;s.mutate('member/network-profile/submit',{expectedRevision:p.revision,contentRevision:p.contentRevision,consent:true},parseMutation,render);},'np-button np-primary');submit.dataset.locked='true';submit.disabled=true;consent.addEventListener('change',()=>{submit.dataset.locked=String(!consent.checked||dirty);s.lock();});publication.append(submit);
  }else if(p?.status==='pending')publication.append(s.el('p','np-note','Gönderdiğin sürüm incelemede. Bir değişiklik kaydetmek bu inceleme ve yayın rızasını kapatır.'));
  if(p&&p.status!=='withdrawn')publication.append(s.button(p.status==='published'?'Yayından kaldır ve rızayı geri çek':'Gönderimi / yayın rızasını geri çek','withdraw',()=>s.mutate('member/network-profile/withdraw',{expectedRevision:p.revision},parseMutation,render),'np-button np-secondary'));
  aside.append(publication);grid.append(aside);s.body.append(grid);
  function changed(){if(!s.active())return;dirty=true;aside.replaceChildren(s.el('h2','','Değişikliklerin henüz kaydedilmedi'),s.el('p','np-note','Güncel yayın önizlemesi ve rıza adımı için taslağını kaydet.'));}
  form.addEventListener('input',changed);form.addEventListener('change',changed);form.addEventListener('submit',event=>{event.preventDefault();if(!s.active()||!form.reportValidity())return;const card={displayName:name.value.trim(),field:field.value,cityId:city.value||null,bio:bio.value.trim()||null,visibility:{city:showCity.checked,bio:showBio.checked}};s.mutate('member/network-profile/save',{expectedRevision:p?.revision||0,card},parseMutation,render);});
 }
 const load=s.setReader(()=>s.read('member/network-profile',undefined,value=>{if(!value||!Object.hasOwn(value,'profile'))fail();options=networkCatalog(value.options);render(value.profile===null?null:networkPrivate(value.profile));}));await load();return s.cleanup;
}

export async function mountNetworkDirectory({host,api,preview=false,recordId=null,cities,fields}){
 const s=createNetworkSurface({host,api,privateView:false,className:'network-directory',title:recordId?'Mesleki kart':'Mesleki ağ'});let options=networkCatalog(null,{cities,fields}),selectedField='',selectedCity='',pages=[''];
 s.setClear(()=>{});
 if(preview){s.state('preview');s.body.append(s.el('p','np-lead','Mesleki ağ, üyelerin ayrı yayın izniyle oluşturduğu kartları bir araya getirir.'),s.el('p','np-empty','Bu önizlemede kişisel kartlar ve profil işlemleri gösterilmez.'),s.link('Atölye defterlerini keşfet','kategori.html?tur=atolye'));return s.cleanup;}
 function renderList(value){const page=networkPage(value);if(typeof page.available!=='boolean'||!exact(page.filters,['field','cityId'])||page.filters.field!==(selectedField||null)||page.filters.cityId!==(selectedCity||null))fail();options=networkCatalog(page.options);s.body.replaceChildren();s.tools.replaceChildren();s.tools.append(s.button('Yenile','refresh',()=>{pages=[''];void load();},'np-button np-secondary'));
  s.body.append(s.el('p','np-lead','Mimarlık ve tasarımın farklı alanlarından, paylaşmayı seçtikleri çalışmalarıyla.'));
  const filters=s.el('form','np-directory-filters');filters.setAttribute('role','search');filters.setAttribute('aria-label','Mesleki kartları filtrele');const field=addSelect(s,filters,'Alan','field',options.fields,selectedField,true),city=addSelect(s,filters,'Şehir','cityId',options.cities,selectedCity,true);field.options[0].textContent='Tüm alanlar';city.options[0].textContent='Tüm şehirler';field.dataset.networkField='';city.dataset.networkCity='';filters.addEventListener('submit',e=>e.preventDefault());
  for(const select of [field,city])select.addEventListener('change',()=>{if(!s.active())return;selectedField=field.value;selectedCity=city.value;pages=[''];void load();});s.body.append(filters);
  const summary=s.el('p','np-result-count',page.profiles.length+' mesleki kart · bu sayfada');summary.setAttribute('role','status');s.body.append(summary);
  if(!page.profiles.length){s.state('empty');s.body.append(s.el('p','np-empty',page.available?'Bu seçimde yayımlanmış mesleki kart yok. Başka bir alan veya şehir seçebilirsin.':'Mesleki ağ şu anda yayına açık değil.'));
  }else{const grid=s.el('div','np-directory-grid');for(const p of page.profiles)grid.append(networkCardNode(s,p,options,{detail:true,linked:true}));s.body.append(grid);s.state('ready');}
  const nav=s.el('nav','np-pagination');nav.setAttribute('aria-label','Mesleki kart sayfaları');if(pages.length>1)nav.append(s.button('Önceki sayfa','previous',()=>{pages.pop();void load();}));if(page.nextCursor)nav.append(s.button('Sonraki sayfa','more',()=>{pages.push(page.nextCursor);void load();}));s.body.append(nav);
 }
 function renderDetail(value){const p=networkPublic(value?.profile);if(p.publicId!==recordId)fail();s.body.replaceChildren();s.tools.replaceChildren();s.tools.append(s.link('Mesleki ağa dön','mesleki-ag.html'));const area=s.el('div','np-detail');area.dataset.networkDetail='';area.append(networkCardNode(s,p,options,{detail:true}),s.el('p','np-note','Bu kart, sahibinin görünür seçtiği ve yayına alınan bilgileri içerir.'));s.body.append(area);s.tools.append(s.button('Yenile','refresh',load,'np-button np-secondary'));s.state('ready');}
 const load=s.setReader(()=>{if(recordId!==null&&!networkId(recordId)){s.state('empty');s.body.replaceChildren(s.el('p','np-empty','Bu mesleki kart bağlantısı geçerli değil.'),s.link('Mesleki ağa dön','mesleki-ag.html'));return Promise.resolve(false);}return recordId?s.read('network-profiles/'+recordId,undefined,renderDetail):s.read('network-profiles',{...(selectedField?{field:selectedField}:{}),...(selectedCity?{cityId:selectedCity}:{}),...(pages.at(-1)?{after:pages.at(-1)}:{})},renderList);});await load();return s.cleanup;
}
