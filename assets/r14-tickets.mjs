// [codex] 01a20fd9-f999-7b90-8b1b-b8cd977d4517 R14 catalog selection; price is never client authority.
// [codex] 01a20fe8-199e-7631-8910-07e7d27b753d · P2 optional published map; native selection remains complete.
import {escapeHTML as esc} from './core.mjs';
import {money} from './tickets.mjs';
import {publishedSeatPlan,renderSeatPlan} from './seat-plan.mjs';
export function renderTicketOptions({document,host,catalog,paymentAvailable,seatPlan=null}){
 if(!catalog||typeof catalog.selectionRequired!=='boolean'||!Array.isArray(catalog.classes)||!Array.isArray(catalog.seats))throw Error('invalid_ticket_options');
 host.textContent='';if(!catalog.selectionRequired){host.hidden=true;return {required:false,available:true,read:()=>null,setSeatPlan:()=>false};}
 host.hidden=false;const classes=catalog.classes.filter(c=>c&&typeof c.id==='string'),usable=c=>c?.available===true&&Number.isSafeInteger(c.priceMinor)&&c.priceMinor>=0&&(c.priceMinor===0||paymentAvailable===true);
 let published=publishedSeatPlan(seatPlan,catalog.eventSlug),mapController=null;
 host.innerHTML='<h3>Biletini seç</h3><p class="r14-inline-note">Bilet sınıfını ve gerekiyorsa koltuğunu seç. Fiyat, kupon ve yer uygunluğu başvuru sırasında yeniden kontrol edilir.</p><label for="r14-ticket-class">Bilet sınıfı</label><select id="r14-ticket-class" required><option value="">Bir bilet seç</option>'+classes.map(c=>'<option value="'+esc(c.id)+'" '+(!usable(c)?'disabled':'')+'>'+esc(c.label)+' · '+esc(money(c.priceMinor))+(Number.isInteger(c.remaining)?' · '+c.remaining+' yer':'')+(!usable(c)?' · Kapalı':'')+'</option>').join('')+'</select><div id="r14-seat-field" hidden><div id="r14-seat-map" class="r14-seat-map" role="group" aria-label="Koltuk seçimi"></div><div class="seat-plan-native"><label for="r14-ticket-seat">Koltuk listesinden seç</label><select id="r14-ticket-seat" aria-describedby="r14-seat-list-help"><option value="">Yer seç</option></select><p id="r14-seat-list-help" class="r14-inline-note">Haritada ve listede aynı koltuk seçilir. Dolu veya kapalı yerler seçilemez.</p></div></div><div id="r14-coupon-field" hidden><label for="r14-ticket-coupon">İndirim kodu (isteğe bağlı)</label><input id="r14-ticket-coupon" maxlength="64" type="text" autocomplete="off" placeholder="Kupon kodu"></div><p id="r14-ticket-selection-note" role="status"></p>';
 const cls=host.querySelector('#r14-ticket-class'),seat=host.querySelector('#r14-ticket-seat'),seatField=host.querySelector('#r14-seat-field'),couponField=host.querySelector('#r14-coupon-field'),coupon=host.querySelector('#r14-ticket-coupon'),note=host.querySelector('#r14-ticket-selection-note'),map=host.querySelector('#r14-seat-map');
 const currentClass=()=>classes.find(v=>v.id===cls.value),classSeats=c=>catalog.seats.filter(s=>s&&typeof s.id==='string'&&(s.classId===null||s.classId===c?.id)),eligible=(c,id)=>usable(c)&&classSeats(c).some(s=>s.id===id&&s.available===true);
 function drawMap(preserveFocus=false){
  const c=currentClass();if(!c?.seatRequired){map.innerHTML='';mapController=null;return;}
  const focused=document.activeElement,inside=preserveFocus&&map.contains(focused),focusId=inside?focused?.dataset?.seatId:null,action=inside?focused?.dataset?.seatMapAction:null;
  const list=classSeats(c).map(s=>({id:s.id,label:s.label,available:usable(c)&&s.available===true}));
  mapController=renderSeatPlan({host:map,seats:list,plan:published,selectedId:seat.value,onSelect:id=>{if(eligible(c,id))seat.value=id;markSeat();}});
  if(inside){if(focusId&&mapController.focusSeat(focusId))return;const actionButton=action?[...map.querySelectorAll('[data-seat-map-action]')].find(b=>b.dataset.seatMapAction===action&&!b.disabled):null;if(actionButton)actionButton.focus({preventScroll:true});else seat.focus({preventScroll:true});}
 }
 function update(){const c=currentClass();seat.innerHTML='<option value="">Yer seç</option>';seat.value='';coupon.value='';seat.required=Boolean(c?.seatRequired);seat.disabled=!!c&&!usable(c);seatField.hidden=!c?.seatRequired;couponField.hidden=!c||c.priceMinor<=0;
  if(c?.seatRequired)seat.innerHTML+=[...classSeats(c)].map(s=>`<option value="${esc(s.id)}"${usable(c)&&s.available===true?'':' disabled'}>${esc(s.label)}${s.available===true&&usable(c)?'':' · Dolu / kapalı'}</option>`).join('');
  drawMap();note.textContent=c?`${c.label} · ${money(c.priceMinor)}${c.seatRequired?' · Koltuk seçimi zorunlu.':''}`:'';
 }
 function markSeat(){const c=currentClass();if(!eligible(c,seat.value))seat.value='';mapController?.mark(seat.value);}
 seat.addEventListener('change',markSeat);cls.addEventListener('change',update);update();
 return {required:true,available:classes.some(usable),setSeatPlan(dto){published=publishedSeatPlan(dto,catalog.eventSlug);drawMap(true);return !!published;},read(){const c=currentClass();if(!c||!usable(c))throw Error('ticket_class_required');if(c.seatRequired&&!eligible(c,seat.value))throw Error('seat_required');const selection={classId:c.id};if(c.seatRequired)selection.seatId=seat.value;if(c.priceMinor>0&&coupon.value.trim())selection.couponCode=coupon.value.trim();return {selection,mode:c.priceMinor>0?'paid':'free'};}};
}
