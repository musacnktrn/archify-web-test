// [codex] 01a20fd9-f999-7b90-8b1b-b8cd977d4517 · Download an up-to-date public event on explicit action.
import {eventCalendarEligibility, createEventCalendarFile} from './event-calendar-file.mjs';

export function mountEventCalendar({host, initial, slug, read}) {
  const doc=host.ownerDocument, win=doc.defaultView;
  const button=doc.createElement('button'), message=doc.createElement('p');
  button.type='button';button.className='button button-secondary';
  button.textContent='Takvimime ekle';button.dataset.eventCalendar='';
  message.className='field-help';message.setAttribute('role','status');
  host.append(button,message);
  let version=0, busy=false, timer=null;
  function current(serial){return serial===version && host.isConnected && !doc.hidden;}
  function clearTimer(){win.clearTimeout(timer);timer=null;}
  function usable(data){return eventCalendarEligibility(data?.event,{serverNow:data?.serverNow,expectedSlug:slug}).available;}
  function paint(data, text='') {
    clearTimer();busy=false;
    const available=usable(data);
    button.hidden=!available;button.disabled=!available;message.textContent=text;
    if(available){
      const ms=Date.parse(data.event.endAt)-Date.parse(data.serverNow);
      if(ms<=2147483000)timer=win.setTimeout(()=>{button.hidden=true;button.disabled=true;},ms+1);
    }
  }
  async function refresh(download) {
    if(!host.isConnected||doc.hidden||(download&&busy))return;
    const serial=++version;
    clearTimer();busy=true;button.disabled=true;
    if(download)message.textContent='Etkinliğin güncel saati kontrol ediliyor…';
    try{
      const data=await read();
      if(!current(serial))return;
      if(!usable(data)){paint(null,download?'Etkinliğin güncel takvim dosyası kullanılamıyor.':'');return;}
      if(download){
        const file=createEventCalendarFile(data.event,{serverNow:data.serverNow,expectedSlug:slug});
        const url=win.URL.createObjectURL(new win.Blob([file.text],{type:file.mimeType}));
        const link=doc.createElement('a');
        try{link.href=url;link.download=file.filename;doc.body.append(link);link.click();}
        finally{link.remove();win.setTimeout(()=>win.URL.revokeObjectURL(url),1000);}
      }
      paint(data,download?'Takvim dosyan hazır. İndirdiğin .ics dosyasını takvim uygulamanla açabilirsin.':'');
    }catch(error){
      if(!current(serial))return;
      const withdrawn=[403,404,410].includes(error?.status);
      paint(null,withdrawn?'Bu etkinlik için takvim dosyası artık kullanılamıyor.':'Etkinlik bilgisi okunamadı.');
      if(!withdrawn){button.textContent='Takvim bilgisini yeniden kontrol et';button.hidden=false;button.disabled=false;}
    }
  }
  button.addEventListener('click',()=>{button.textContent='Takvimime ekle';void refresh(true);});
  function suspend(){++version;clearTimer();busy=false;button.hidden=true;button.disabled=true;message.textContent='';}
  function visibility(){if(doc.hidden)suspend();else void refresh(false);}
  function show(event){if(event.persisted)void refresh(false);}
  doc.addEventListener('visibilitychange',visibility);
  win.addEventListener('pagehide',suspend);win.addEventListener('pageshow',show);
  if(doc.hidden)suspend();else paint(initial);
  return ()=>{suspend();doc.removeEventListener('visibilitychange',visibility);win.removeEventListener('pagehide',suspend);win.removeEventListener('pageshow',show);host.replaceChildren();};
}
