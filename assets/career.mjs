// [codex] 01a20fe8-62df-78c3-a20e-1c904d040938 · R15 private career wizard; no field storage or ranking.
import {apiURL,normalizePhone} from './core.mjs';
import {analyticsRequestHeaders,advertisingRequestHeaders} from './analytics.mjs';
// [codex] 01a20fe8-199e-7631-8910-07e7d27b753d · P5 explicit account choice; legacy questions and anonymous submission remain canonical.
import {createCareerAccountChoice,MEMBER_CAREER_ERRORS} from './member-career.mjs';
const doc=document,page=doc.body.dataset.page,preview=doc.querySelector('meta[name="deployment"]')?.content!=='server'||location.protocol==='file:'||location.hostname.endsWith('.github.io');
const company=page==='company-application',form=doc.querySelector(company?'#company-form':'#career-form');
const fields=form?.querySelector(company?'#company-fields':'#career-fields'),status=form?.querySelector(company?'#company-status':'#career-status');
const base=new URL('./',location.href),steps=[...(form?.querySelectorAll('[data-career-step]')||[])].sort((a,b)=>Number(a.dataset.careerStep)-Number(b.dataset.careerStep));
const prev=doc.querySelector('#career-prev'),next=doc.querySelector('#career-next'),send=form?.querySelector('button[type="submit"]');
const requiredStatus=()=>form?.querySelector('#educationStatus')?.value==='student';
const hasInternship=()=>Boolean(form?.querySelector('input[name="positions"][value="internship"]:checked'));
const id=()=>{const a=new Uint8Array(16);crypto.getRandomValues(a);return Array.from(a,x=>x.toString(16).padStart(2,'0')).join('')};
let csrf=null,requestId=id(),busy=false,done=false,stepIndex=0,accountChoice=null;
const messages={invalid_phone:'Geçerli bir telefon numarası gir.',invalid_email:'Geçerli e-posta adresi gir.',invalid_city:'Bir şehir seç.',invalid_positions:'En az bir pozisyon seç.',invalid_fields:'En az bir mesleki alan seç.',class_required:'Sınıfını seç.',internship_period_required:'Staj dönemini belirt.',cv_required:'CV veya portfolyo için PDF ya da HTTPS bağlantısı ekle.',invalid_file:'Dosya boyutunu kontrol et: PDF en çok 10 MB, fotoğraf en çok 3 MB.',invalid_file_type:'CV için PDF, fotoğraf için JPEG veya PNG kullan.',invalid_referenceInfo:'Referans alanına başka bir kişinin telefon veya e-posta bilgisini yazma.',terms_required:'Başvuru açıklamasını okuyup onayla.',contact_consent_required:'Firma başvurusuyla ilgili iletişim seçimini işaretle.',rate_limited:'Çok sık deneme yapıldı. Daha sonra tekrar dene.',idempotency_conflict:'Başvuru bilgileri değişti. Yeniden dene.',invalid_url:'HTTPS ile başlayan geçerli bir bağlantı gir.',invalid_gender:'Cinsiyet alanındaki seçeneklerden birini seç veya boş bırak.',invalid_military:'Askerlik durumu için geçerli bir seçenek seç.',military_not_applicable:'Askerlik alanı yalnız erkek seçimi için kullanılabilir.'};
function show(message,kind=''){if(!status)return;status.textContent=message;status.className='form-status'+(kind?' '+kind:'');if(kind)status.focus();}
Object.assign(messages,MEMBER_CAREER_ERRORS);
function isLocked(){return busy||done||(!preview&&!csrf);}
function updateNavigation(){
 if(!steps.length){if(send)send.disabled=preview||isLocked();return;}
 if(prev)prev.disabled=isLocked()||stepIndex===0;
 if(next){next.hidden=stepIndex===steps.length-1;next.disabled=isLocked();}
 if(send){send.hidden=stepIndex!==steps.length-1;send.disabled=preview||isLocked();}
}
function showStep(index,focus=false){
 if(!steps.length)return;stepIndex=Math.max(0,Math.min(steps.length-1,index));
 if(status?.classList.contains('error'))show('Zorunlu alanları tamamlayarak devam edebilirsin.');
 steps.forEach((step,i)=>{step.hidden=i!==stepIndex;step.setAttribute('aria-hidden',String(i!==stepIndex));});
 const label=steps[stepIndex].querySelector('h2,h3')?.textContent||'Başvuru';
 const progress=doc.querySelector('#career-progress');if(progress){progress.max=steps.length;progress.value=stepIndex+1;progress.setAttribute('aria-valuetext',`${stepIndex+1} / ${steps.length} · ${label}`);}
 const count=doc.querySelector('#career-step-count');if(count)count.textContent=`${String(stepIndex+1).padStart(2,'0')} / ${String(steps.length).padStart(2,'0')}`;
 const heading=doc.querySelector('#career-step-label');if(heading)heading.textContent=label;
 doc.querySelectorAll('[data-career-index]').forEach(item=>{const i=Number(item.dataset.careerIndex);item.classList.toggle('is-active',i===stepIndex);item.classList.toggle('is-complete',i<stepIndex);if(i===stepIndex)item.setAttribute('aria-current','step');else item.removeAttribute('aria-current');});
 updateNavigation();
 if(focus){const title=steps[stepIndex].querySelector('h2,h3');if(title){title.tabIndex=-1;title.focus({preventScroll:true});}const reduce=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;steps[stepIndex].scrollIntoView({behavior:reduce?'auto':'smooth',block:'start'});}
}
function conditionalField(wrapperId,fieldId,visible,required=false,clear=false){
 const wrap=form?.querySelector(wrapperId),field=form?.querySelector(fieldId);if(!field)return;
 if(wrap)wrap.hidden=!visible;field.required=visible&&required;field.disabled=preview||!visible;
 if(!visible){field.setCustomValidity('');if(clear)field.value='';}
}
function updateConditional(){
 if(company||!form)return;
 conditionalField('#class-wrap','#classYear',requiredStatus(),true);
 conditionalField('#internship-wrap','#internshipPeriod',hasInternship(),true);
 const gender=form.querySelector('#gender');
 conditionalField('#military-wrap','#militaryStatus',!gender||gender.value==='male',false,Boolean(gender));
}
function customValidation(){
 if(!form)return;
 for(const field of form.querySelectorAll('input,select,textarea'))field.setCustomValidity('');
 const flag=(field,message)=>{if(field&&!field.matches(':disabled'))field.setCustomValidity(message);};
 const phone=form.querySelector('[name="phone"]');if(phone?.value.trim()&&!normalizePhone(phone.value))flag(phone,messages.invalid_phone);
 if(!form.querySelector('[name="positions"]:checked'))flag(form.querySelector('[name="positions"]'),messages.invalid_positions);
 if(company&&!form.querySelector('[name="fields"]:checked'))flag(form.querySelector('[name="fields"]'),messages.invalid_fields);
 for(const field of form.querySelectorAll('input[type="url"]'))if(field.value.trim()){
  try{const u=new URL(field.value.trim());if(u.protocol!=='https:'||!u.hostname||u.username||u.password)throw Error();}catch{flag(field,messages.invalid_url);}
 }
 if(company)return;
 const ref=form.querySelector('#referenceInfo');if(ref?.value&&/(?:\+?[0-9][ .()\-]*){8,}|@/u.test(ref.value))flag(ref,messages.invalid_referenceInfo);
 const cvField=form.querySelector('#cv'),photoField=form.querySelector('#photo'),cv=cvField?.files?.[0],photo=photoField?.files?.[0];
 if(!cv&&!form.querySelector('#cvUrl')?.value.trim()&&!form.querySelector('#portfolioUrl')?.value.trim())flag(cvField||form.querySelector('#cvUrl'),messages.cv_required);
 if(cv){if(cv.size>10*1024*1024)flag(cvField,messages.invalid_file);else if(cv.type?cv.type!=='application/pdf':!cv.name.toLowerCase().endsWith('.pdf'))flag(cvField,messages.invalid_file_type);}
 if(photo){if(photo.size>3*1024*1024)flag(photoField,messages.invalid_file);else if(photo.type?!['image/jpeg','image/png'].includes(photo.type):!(/\.(jpe?g|png)$/i.test(photo.name)))flag(photoField,messages.invalid_file_type);}
}
function validateStep(index,report=true){
 if(preview)return true;updateConditional();customValidation();
 const scope=steps.length?steps[index]:form;
 const invalid=[...scope.querySelectorAll('input,select,textarea')].find(field=>!field.matches(':disabled')&&!field.checkValidity());
 if(!invalid)return true;
 if(report){if(steps.length)showStep(index);show('Devam etmek için bu adımdaki işaretli alanı kontrol et.','error');invalid.reportValidity();}
 return false;
}
function validateAll(){for(let i=0;i<(steps.length||1);i++)if(!validateStep(i))return false;return true;}
async function call(route,body){
 const result=await fetch(apiURL(route,base),{method:body?'POST':'GET',credentials:'same-origin',cache:'no-store',headers:body?{'Content-Type':'application/json','X-CSRF-Token':csrf,...analyticsRequestHeaders(),...advertisingRequestHeaders()}:undefined,body:body?JSON.stringify(body):undefined});
 const data=await result.json().catch(()=>({error:'network'}));if(!result.ok)throw Object.assign(Error(data.error||'network'),{code:data.error,status:result.status});return data;
}
function payload(){
 const v=new FormData(form),text=n=>String(v.get(n)||'').trim(),check=n=>v.has(n),list=n=>v.getAll(n).map(String);
 const phone=normalizePhone(text('phone'));if(!phone)throw Object.assign(Error('invalid_phone'),{code:'invalid_phone'});
 const common={requestId,phone,email:text('email'),cityId:text('cityId'),positions:list('positions'),termsAccepted:check('termsAccepted')};
 if(company)return {...common,companyName:text('companyName'),contactName:text('contactName'),website:text('website'),fields:list('fields'),requirements:text('requirements'),workplace:text('workplace'),contactConsent:check('contactConsent')};
 const data={...common,name:text('name'),district:text('district'),school:text('school'),field:text('field'),educationStatus:text('educationStatus'),classYear:requiredStatus()?text('classYear'):'',graduationYear:text('graduationYear'),programs:list('programs'),internshipPeriod:hasInternship()?text('internshipPeriod'):'',drivingLicense:text('drivingLicense'),militaryStatus:text('militaryStatus'),salaryExpectation:text('salaryExpectation'),referenceInfo:text('referenceInfo'),about:text('about'),cvUrl:text('cvUrl'),portfolioUrl:text('portfolioUrl'),shareConsent:check('shareConsent')};
 if(form.querySelector('#gender')){data.gender=text('gender')||null;if(data.gender!=='male')data.militaryStatus=null;}
 return data;
}
async function submit(e){
 e.preventDefault();if(preview||!form||fields.disabled||busy||done)return;
 if(steps.length&&stepIndex<steps.length-1){if(validateStep(stepIndex))showStep(stepIndex+1,true);return;}
 if(!validateAll())return;
 let data;try{data=payload();}catch(err){show(messages[err.code]||'Bilgileri kontrol et.','error');return;}
 const cv=form.querySelector('#cv')?.files?.[0],photo=form.querySelector('#photo')?.files?.[0];
 const accountLinked=accountChoice?.selected()===true;
 busy=true;fields.disabled=true;updateNavigation();show('Başvurun güvenli biçimde kaydediliyor…');
 try{
  let response;
  if(accountLinked)response=await accountChoice.submit({company,application:data,cv,photo});
  else if(!company&&(cv||photo)){
   const multi=new FormData();multi.set('payload',JSON.stringify(data));if(cv)multi.set('cv',cv);if(photo)multi.set('photo',photo);
   const req=await fetch(new URL('api/kariyer-dosya.php',base),{method:'POST',credentials:'same-origin',headers:{'X-CSRF-Token':csrf,...analyticsRequestHeaders(),...advertisingRequestHeaders()},body:multi,cache:'no-store'});
   response=await req.json().catch(()=>({error:'network'}));if(!req.ok)throw Object.assign(Error(response.error||'network'),{code:response.error,status:req.status});
  }else response=await call(company?'career/companies':'career/candidates',data);
  if(response.status!=='received'||typeof response.reference!=='string')throw Error('network');
  done=true;accountChoice?.complete();form.reset();fields.hidden=true;form.querySelector('.career-actions')?.setAttribute('hidden','');window.dispatchEvent(new Event('archify:accepted'));
  show((accountLinked?'Başvurun alındı ve hesabına bağlandı. ':'Başvurun alındı. ')+'Archify ekibi değerlendirecek. Referans: '+response.reference,'success');
  if(accountLinked){const link=doc.createElement('a');link.className='text-link';link.href='hesabim.html#member-career';link.textContent='Başvurumu hesabımda gör ↗';status.append(doc.createElement('br'),link);}
 }catch(error){show(messages[error.code]||'Başvurun henüz doğrulanamadı. Aynı bilgilerle tekrar deneyebilirsin.','error');fields.disabled=false;if(error.code==='idempotency_conflict')requestId=id();}
 finally{busy=false;updateNavigation();}
}
async function setup(){
 if(!form||!fields||!status)return;
 form.noValidate=true;form.addEventListener('submit',submit);
 prev?.addEventListener('click',()=>{if(!isLocked())showStep(stepIndex-1,true);});
 next?.addEventListener('click',()=>{if(!isLocked()&&validateStep(stepIndex))showStep(stepIndex+1,true);});
 form.addEventListener('change',()=>{if(!busy&&!done)requestId=id();updateConditional();});
 form.addEventListener('input',()=>{if(!busy&&!done)requestId=id();});
 showStep(0);updateConditional();
 if(preview){fields.disabled=true;updateNavigation();show('Bu test görünümünde adımları gezebilirsin. Kişisel bilgi girilmez, dosya veya başvuru gönderilmez.');return;}
 accountChoice=createCareerAccountChoice({form,base,fetch,headers:()=>({...analyticsRequestHeaders(),...advertisingRequestHeaders()})});
 try{
  const [catalog,sess]=await Promise.all([fetch(new URL('data/community-profiles.json',base),{cache:'no-cache'}).then(r=>{if(!r.ok)throw Error('catalog');return r.json();}),call('session')]);
  csrf=sess.csrfToken;if(typeof csrf!=='string'||!csrf||!Array.isArray(catalog.cities)||!Array.isArray(catalog.schools))throw Error('session');
  const city=form.querySelector('#cityId');if(city)for(const c of catalog.cities){const option=doc.createElement('option');option.value=c.id;option.textContent=c.label;city.append(option);}
  const school=form.querySelector('#school');if(school){const dl=doc.createElement('datalist');dl.id='career-school-options';for(const s of catalog.schools){const o=doc.createElement('option');o.value=s.name;dl.append(o);}school.setAttribute('list',dl.id);school.after(dl);}
  fields.disabled=false;updateConditional();updateNavigation();show(steps.length?'Beş kısa adımda profilini tamamla. Cinsiyet ve paylaşım tercihi isteğe bağlıdır.':'Zorunlu alanları doldur, uygun tercihlerini işaretle.');
 }catch{csrf=null;fields.disabled=true;updateNavigation();show('Başvuru bağlantısı şu anda açılamıyor. Daha sonra tekrar dene.','error');}
}
void setup();
