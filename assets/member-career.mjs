// [codex] 01a20fe8-199e-7631-8910-07e7d27b753d · P5 explicit career ownership; memory only, separate member CSRF.
import {escapeHTML as esc} from './core.mjs';

const fail=(code,status=0)=>Object.assign(new Error(code),{code,status});
export const MEMBER_CAREER_ERRORS=Object.freeze({
 member_authentication_required:'Üye oturumun sona erdi. Hesabına yeniden giriş yapıp bu başvuruyu tekrar gönder.',
 member_session_changed:'Giriş yapılan hesap değişti. Başvurun gönderilmedi. Doğru hesapla giriş yaptıktan sonra bu sayfayı yenile.',
 member_choice_changed:'Hesaba bağlama tercihin değişti. Tercihini kontrol edip yeniden gönder.',
 member_unavailable:'Hesaba bağlı başvuru şu anda tamamlanamıyor. Bilgilerin korunuyor; daha sonra yeniden deneyebilirsin.',
 request_verification:'Üye oturumunun güvenliği doğrulanamadı. Aynı hesapla girişini kontrol edip yeniden dene.',
 career_application_exists:'Bu başvuru daha önce alınmış ve bu hesaba bağlanamıyor. Önceki başvurular otomatik olarak aktarılmaz.',
 invalid_member_career:'Hesaba bağlama tercihi doğrulanamadı. Sayfayı yenileyip yeniden dene.'
});

function sessionMember(value){
 if(value?.available!==true)return null;
 if(!value.member)return null;
 if(!/^[a-f0-9]{32}$/.test(value.member.id)||typeof value.csrfToken!=='string'||!value.csrfToken||value.csrfToken.length>512)throw fail('network');
 const name=value.member.displayName;
 return {id:value.member.id,csrf:value.csrfToken,name:typeof name==='string'&&[...name].length<=120?name:''};
}

/** Choice is bound to the account displayed at initialization, never inferred from application fields. */
export function createCareerAccountChoice({form,preview=false,base,fetch:fetcher=globalThis.fetch,headers=()=>({}),FormData:Multipart=globalThis.FormData,timeout=12000}={}){
 const host=form?.querySelector('#career-account-choice'),choice=form?.querySelector('#career-link-account');
 let bound=null,generation=0,disposed=false,pending=false;
 const controllers=new Set();
 if(host)host.hidden=true;
 if(choice){choice.disabled=true;choice.checked=false;}
 const changed=()=>{generation++;};choice?.addEventListener('change',changed);
 const endpoint=route=>{const u=new URL('api/member.php',base);u.searchParams.set('r',route);return u;};
 async function request(url,options={}){
  if(preview||disposed)throw fail('preview');
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeout);controllers.add(controller);
  try{
   const response=await fetcher(url,{method:'GET',credentials:'same-origin',cache:'no-store',redirect:'error',...options,signal:controller.signal});
   const value=await response.json().catch(()=>{throw fail('network');});
   if(!response.ok)throw fail(typeof value?.error==='string'?value.error:'network',response.status);
   return value;
  }catch(error){if(error.code)throw error;throw fail('network');}
  finally{clearTimeout(timer);controllers.delete(controller);}
 }
 const ready=(async()=>{
  if(preview||!host||!choice)return false;
  try{
   const value=await request(endpoint('member/session')),member=sessionMember(value);
   if(disposed||!member)return false;
   bound=member;host.hidden=false;choice.disabled=false;
   const note=form.ownerDocument.createElement('p');note.id='career-account-status';note.className='career-note';note.setAttribute('role','status');
   note.textContent=member.name?`Açık hesabın: ${member.name}. Bu tercih isteğe bağlıdır.`:'Açık Archify hesabına bağlamak isteğe bağlıdır.';
   host.append(note);return true;
  }catch{return false;}
 })();
 function checkChoice(version,memberId){
  if(preview||disposed||!choice?.checked||generation!==version)throw fail('member_choice_changed');
  if(!bound||bound.id!==memberId)throw fail('member_session_changed');
 }
 async function verify(version,memberId){
  checkChoice(version,memberId);
  const value=await request(endpoint('member/session'));
  checkChoice(version,memberId);
  if(value?.available!==true)throw fail('member_unavailable');
  const member=sessionMember(value);
  if(!member)throw fail('member_authentication_required');
  if(member.id!==memberId)throw fail('member_session_changed');
  return member;
 }
 return {
  ready,
  selected:()=>Boolean(choice?.checked),
  async submit({company=false,application,cv,photo}={}){
   if(preview||disposed||pending||!choice?.checked||!bound)throw fail('invalid_member_career');
   // Capture the exact private body once. Retries keep the same requestId and files.
   const encoded=JSON.stringify({linkToAccount:true,application}),version=generation,memberId=bound.id;
   pending=true;choice.disabled=true;
   try{
    let member=await verify(version,memberId);
    for(let attempt=0;attempt<2;attempt++){
     checkChoice(version,memberId);
     let body=encoded,url=endpoint(company?'member/career/companies':'member/career/candidates');
     const requestHeaders={...headers(),'X-CSRF-Token':member.csrf};
     if(!company&&(cv||photo)){
      body=new Multipart();body.set('payload',encoded);if(cv)body.set('cv',cv);if(photo)body.set('photo',photo);
      url=new URL('api/member-kariyer-dosya.php',base);
     }else requestHeaders['Content-Type']='application/json';
     try{return await request(url,{method:'POST',headers:requestHeaders,body});}
     catch(error){
      if(error.code!=='request_verification'||attempt!==0)throw error;
      member=await verify(version,memberId);
     }
    }
   }finally{pending=false;if(choice&&!disposed)choice.disabled=!bound;}
  },
  complete(){generation++;bound=null;if(choice){choice.checked=false;choice.disabled=true;}if(host)host.hidden=true;},
  dispose(){disposed=true;generation++;bound=null;choice?.removeEventListener('change',changed);if(choice){choice.checked=false;choice.disabled=true;}if(host)host.hidden=true;for(const controller of controllers)controller.abort();}
 };
}

