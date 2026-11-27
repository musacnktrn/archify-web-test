// [codex] 01a20fd9-f999-7b90-8b1b-b8cd977d4517 · Current, explicitly confirmed school/event links.
const slugPattern=/^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const cursorPattern=/^[A-Za-z0-9_-]+\.[a-f0-9]{64}$/;
const dateFormatter=new Intl.DateTimeFormat('tr-TR',{timeZone:'Europe/Istanbul',day:'numeric',month:'long',year:'numeric'});
function eventDate(item){
 if(item.startAt){const start=new Date(item.startAt);if(Number.isFinite(start.getTime()))return dateFormatter.format(start);}
 return Number.isInteger(item.year)?String(item.year):'Tarih duyurulacak';
}
function validate(page,school){
 if(page?.school?.id!==school.id||page.school.name!==school.name||page.school.cityId!==school.cityId||
    !Array.isArray(page.items)||page.items.length>50||!(page.nextCursor===null||(typeof page.nextCursor==='string'&&page.nextCursor.length<=300&&cursorPattern.test(page.nextCursor))))throw Error('campus_page');
 const seen=new Set();
 for(const item of page.items){
  if(!item||typeof item.slug!=='string'||!slugPattern.test(item.slug)||seen.has(item.slug)||item.eventHref!=='etkinlik.html?slug='+item.slug||
     typeof item.title!=='string'||!item.title.trim()||typeof item.archived!=='boolean')throw Error('campus_event');
  seen.add(item.slug);
 }
}
export async function mountSchoolEvents({host,school,read,active}){
 const doc=host.ownerDocument;let requested=0;
 const el=(tag,text)=>{const n=doc.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
 const status=text=>{const n=el('p',text);n.setAttribute('role','status');return n;};
 async function show(after,previous,focus=false){
  if(!active())return;
  const turn=++requested;
  const current=()=>active()&&turn===requested;
  host.setAttribute('aria-busy','true');host.replaceChildren(status('Etkinlik kayıtları yükleniyor…'));
  function action(label,handler){const b=el('button',label);b.type='button';b.className='cd-button';b.onclick=handler;return b;}
  try{
   const page=await read(school.id,after);if(!current())return;validate(page,school);
   if(page.nextCursor!==null&&[after,...previous].includes(page.nextCursor))throw Error('campus_cursor');
   const summary=status(page.items.length?'Bu üniversiteyle bağlantısı ekip tarafından doğrulanan etkinlikler.':'Bu üniversite için henüz doğrulanmış bir etkinlik yayımlanmadı.');
   host.replaceChildren(summary);summary.tabIndex=-1;
   if(page.items.length){
    const list=el('ul');list.className='cd-events-list';
    for(const item of page.items){
     const li=el('li'),a=el('a',item.title),meta=el('span',[item.archived?'Arşiv':null,eventDate(item),item.city].filter(Boolean).join(' · '));
     a.href=item.eventHref;li.append(a,meta);list.append(li);
    }
    host.append(list);
   }
   if(previous.length||page.nextCursor){
    const nav=el('nav');nav.setAttribute('aria-label','Kampüs etkinlik sayfaları');nav.className='cd-pagination';
    if(previous.length)nav.append(action('Önceki etkinlikler',()=>show(previous.at(-1),previous.slice(0,-1),true)));
    if(page.nextCursor)nav.append(action('Sonraki etkinlikler',()=>show(page.nextCursor,[...previous,after],true)));
    host.append(nav);
   }
   if(focus)summary.focus();
  }catch{
   if(current())host.replaceChildren(status('Etkinlik bağlantıları şu anda alınamadı.'),action('Etkinlikleri yeniden yükle',()=>show(null,[],true)));
  }finally{if(current())host.setAttribute('aria-busy','false');}
 }
 await show(null,[]);
}
