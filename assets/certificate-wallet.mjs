// [codex] 01a20fe2-64d6-75c3-b882-47be7173d5eb · Private, source-backed certificate wallet.
const base='member/certificates';
const statuses={empty:'Telefon henüz doğrulanmadı.',pending:'Doğrulama kodu bekleniyor.',verified:'Telefon doğrulandı.',expired:'Doğrulamanın süresi doldu.',cancelled:'Doğrulama iptal edildi.',delivery_failed:'Kod deneme kutusuna ulaştırılamadı.'};
const id=v=>typeof v==='string'&&/^[a-f0-9]{32}$/.test(v);
const time=v=>typeof v==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/.test(v)&&Number.isFinite(Date.parse(v));
const date=new Intl.DateTimeFormat('tr-TR',{dateStyle:'medium',timeStyle:'short',timeZone:'Europe/Istanbul'});
const mounted=new WeakMap();

export function parseCertificateWallet(value,memberId){
 if(!id(memberId)||value?.memberId!==memberId||typeof value.available!=='boolean'||!time(value.serverNow)||!Array.isArray(value.certificates)||value.certificates.length>500)throw Error('invalid_certificate_wallet');
 const p=value.phone;
 if(!p||!Number.isSafeInteger(p.revision)||p.revision<0||!Object.hasOwn(statuses,p.status)||(p.masked!==null&&(typeof p.masked!=='string'||!/^•••• [0-9]{2}$/.test(p.masked)))||![p.verifiedAt,p.expiresAt,p.retryAt].every(v=>v===null||time(v)))throw Error('invalid_certificate_phone');
 const seen=new Set();
 for(const c of value.certificates){const key=c?.kind+':'+c?.id;
  if(!['current','legacy'].includes(c?.kind)||!id(c.id)||seen.has(key)||typeof c.serial!=='string'||!/^[A-Za-z0-9][A-Za-z0-9._-]{5,79}$/.test(c.serial)||typeof c.eventSlug!=='string'||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(c.eventSlug)||c.eventSlug.length>160||typeof c.eventTitle!=='string'||!c.eventTitle.trim()||c.eventTitle.length>500||!time(c.issuedAt))throw Error('invalid_certificate_record');
  if(Object.keys(c).some(k=>!['kind','id','serial','eventSlug','eventTitle','issuedAt'].includes(k)))throw Error('invalid_certificate_record');seen.add(key);
 }
 return value;
}

