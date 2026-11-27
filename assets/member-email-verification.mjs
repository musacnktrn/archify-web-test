// [codex] 01a20fd9 · Signed-in account verification. The shared member workspace rechecks the active account.
const path='member/email-verification';
const statuses={
 empty:'Henüz bir adres eklemedin.',pending:'Doğrulama kodu bekleniyor.',verified:'E-posta adresin doğrulandı.',
 expired:'Kodun süresi doldu.',cancelled:'Doğrulama talebini iptal ettin.',delivery_failed:'Kod deneme kutusuna ulaştırılamadı.'
};
const formatter=new Intl.DateTimeFormat('tr-TR',{timeZone:'Europe/Istanbul',dateStyle:'medium',timeStyle:'short'});
function validTime(value){return typeof value==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/.test(value)&&Number.isFinite(Date.parse(value));}

export async function mountEmailVerification({host,memberId,api,isCurrent}){
 const doc=host.ownerDocument,win=doc.defaultView;
 function element(tag,text,cls){const node=doc.createElement(tag);if(text)node.textContent=text;if(cls)node.className=cls;return node;}
 const root=element('article',null,'email-verification'),head=element('header'),body=element('div'),notice=element('p',null,'ev-status');
 head.append(element('h1','E-posta doğrulaması'),element('p','Kendi hesabında kullanacağın adresi doğrula.','ev-lead'));
 notice.setAttribute('role','status');notice.setAttribute('aria-live','polite');root.append(head,notice,body);host.replaceChildren(root);
 let live=true,sequence=0,busy=false,expiryTimer=null,retryTimer=null;
 function stopTimers(){win.clearTimeout(expiryTimer);win.clearTimeout(retryTimer);}
 const current=token=>live&&isCurrent()&&root.isConnected&&!doc.hidden&&token===sequence;
 function setStatus(text){notice.textContent=text;}
 function setBusy(value){busy=value;root.setAttribute('aria-busy',String(value));for(const n of body.querySelectorAll('fieldset,button'))n.disabled=value;}
 function field(group,label,name,options){
  const wrap=element('label'),input=element('input');Object.assign(input,options);input.name=name;input.required=true;input.spellcheck=false;input.setAttribute('autocapitalize','none');wrap.append(element('span',label),input);group.append(wrap);return input;
 }
 function button(label,action){const b=element('button',label,'ev-button');b.type=action?'button':'submit';if(action)b.addEventListener('click',action);return b;}
 function valid(row){
  return row?.memberId===memberId&&typeof row.available==='boolean'&&Number.isSafeInteger(row.revision)&&row.revision>=0&&Object.hasOwn(statuses,row.status)&&validTime(row.serverNow)
   &&(row.email===null||typeof row.email==='string'&&row.email.length<=254)&&[row.verifiedAt,row.expiresAt,row.retryAt].every(t=>t===null||validTime(t));
 }
 function render(row){
  if(!valid(row))throw Error('invalid_verification_state');
  stopTimers();body.replaceChildren();root.dataset.state=row.status;
  const summary=element('section',null,'ev-summary');
  summary.append(element('h2',statuses[row.status]));if(row.email)summary.append(element('p',row.email,'ev-address'));
  if(row.status==='pending'&&row.expiresAt)summary.append(element('p','Kodun son kullanım zamanı '+formatter.format(Date.parse(row.expiresAt))+' (İstanbul).'));
  if(row.status==='verified'&&row.verifiedAt)summary.append(element('p','Doğrulama zamanı '+formatter.format(Date.parse(row.verifiedAt))+' (İstanbul).'));
  body.append(summary);
  const server=Date.parse(row.serverNow),waiting=row.retryAt&&Date.parse(row.retryAt)>server;
  if(!row.available){summary.append(element('p','E-posta doğrulama hizmeti bu ortamda kapalı.'));}
  if(row.status==='pending'){
   if(row.available){
    const form=element('form',null,'ev-form'),fs=element('fieldset');form.dataset.action='confirm';
    fs.append(element('legend','Doğrulama kodunu gir'));
    const input=field(fs,'64 karakterli kod','proof',{type:'password',minLength:64,maxLength:64,pattern:'[a-f0-9]{64}'});
    input.autocomplete='one-time-code';fs.append(button('Adresimi doğrula'));form.append(fs);body.append(form);
    form.addEventListener('submit',e=>{e.preventDefault();if(busy||!form.reportValidity())return;const proof=input.value;input.value='';void mutate('confirm',row,{proof});});
   }
   const cancel=button('Bekleyen talebi iptal et',()=>{if(!busy)void mutate('cancel',row,{});});cancel.dataset.action='cancel';body.append(cancel);
  }
  if(row.available){
   const form=element('form',null,'ev-form'),fs=element('fieldset');form.dataset.action='request';fs.append(element('legend',row.status==='empty'?'Adres ekle':'Yeni doğrulama talebi'));
   fs.append(element('p','Yerel provada .test ile biten bir örnek adres kullan. Kod bu bilgisayardaki deneme kutusuna gider.'));
   const email=field(fs,'Deneme e-posta adresi','email',{type:'email',maxLength:254,placeholder:'ornek@archify.test'});email.autocomplete='off';
   const password=field(fs,'Mevcut Archify parolan','currentPassword',{type:'password',maxLength:255});password.autocomplete='current-password';
   fs.append(button('Doğrulama kodu iste'));form.append(fs);body.append(form);
   if(waiting){
    const hint=element('p','Yeni kodu '+formatter.format(Date.parse(row.retryAt))+' (İstanbul) sonrasında isteyebilirsin.');
    form.hidden=true;form.before(hint);
    const token=sequence;retryTimer=win.setTimeout(()=>{if(current(token)&&form.isConnected){form.hidden=false;hint.remove();}},Date.parse(row.retryAt)-server+50);
   }
   form.addEventListener('submit',e=>{e.preventDefault();if(busy||!form.reportValidity())return;const address=email.value.trim();if(!/\.test$/i.test(address)){setStatus('Bu deneme için .test ile biten bir adres kullan.');email.focus();return;}
    const currentPassword=password.value;password.value='';void mutate('request',row,{email:address,currentPassword});});
  }
  body.append(button('Durumu yenile',()=>{if(!busy)void read();}));
  if(row.status==='pending'&&row.expiresAt){
   const token=sequence;expiryTimer=win.setTimeout(()=>{if(current(token)&&!busy)void read();},Math.max(1,Date.parse(row.expiresAt)-server+50));
  }
 }
 function clear(){stopTimers();for(const input of body.querySelectorAll('input'))input.value='';body.replaceChildren();delete root.dataset.state;}
 async function read(note=''){
  const token=++sequence;clear();setBusy(true);setStatus('Hesabın ve doğrulama durumu kontrol ediliyor…');
  try{const row=await api(path);if(current(token)){render(row);setStatus(note);}}
  catch{if(current(token)){clear();setStatus('Hesap durumu okunamadı.');body.append(button('Yeniden dene',()=>void read()));}}
  finally{if(current(token))setBusy(false);}
 }
 async function mutate(action,row,values){
  const token=sequence;if(busy||!current(token))return;
  stopTimers();setBusy(true);setStatus('İşlemin kontrol ediliyor…');
  try{
   const result=await api(path+'/'+action,{...values,expectedRevision:row.revision,requestId:win.crypto.randomUUID()});
   if(current(token)){render(result);setStatus(result.status==='delivery_failed'?statuses.delivery_failed:action==='confirm'?'Adres hesabında doğrulandı.':action==='cancel'?'Talep iptal edildi.':'Talebin güncellendi.');}
  }catch(e){if(current(token)){
   const message=e?.code==='invalid_current_password'?'Mevcut parola doğrulanamadı.':e?.status===429?'Deneme sınırına ulaştın. Daha sonra tekrar deneyebilirsin.':action==='confirm'&&[409,422].includes(e?.status)?'Kod doğrulanamadı. Güncel talebi ve süreyi kontrol et.':'İşlem doğrulanamadı. Güncel hesap durumu yeniden okunuyor.';
   await read(message);
  }}finally{if(current(token))setBusy(false);}
 }
 await read();return ()=>{live=false;sequence++;clear();root.remove();};
}