const statusLabel={received:'Başvuru alındı',in_review:'Değerlendiriliyor',closed:'Değerlendirme kapandı'};
const dateLabel=value=>typeof value==='string'&&Number.isFinite(Date.parse(value))?new Intl.DateTimeFormat('tr-TR',{day:'numeric',month:'long',year:'numeric',timeZone:'Europe/Istanbul'}).format(new Date(value)):'Tarih gösterilemiyor';
export function memberCareerMarkup(career){
 const available=career?.available===true,rows=available&&Array.isArray(career.linked)?career.linked:[];
 const cards=rows.filter(row=>row&&['candidate','company'].includes(row.kind)&&Object.hasOwn(statusLabel,row.status)&&new RegExp(row.kind==='candidate'?'^KRY-[0-9A-F]{16}$':'^FIR-[0-9A-F]{16}$').test(row.reference)).map(row=>`<article class="member-event" data-member-career-record><p class="member-kicker">${row.kind==='candidate'?'ADAY BAŞVURUSU':'FİRMA BAŞVURUSU'}</p><h3>${statusLabel[row.status]}</h3><p class="member-serial">${esc(row.reference)}</p><p>Başvuru: <time datetime="${esc(row.createdAt)}">${esc(dateLabel(row.createdAt))}</time></p><p>Son güncelleme: <time datetime="${esc(row.updatedAt)}">${esc(dateLabel(row.updatedAt))}</time></p></article>`).join('');
 return `<section id="member-career" class="member-panel" aria-labelledby="member-career-heading"><div class="member-section-heading"><div><p class="member-kicker">BİR SONRAKİ ADIMIN</p><h2 id="member-career-heading">Kariyer başvuruların</h2></div><p>Yalnız bu hesaba bağlamayı seçtiğin başvurular burada görünür. Önceki başvurular kendiliğinden aktarılmaz.</p></div>${!available?'<p class="member-notice" role="status">Hesabına bağlı kariyer kayıtlarına şu anda ulaşılamıyor. Yenile düğmesiyle tekrar kontrol edebilirsin.</p>':cards?`<div class="member-event-grid">${cards}</div>`:'<div class="member-empty"><span class="member-empty-mark" aria-hidden="true">↗</span><h3>Kariyerine yeni bir yön ver.</h3><p>Hesabına bağlı bir başvuru henüz yok. Yeni bir başvuru gönderirken hesabında takip etme seçeneğini işaretleyebilirsin.</p></div>'}<div class="member-event-grid"><article class="member-event"><p class="member-kicker">01 / ADAY</p><h3>Üreteceğin yeri bul.</h3><p>Mesleki ilgini, deneyimini ve portfolyonu paylaş.</p><div class="member-event-actions"><a class="member-text-link" href="kariyer-basvuru.html">Aday başvurusu oluştur ↗</a></div></article><article class="member-event"><p class="member-kicker">02 / FİRMA</p><h3>Ekibine yeni bir bakış.</h3><p>İş veya staj pozisyonun için aradığın deneyimi anlat.</p><div class="member-event-actions"><a class="member-text-link" href="firma-basvuru.html">Firma başvurusu oluştur ↗</a></div></article></div><p class="member-form-note">Başvuru durumu bir işe yerleşme veya firma eşleşmesi sonucu değildir. CV, iletişim bilgileri ve form yanıtların bu özette gösterilmez.</p></section>`;
}