/** Root api/onOpen rechecks the active member session; this leaf never handles a bearer or PDF URL. */
export function mountCertificateWallet({host,memberId,api,isCurrent,onOpen}){
 if(!host||!id(memberId)||typeof api!=='function'||typeof isCurrent!=='function')throw Error('invalid_certificate_mount');
 mounted.get(host)?.();
 const doc=host.ownerDocument,win=doc.defaultView;
 const el=(tag,text,cls)=>{const n=doc.createElement(tag);if(text!==undefined&&text!==null)n.textContent=text;if(cls)n.className=cls;return n;};
 const root=el('article',null,'member-panel'),header=el('header',null,'member-section-heading'),body=el('div'),notice=el('p');
 root.dataset.certificateWallet='';header.append(el('h1','Sertifikalarım'),el('p','Doğrulanmış katılım belgelerini hesabında sakla.'));
 notice.setAttribute('role','status');notice.setAttribute('aria-live','polite');root.append(header,notice,body);host.replaceChildren(root);
 let alive=true,terminal=false,sequence=0,writePending=false,intent=null,data=null,page=1,timer=null;
 const active=t=>alive&&!terminal&&isCurrent()&&root.isConnected&&!doc.hidden&&t===sequence;
 const status=text=>{notice.textContent=text;};
 const button=(label,action,fn)=>{const n=el('button',label,'member-button');n.type='button';n.dataset.action=action;n.addEventListener('click',fn);return n;};
 const clear=()=>{win.clearTimeout(timer);timer=null;for(const n of body.querySelectorAll('input'))n.value='';body.replaceChildren();data=null;delete root.dataset.state;};
 function authError(error){return error?.status===401||error?.status===403;}
 function lock(){for(const n of body.querySelectorAll('[data-write],fieldset'))n.disabled=writePending||intent!==null;root.setAttribute('aria-busy',String(writePending));}
 function closeAuthority(){terminal=true;sequence++;intent=null;clear();root.dataset.state='signed-out';status('Hesap erişimi değişti. Hesabını yeniden aç.');}
 function field(fs,label,name,opts){const wrap=el('label'),input=el('input');Object.assign(input,opts);input.name=name;input.required=true;input.autocomplete=name==='currentPassword'?'current-password':name==='proof'?'one-time-code':'off';wrap.append(el('span',label),input);fs.append(wrap);return input;}
 function form(action,title,row,fields){const f=el('form',null,'member-form'),fs=el('fieldset');f.dataset.certificateForm=action;fs.append(el('legend',title));const values={};for(const [name,label,opts]of fields)values[name]=field(fs,label,name,opts);
  const send=el('button',action==='request'?'Kod iste':'Telefonumu doğrula','member-button');send.type='submit';send.dataset.write='';fs.append(send);f.append(fs);
  f.addEventListener('submit',event=>{event.preventDefault();event.stopPropagation();if(!active(sequence)||writePending||intent||!f.reportValidity())return;
   const payload=Object.fromEntries(Object.entries(values).map(([k,n])=>[k,n.value]));for(const input of Object.values(values))input.value='';
   mutate(action,{expectedRevision:row.phone.revision,...payload});});return f;}
 function pendingControls(){if(!intent&&!writePending)return;
  const box=el('section',null,'member-empty');box.dataset.certificatePending='';box.append(el('p',writePending?'İşlemin yanıtı bekleniyor.':'Önceki işlemin sonucu kesinleşmedi. Aynı işlemi yeniden kontrol edebilirsin.'));
  if(intent&&!writePending){box.append(button('Aynı işlemi yeniden dene','retry-write',()=>{if(active(sequence)&&intent&&!writePending)void sendIntent();}));
   box.append(button('Yeniden denemeden vazgeç','dismiss-write',()=>{intent=null;void read('Güncel durum yeniden okunuyor.');}));}
  body.prepend(box);
 }
 function render(row){
  parseCertificateWallet(row,memberId);clear();data=row;root.dataset.state='ready';
  const phone=el('section',null,'member-empty');phone.dataset.certificatePhone='';phone.append(el('h2','Telefon doğrulaması'),el('p',statuses[row.phone.status]));
  if(row.phone.masked)phone.append(el('p',row.phone.masked));
  if(row.phone.expiresAt)phone.append(el('p','Geçerlilik sonu: '+date.format(Date.parse(row.phone.expiresAt))+' (İstanbul).'));
  phone.append(el('p','Telefonun tek başına eski belgeleri açmaz. Önceden doğrulanmış e-posta veya hesabına eklediğin kişisel bilet ile geçmiş sahiplik de doğrulanır.'));
  const email=el('a','E-posta doğrulamamı aç','text-link');email.href='eposta-dogrulama.html';phone.append(email);
  if(!row.available)phone.append(el('p','Telefon doğrulaması bu ortamda kapalı.'));
  if(row.available){phone.append(el('p','Yerel provada yalnız +120255501xx örnek numarası kullanılır. Kod özel deneme kutusuna gider; gerçek mesaj gönderilmez.'));
   if(row.phone.status==='pending')phone.append(form('confirm','Altı haneli kod',row,[['proof','Doğrulama kodu',{type:'text',inputMode:'numeric',pattern:'[0-9]{6}',minLength:6,maxLength:6}]]));
   if(!row.phone.retryAt||Date.parse(row.phone.retryAt)<=Date.parse(row.serverNow))phone.append(form('request','Telefonunu doğrula',row,[['phone','Deneme telefon numarası',{type:'tel',pattern:'\\+120255501[0-9]{2}',maxLength:12,placeholder:'+12025550123'}],['currentPassword','Archify parolan',{type:'password',maxLength:72}]]));
   else phone.append(el('p','Yeni kod için '+date.format(Date.parse(row.phone.retryAt))+' (İstanbul) sonrasını bekle.'));
   if(row.phone.status==='verified'){const b=button('Belgelerimi eşleştir','reconcile',()=>mutate('reconcile',{}));b.dataset.write='';phone.append(b);}
  }
  if(row.phone.status!=='empty'&&row.phone.status!=='cancelled'){const b=button('Telefon doğrulamasını iptal et','cancel',()=>mutate('cancel',{expectedRevision:row.phone.revision}));b.dataset.write='';phone.append(b);}
  body.append(phone);
  const list=el('section');list.dataset.certificateList='';list.append(el('h2','Hesabındaki belgeler'));
  if(!row.certificates.length){list.append(el('p','Hesabına bağlanmış bir belge henüz yok. Bu sonuç geçmişte sertifika almadığın anlamına gelmez.','member-empty'));}
  page=Math.max(1,Math.min(page,Math.ceil(row.certificates.length/20)||1));
  for(const c of row.certificates.slice((page-1)*20,page*20)){
   const card=el('article',null,'member-empty');card.dataset.certificateId=c.id;card.dataset.certificateKind=c.kind;
   card.append(el('p',c.kind==='legacy'?'Kaynaklı geçmiş belge':'Katılım belgesi','member-kicker'),el('h3',c.eventTitle),el('p',c.serial,'member-serial'));
   const t=el('time',date.format(Date.parse(c.issuedAt))+' (İstanbul)');t.dateTime=c.issuedAt;card.append(t);
   if(typeof onOpen==='function')card.append(button('PDF belgesini aç','open-certificate',async()=>{const stamp=sequence;if(!active(stamp)||writePending||intent)return;try{await onOpen({kind:c.kind,id:c.id});if(active(stamp))status('Belge isteğin tamamlandı.');}catch(error){if(!active(stamp))return;if(authError(error))closeAuthority();else status('Belge açılamadı. Güncel durumu yeniden kontrol et.');}}));
   list.append(card);
  }
  if(row.certificates.length>20){const nav=el('nav');nav.setAttribute('aria-label','Sertifika sayfaları');const prev=button('Önceki','previous',()=>{page--;render(data);listFocus();}),next=button('Sonraki','next',()=>{page++;render(data);listFocus();});prev.disabled=page===1;next.disabled=page*20>=row.certificates.length;nav.append(prev,el('span',`${page} / ${Math.ceil(row.certificates.length/20)}`),next);list.append(nav);}
  if(row.certificates.length===500)list.append(el('p','Bu görünüm en son bağlanan 500 belgeyi gösterir.'));
  body.append(list,button('Durumu yenile','refresh',()=>void read()));pendingControls();lock();
  const future=[row.phone.expiresAt,row.phone.retryAt].filter(v=>v&&Date.parse(v)>Date.parse(row.serverNow));
  if(future.length){const stamp=sequence;timer=win.setTimeout(()=>{if(active(stamp))void read();},Math.max(1,Math.min(...future.map(v=>Date.parse(v)-Date.parse(row.serverNow)))+50));}
 }
 function listFocus(){const n=body.querySelector('[data-certificate-list] h2');if(n){n.tabIndex=-1;n.focus();}}
 async function read(note=''){
  const stamp=++sequence;clear();root.dataset.state='loading';status(note||'Hesabındaki belgeler kontrol ediliyor…');
  try{const row=parseCertificateWallet(await api(base),memberId);if(!active(stamp))return;render(row);status(intent?'Önceki işlemin güncel durumu okundu.':note);}
  catch(error){if(!active(stamp))return;if(authError(error)){closeAuthority();return;}clear();root.dataset.state='error';status('Belgeler okunamadı.');body.append(button('Yeniden dene','refresh',()=>void read()));}
 }
 function mutate(action,payload){if(!active(sequence)||writePending||intent)return;intent={action,body:{requestId:win.crypto.randomUUID(),...payload}};void sendIntent();}
 async function sendIntent(){
  if(!intent||writePending||!active(sequence))return;const currentIntent=intent;writePending=true;lock();status('İşlemin kontrol ediliyor…');
  const route=currentIntent.action==='reconcile'?base+'/reconcile':base+'/phone/'+currentIntent.action;
  try{parseCertificateWallet(await api(route,currentIntent.body),memberId);if(intent===currentIntent)intent=null;}
  catch(error){if(!alive||!isCurrent())return;if(authError(error)){closeAuthority();return;}
   if(error?.status>=400&&error.status<500&&intent===currentIntent)intent=null;
   if(!doc.hidden)status(error?.code==='invalid_current_password'?'Parola doğrulanamadı.':error?.status===429?'Deneme sınırına ulaştın. Biraz sonra tekrar dene.':'İşlem tamamlandığı doğrulanamadı.');
  }finally{writePending=false;if(alive&&!terminal&&isCurrent()&&!doc.hidden)void read(intent?'Yanıt kesinleşmedi; otomatik yeniden gönderim yapılmadı.':'Güncel durum alındı.');}
 }
 function hide(){sequence++;clear();root.dataset.state='hidden';status('');}
 function visible(){if(doc.hidden)hide();else if(alive&&!terminal&&isCurrent())void read();}
 function pageshow(){if(alive&&!terminal&&isCurrent()&&!doc.hidden)void read();}
 doc.addEventListener('visibilitychange',visible);win.addEventListener('pagehide',hide);win.addEventListener('pageshow',pageshow);
 const dispose=()=>{if(!alive)return;alive=false;sequence++;intent=null;clear();root.remove();doc.removeEventListener('visibilitychange',visible);win.removeEventListener('pagehide',hide);win.removeEventListener('pageshow',pageshow);if(mounted.get(host)===dispose)mounted.delete(host);};
 mounted.set(host,dispose);void read();return dispose;
}
