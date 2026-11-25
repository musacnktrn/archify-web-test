// [codex] R13 moderated event experience; bearer only in same-origin feedback POST, no analytics fields.
import {apiURL} from './core.mjs';
const page=document.body.dataset.page,preview=document.querySelector('meta[name="deployment"]')?.content==='preview',base=new URL('./',location.href);
const q=s=>document.querySelector(s);
async function get(route){const r=await fetch(apiURL(route,base),{credentials:'same-origin',cache:'no-store'});if(!r.ok)throw Error('not_available');return r.json();}
if(page==='detail'){
 const section=q('#event-feedback'),summary=q('#feedback-summary'),list=q('#feedback-list');
 if(preview){summary.textContent='Test yayını · canlı yorumlar gösterilmez.';}
 else {const slug=new URLSearchParams(location.search).get('slug');if(!slug||!/^[a-z0-9-]{1,100}$/.test(slug)){section.hidden=true;}
 else void get('feedback/event/'+slug).then(data=>{
  if(!Array.isArray(data.comments)||!Number.isInteger(data.count))throw Error('invalid_feedback');
  summary.textContent=data.count?`${data.count} yayımlanmış yorum · ${Number(data.average).toLocaleString('tr-TR')} / 5`:'Henüz yayımlanmış katılımcı yorumu yok.';
  for(const item of data.comments){const card=document.createElement('article'),rating=document.createElement('p'),name=document.createElement('h3'),body=document.createElement('p');rating.className='feedback-rating';rating.textContent=`${item.rating} / 5 · Doğrulanmış katılım`;name.textContent=item.displayName;body.textContent=item.comment;card.append(rating,name,body);list.append(card);}
 }).catch(()=>{summary.textContent='Yorumlar şu anda görüntülenemiyor.';});}
}
if(page==='ticket'&&!preview){
 const section=q('#feedback-ticket'),form=q('#feedback-form'),fields=q('#feedback-fields'),status=q('#feedback-status');let done=false;
 const sync=()=>{const ready=!q('#ticket-receipt').hidden&&q('#ticket-certificate')&&!q('#ticket-certificate').hidden;if(ready){section.hidden=false;fields.disabled=done;}else {section.hidden=true;fields.disabled=true;}};
 const observer=new MutationObserver(sync);observer.observe(q('#ticket-receipt'),{attributes:true,subtree:true,attributeFilter:['hidden']});sync();
 form.addEventListener('submit',async e=>{e.preventDefault();if(fields.disabled||done)return;const token=q('#ticket-token').value.trim();if(!/^[a-f0-9]{64}$/.test(token)){status.textContent='Önce biletini tekrar doğrula.';return;}
  const data={token,rating:Number(q('#feedback-rating').value),displayName:q('#feedback-name').value.trim(),comment:q('#feedback-comment').value.trim(),publicConsent:q('#feedback-consent').checked};fields.disabled=true;status.textContent='Yorum incelemeye gönderiliyor…';
  try{const s=await get('session');const r=await fetch(apiURL('feedback/submit',base),{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json','X-CSRF-Token':s.csrfToken},body:JSON.stringify(data)});const out=await r.json();if(!r.ok)throw Error(out.error);done=true;status.textContent=out.status==='approved'?'Yorumun yayımlandı.':out.status==='rejected'?'Yorumun incelendi ve yayımlanmadı.':'Yorumun alındı. İnceleme sonrası yayımlanabilir.';form.reset();}catch(err){status.textContent=err.message==='feedback_contact_not_allowed'?'İletişim bilgisi veya bağlantı eklemeden tekrar dene.':err.message==='feedback_already_submitted'?'Bu biletle daha önce yorum gönderilmiş.':'Yorum kaydedilemedi. Biletini ve katılım durumunu kontrol et.';fields.disabled=false;}
 });
}
