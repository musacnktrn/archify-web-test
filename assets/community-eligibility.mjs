// [codex] 01a20fe8-199e-7631-8910-07e7d27b753d · R12 profile eligibility; no browser profile persistence
import {escapeHTML as esc,normalizePhone,errorMessage} from './core.mjs';
export const COMMUNITY_VERSION='r12-1';
const TYPES=['student','graduate','professional','other'],FIELDS=['architecture','interior-architecture','landscape-architecture','urban-planning','other'];
export const COMMUNITY_ERRORS=Object.freeze({profile_required:'Önce durumunu, alanını ve şehrini seç.',invalid_status:'Öğrencilik veya çalışma durumunu seç.',invalid_field:'Bölümünü veya meslek alanını seç.',invalid_city:'Listeden geçerli bir şehir seç.',invalid_school:'Okulunu seç veya listede yoksa okul adını yaz.',school_city_mismatch:'Seçtiğin okulun şehri ile şehir seçimin uyuşmuyor. Okulunu ve eğitim aldığın şehri kontrol et.',group_not_eligible:'Bu grup mevcut profilin için uygun görünmüyor. Önerileri yeniden kontrol et.',invalid_profile:'Profil alanlarını kontrol edip yeniden dene.'});
const failure=code=>({ok:false,code,message:COMMUNITY_ERRORS[code]||COMMUNITY_ERRORS.invalid_profile});
export function normalizeCommunityProfile(input,data){
 if(!input||!data||data.version!==COMMUNITY_VERSION)return failure('profile_required');
 if(!TYPES.includes(input.status))return failure('invalid_status');
 if(!FIELDS.includes(input.field))return failure('invalid_field');
 if(!data.cities.some(city=>city.id===input.cityId))return failure('invalid_city');
 const profile={status:input.status,field:input.field,cityId:input.cityId};let school=null,requiresReview=false;
 if(['student','graduate'].includes(profile.status)){
  if(input.schoolId&&input.schoolId!=='manual'){
   school=data.schools.find(item=>item.id===input.schoolId);if(!school)return failure('invalid_school');profile.schoolId=school.id;
   if(profile.status==='student'&&school.cityId&&school.cityId!==profile.cityId)return failure('school_city_mismatch');
  }else{
   const name=typeof input.schoolName==='string'?input.schoolName.trim():'';if(!name||[...name].length>160||/[\u0000-\u001f\u007f]/.test(name))return failure('invalid_school');profile.schoolName=name;
  }
  requiresReview=profile.status==='student'&&!school?.cityId;
 }
 return {ok:true,profile,requiresReview};
}
// Used only for clearly labeled, non-personal static-preview examples. Live recommendations always come from the server.
export function previewCommunityRecommendations(input,data,groups){
 const checked=normalizeCommunityProfile(input,data);if(!checked.ok)return {...checked,groups:[]};
 const p=checked.profile,fieldGroups={'architecture':'mimarlar','interior-architecture':'ic-mimarlar','landscape-architecture':'peyzaj-mimarlar','urban-planning':'sehir-bolge-planlama'},ids=new Set(['duyuru']);
 if(fieldGroups[p.field])ids.add(fieldGroups[p.field]);
 if(!checked.requiresReview){if(['istanbul','ankara','izmir','bursa','antalya'].includes(p.cityId))ids.add(p.cityId);if(data.regionCities.karadeniz.includes(p.cityId))ids.add('karadeniz');if(['azerbaycan','kibris','dis-yurtdisi'].includes(p.cityId))ids.add('yurtdisi');if(['azerbaycan','kibris'].includes(p.cityId))ids.add(p.cityId);}
 return {...checked,groups:groups.filter(group=>ids.has(group.id))};
}
export function publicEligibilityResponse(value,catalog){
 if(!value||!Array.isArray(value.groups)||typeof value.requiresReview!=='boolean'||!value.profile||typeof value.profile!=='object')throw new Error('invalid_eligibility_response');
 const ids=new Set(),known=new Map(catalog.map(g=>[g.id,g]));
 const groups=value.groups.flatMap(g=>{if(!g||!known.has(g.id)||ids.has(g.id))return [];ids.add(g.id);const item=known.get(g.id);return [{id:item.id,name:item.name,category:item.category,city:item.city,description:item.description}];});
 return {groups,requiresReview:value.requiresReview};
}
export async function setupCommunityEligibility({document,preview,profiles,groups,request,session,params=new URLSearchParams(),crypto=globalThis.crypto}={}){
 const q=s=>document.querySelector(s),profileForm=q('#community-profile-form'),profileFields=q('#community-profile-fields'),form=q('#application-form'),fields=q('#application-fields');
 if(!profileForm||!profileFields||!form||!fields)return null;
 const profileStatus=q('#community-profile-status'),status=q('#form-status'),retry=q('#retry-application'),recommendations=q('#community-recommendations');
 let profile=null,eligible=[],selected=null,payload=null,requestId=null,inFlight=false,completed=false,uncertain=false,revision=0,requiresReview=false;
 const profileMessage=(text,kind='')=>{profileStatus.textContent=text;profileStatus.className=kind;};
 const formMessage=(text,kind='',focus=false)=>{status.textContent=text;status.className='form-status '+kind;if(focus)status.focus();};
 const selectMarkup=(items,key='label')=>'<option value="">Seç</option>'+items.map(item=>`<option value="${esc(item.id)}">${esc(item[key])}</option>`).join('');
 q('#profile-status').innerHTML=selectMarkup(profiles.statuses);q('#profile-field').innerHTML=selectMarkup(profiles.fields);q('#profile-city').innerHTML=selectMarkup(profiles.cities);q('#profile-school').innerHTML=selectMarkup(profiles.schools,'name')+'<option value="manual">Okulum listede yok</option>';
 // [codex] 01a20fd9 · A public school link preselects only its canonical school.
 const schoolHints=params.getAll('okul');
 const hintedSchool=!preview&&schoolHints.length===1?profiles.schools.find(s=>s.id===schoolHints[0]):null;
 if(hintedSchool)q('#profile-school').value=hintedSchool.id;
 fields.disabled=true;profileFields.disabled=preview;retry.hidden=true;
 const readProfile=()=>({status:q('#profile-status').value,field:q('#profile-field').value,cityId:q('#profile-city').value,schoolId:q('#profile-school').value,schoolName:q('#profile-school-name').value});
 const conditionalFields=()=>{const needed=['student','graduate'].includes(q('#profile-status').value),manual=needed&&q('#profile-school').value==='manual';q('#profile-school-section').hidden=!needed;q('#profile-school-manual').hidden=!manual;q('#profile-school').required=needed;q('#profile-school-name').required=manual;};
 const clearSelection=()=>{selected=null;profile=null;eligible=[];payload=null;requestId=null;completed=false;fields.disabled=true;fields.hidden=false;recommendations.innerHTML='';q('#community-selection').innerHTML='';retry.hidden=true;formMessage(preview?'Test yayınında kişisel bilgi alınmaz; başvuru gönderimi kapalıdır.':'Önce profilini kontrol et ve önerilen topluluklardan birini seç.');};
 const cards=()=>{recommendations.innerHTML=eligible.map(group=>`<article class="community-choice" data-selected="${selected?.id===group.id}"><p class="eyebrow">${esc(group.category)}</p><h3>${esc(group.name)}</h3><p>${esc(group.description)}</p><button type="button" class="button button-secondary" data-community-group="${esc(group.id)}" data-analytics-target="community-group-select" aria-pressed="${selected?.id===group.id}"${inFlight||uncertain?' disabled':''}>${selected?.id===group.id?'Seçildi':'Bu grubu seç'}<span class="visually-hidden">: ${esc(group.name)}</span></button></article>`).join('')||'<p>Bu profil için şu anda önerilebilen bir topluluk bulunmuyor.</p>';recommendations.querySelectorAll('[data-community-group]').forEach(button=>button.addEventListener('click',()=>selectGroup(button.dataset.communityGroup)));};
 function selectGroup(id){
  if(inFlight||uncertain)return false;const group=eligible.find(item=>item.id===id);if(!group)return false;
  selected=group;payload=null;requestId=null;completed=false;fields.hidden=false;fields.disabled=preview;retry.hidden=true;cards();
  q('#community-selection').innerHTML=`<h3>${esc(group.name)}</h3><p>Başvurun yalnız seçtiğin topluluk için değerlendirilir. Gruba otomatik katılım veya mesaj gönderimi yapılmaz.</p>${requiresReview?'<p class="community-review-note">Okul ve şehir bilginin ekip tarafından incelenmesi gerekiyor. Şehir ve bölge grupları otomatik önerilmedi.</p>':''}`;
  if(q('#application-group'))q('#application-group').innerHTML=`<h2>${esc(group.name)}</h2><p>${esc(group.description)}</p>`;
  formMessage(preview?'Bu seçim örnektir. Test yayını kişisel bilgi kabul etmez ve başvuru göndermez.':'Adını ve telefonunu yalnız bu topluluk başvurusunun değerlendirilmesi için kullanacağız.');return true;
 }
 async function eligibility(){
  if(preview||inFlight||uncertain)return;
  conditionalFields();const checked=normalizeCommunityProfile(readProfile(),profiles);if(!checked.ok){clearSelection();profileMessage(checked.message,'error');profileStatus.focus();return;}
  const current=++revision;clearSelection();profileFields.disabled=true;profileMessage('Katılabileceğin topluluklar kontrol ediliyor…');
  try{
   await session();let result;
   try{result=await request('community/eligibility',{profile:checked.profile});}catch(error){if(['request_verification','csrf_invalid','invalid_csrf'].includes(error.code)){await session();result=await request('community/eligibility',{profile:checked.profile});}else throw error;}
   if(current!==revision)return;const response=publicEligibilityResponse(result,groups);profile=checked.profile;eligible=response.groups;requiresReview=response.requiresReview;
   profileMessage(requiresReview?'Okul bilgisi inceleme gerektiriyor. Alanına uygun ve genel toplulukları seçebilirsin.':'Katılabileceğin topluluklar aşağıda. Başvurmak istediğin grubu seç.');cards();
   const requested=params.get('grup');if(requested&&eligible.some(g=>g.id===requested))selectGroup(requested);else if(requested)profileMessage('Bağlantıdaki grup bu profil için önerilmedi. Aşağıdaki uygun topluluklardan birini seç.');
  }catch(error){if(current===revision){clearSelection();profileMessage(COMMUNITY_ERRORS[error.code]||'Topluluk önerileri şu anda alınamıyor. Bilgilerini değiştirmeden yeniden kontrol edebilirsin.','error');}}
  finally{if(current===revision)profileFields.disabled=false;}
 }
 async function submit(){
  if(preview||inFlight||!payload||completed||!selected||!profile)return;
  inFlight=true;fields.disabled=true;profileFields.disabled=true;retry.hidden=true;cards();formMessage('Topluluk başvurun gönderiliyor…');
  try{
   let result;try{result=await request('community-applications',payload);}catch(error){if(['request_verification','csrf_invalid','invalid_csrf'].includes(error.code)){await session();result=await request('community-applications',payload);}else throw error;}
   if(!result||result.status!=='received'||typeof result.reference!=='string')throw Object.assign(new Error('network'),{code:'network',status:0});
   completed=true;uncertain=false;form.reset();fields.hidden=true;status.className='form-status success';status.innerHTML=`<strong>Topluluk başvurun alındı.</strong><p>${esc(selected.name)} için başvurun ekibe iletildi. Bu sonuç gruba otomatik kabul veya mesaj teslimi anlamına gelmez.</p><code>${esc(result.reference)}</code><p>Başka bir uygun topluluk için yukarıdan seçim yapabilirsin.</p>`;payload=null;requestId=null;status.focus();
  }catch(error){
   const unknown=!error.status||error.status>=500;uncertain=unknown;formMessage(COMMUNITY_ERRORS[error.code]||errorMessage(error.code),'error',true);
   if(unknown){retry.textContent='Aynı başvuruyu tekrar dene';retry.hidden=false;}
   else if(['group_not_eligible','profile_required','invalid_profile','school_city_mismatch','invalid_school'].includes(error.code)){clearSelection();profileMessage(COMMUNITY_ERRORS[error.code],'error');}
   else if(error.code!=='idempotency_conflict'){payload=null;requestId=null;fields.disabled=false;}
  }finally{inFlight=false;profileFields.disabled=uncertain;cards();}
 }
 profileForm.addEventListener('submit',event=>{event.preventDefault();void eligibility();});
 profileForm.addEventListener('change',()=>{if(preview||inFlight||uncertain)return;revision++;clearSelection();conditionalFields();profileMessage('Profilin değişti. Uygun toplulukları yeniden kontrol et.');});
 q('#profile-school-name').addEventListener('input',()=>{if(preview||inFlight||uncertain)return;revision++;clearSelection();profileMessage('Okul bilgisi değişti. Uygun toplulukları yeniden kontrol et.');});
 form.addEventListener('submit',event=>{
  event.preventDefault();if(preview||inFlight||completed||fields.disabled||!profile||!selected||!eligible.some(g=>g.id===selected.id))return;
  if(!form.reportValidity())return;const name=q('#name').value.trim(),phone=normalizePhone(q('#phone').value),terms=form.querySelector('input[name="termsAccepted"]')?.checked===true;
  if(!name||name.length>120||!phone||!terms){formMessage(!phone?errorMessage('invalid_phone'):!terms?errorMessage('terms_required'):errorMessage('invalid_name'),'error',true);return;}
  requestId??=crypto?.randomUUID?.();if(!requestId){formMessage('Başvuru güvenli bağlantı gerektiriyor. HTTPS adresinden yeniden aç.','error');return;}
  payload={groupId:selected.id,name,phone,termsAccepted:true,requestId,profile:{...profile}};void submit();
 });
 retry.addEventListener('click',()=>{if(payload)void submit();});
 conditionalFields();clearSelection();
 if(preview){
  profileMessage('Bu test yayını kişisel profil almaz. Aşağıdaki hazır örneklerle öneri akışını inceleyebilirsin.');
  const demo=q('#community-preview-demo');if(demo){demo.innerHTML='<p>Örnek profil: İstanbul’da mimarlık öğrencisi. Bu bilgiler bir kişiye ait değildir.</p><button type="button" class="button button-secondary" id="profile-demo-student">Örnek önerileri göster</button><button type="button" class="button button-secondary" id="profile-demo-manual">İnceleme gereken okul örneği</button>';
   const runDemo=manual=>{const school=profiles.schools.find(s=>s.cityId==='istanbul');const sample={status:'student',field:'architecture',cityId:'istanbul',...(manual?{schoolName:'Sentetik Örnek Okul'}:{schoolId:school.id})};const result=previewCommunityRecommendations(sample,profiles,groups);profile=result.profile;eligible=result.groups;requiresReview=result.requiresReview;selected=null;cards();profileMessage(manual?'Örnek: okul inceleme gerektirir; şehir ve bölge önerilmez.':'Örnek: genel duyuru, mimarlık ve İstanbul toplulukları. Kişisel bilgi ve gönderim kapalı.');const wanted=params.get('grup');if(wanted&&eligible.some(g=>g.id===wanted))selectGroup(wanted);};
   q('#profile-demo-student').addEventListener('click',()=>runDemo(false));q('#profile-demo-manual').addEventListener('click',()=>runDemo(true));
  }
 }else profileMessage((hintedSchool?hintedSchool.name+' rehberden seçildi. ':'')+'Durumunu ve alanını seç. Öğrenciysen eğitim aldığın şehri, diğer durumlarda bulunduğun şehri belirt.');
 return {selectGroup,check:eligibility,get state(){return {eligible:eligible.map(g=>g.id),selected:selected?.id||null,requiresReview,preview,completed,uncertain};}};
}
