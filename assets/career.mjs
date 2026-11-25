// [codex] R12 career applications; submitted only to the same origin, never to analytics.
import {apiURL,normalizePhone} from './core.mjs';
import {analyticsRequestHeaders,advertisingRequestHeaders} from './analytics.mjs';
const doc=document,page=doc.body.dataset.page,preview=doc.querySelector('meta[name="deployment"]')?.content==='preview';
const form=doc.querySelector(page==='company-application'?'#company-form':'#career-form');
const company=page==='company-application';
const fields=form?.querySelector('#'+(company?'company':'career')+'-fields');
const status=form?.querySelector('#'+(company?'company':'career')+'-status');
const base=new URL('./',location.href);
const requiredStatus=()=>doc.querySelector('#educationStatus')?.value==='student';
const hasInternship=()=>Boolean(form?.querySelector('input[name="positions"][value="internship"]:checked'));
const id=()=>{const a=new Uint8Array(16);crypto.getRandomValues(a);return Array.from(a,x=>x.toString(16).padStart(2,'0')).join('')};
let csrf=null,requestId=id(),busy=false,done=false;
const messages={invalid_phone:'Geçerli bir telefon numarası gir.',invalid_email:'Geçerli e-posta adresi gir.',invalid_city:'Bir şehir seç.',invalid_positions:'En az bir pozisyon seç.',invalid_fields:'En az bir mesleki alan seç.',class_required:'Sınıfını seç.',internship_period_required:'Staj dönemini belirt.',cv_required:'CV veya portfolyo için PDF ya da HTTPS bağlantısı ekle.',invalid_file:'Dosya yüklenemedi; boyut ve biçim sınırlarını kontrol et.',invalid_file_type:'CV için PDF, fotoğraf için JPEG/PNG kullan.',invalid_referenceInfo:'Referans alanında başka bir kişinin telefon veya e-posta bilgisini kullanma.',terms_required:'Başvuru açıklamasını okuyup onayla.',contact_consent_required:'Firma başvurusuyla ilgili iletişim seçimini işaretle.',rate_limited:'Çok sık deneme yapıldı. Daha sonra tekrar dene.',idempotency_conflict:'Başvuru bilgileri değişti. Yeniden dene.',invalid_url:'HTTPS ile başlayan geçerli bir bağlantı gir.'};
function show(message,kind=''){status.textContent=message;status.className='form-status'+(kind?' '+kind:'');if(kind)status.focus();}
async function call(route,body){
 const result=await fetch(apiURL(route,base),{method:body?'POST':'GET',credentials:'same-origin',cache:'no-store',headers:body?{'Content-Type':'application/json','X-CSRF-Token':csrf,...analyticsRequestHeaders(),...advertisingRequestHeaders()}:undefined,body:body?JSON.stringify(body):undefined});
 const data=await result.json().catch(()=>({error:'network'}));if(!result.ok)throw Object.assign(Error(data.error||'network'),{code:data.error,status:result.status});return data;
}
function payload(){
 const v=new FormData(form),text=n=>String(v.get(n)||'').trim(),check=n=>v.has(n),list=n=>v.getAll(n).map(String);
 const phone=normalizePhone(text('phone'));if(!phone)throw Object.assign(Error('invalid_phone'),{code:'invalid_phone'});
 const common={requestId,phone,email:text('email'),cityId:text('cityId'),positions:list('positions'),termsAccepted:check('termsAccepted')};
 if(company)return {...common,companyName:text('companyName'),contactName:text('contactName'),website:text('website'),fields:list('fields'),requirements:text('requirements'),workplace:text('workplace'),contactConsent:check('contactConsent')};
 return {...common,name:text('name'),district:text('district'),school:text('school'),field:text('field'),educationStatus:text('educationStatus'),classYear:requiredStatus()?text('classYear'):'',graduationYear:text('graduationYear'),programs:list('programs'),internshipPeriod:text('internshipPeriod'),drivingLicense:text('drivingLicense'),militaryStatus:text('militaryStatus'),salaryExpectation:text('salaryExpectation'),referenceInfo:text('referenceInfo'),about:text('about'),cvUrl:text('cvUrl'),portfolioUrl:text('portfolioUrl'),shareConsent:check('shareConsent')};
}
async function submit(e){
 e.preventDefault();if(preview||!form||fields.disabled||busy||done)return;
 if(!form.reportValidity())return;
 let data;try{data=payload();}catch(err){show(messages[err.code]||'Bilgileri kontrol et.','error');return}
 if(!data.positions.length){show(messages.invalid_positions,'error');return}
 if(company&&!data.fields.length){show(messages.invalid_fields,'error');return}
 const cv=form.querySelector('#cv')?.files?.[0],photo=form.querySelector('#photo')?.files?.[0];
 if(!company&&!cv&&!data.cvUrl&&!data.portfolioUrl){show(messages.cv_required,'error');return}
 if(cv&&cv.size>10*1024*1024||photo&&photo.size>3*1024*1024){show(messages.invalid_file,'error');return}
 busy=true;fields.disabled=true;show('Başvurun güvenli biçimde kaydediliyor…');
 try{
  let response;
  if(!company&&(cv||photo)){
   const multi=new FormData();multi.set('payload',JSON.stringify(data));if(cv)multi.set('cv',cv);if(photo)multi.set('photo',photo);
   const req=await fetch(new URL('api/kariyer-dosya.php',base),{method:'POST',credentials:'same-origin',headers:{'X-CSRF-Token':csrf,...analyticsRequestHeaders(),...advertisingRequestHeaders()},body:multi,cache:'no-store'});
   response=await req.json().catch(()=>({error:'network'}));if(!req.ok)throw Object.assign(Error(response.error||'network'),{code:response.error,status:req.status});
  }else response=await call(company?'career/companies':'career/candidates',data);
  if(response.status!=='received'||typeof response.reference!=='string')throw Error('network');
  done=true;form.reset();fields.hidden=true;window.dispatchEvent(new Event('archify:accepted'));
  show('Başvurun alındı. Archify ekibi değerlendirecek. Referans: '+response.reference,'success');
 }catch(error){show(messages[error.code]||'Başvurun henüz doğrulanamadı. Aynı bilgilerle tekrar deneyebilirsin.','error');fields.disabled=false;if(error.code==='idempotency_conflict')requestId=id();}
 finally{busy=false}
}
async function setup(){
 if(!form||!fields||!status)return;
 if(preview){fields.disabled=true;show('Bu yalnız test yayınıdır. Kişisel bilgi veya dosya yüklemez.');return;}
 try{
  const [catalog,sess]=await Promise.all([fetch(new URL('data/community-profiles.json',base),{cache:'no-cache'}).then(r=>{if(!r.ok)throw Error('catalog');return r.json()}),call('session')]);
  csrf=sess.csrfToken;if(typeof csrf!=='string'||!csrf)throw Error('session');
  const city=form.querySelector('#cityId');for(const c of catalog.cities){const option=doc.createElement('option');option.value=c.id;option.textContent=c.label;city.append(option)}
  const school=form.querySelector('#school');if(school){const dl=doc.createElement('datalist');dl.id='career-school-options';for(const s of catalog.schools){const o=doc.createElement('option');o.value=s.name;dl.append(o)}school.setAttribute('list',dl.id);school.after(dl)}
  function update(){if(!company){form.querySelector('#classYear').required=requiredStatus();form.querySelector('#internshipPeriod').required=hasInternship()}}
  form.addEventListener('change',()=>{if(!busy&&!done)requestId=id();update()});form.addEventListener('input',()=>{if(!busy&&!done)requestId=id()});
  form.addEventListener('submit',submit);update();fields.disabled=false;show('Zorunlu alanları doldur, uygun tercihlerini işaretle.');
 }catch{show('Başvuru bağlantısı şu anda açılamıyor. Daha sonra tekrar dene.','error')}
}
void setup();
