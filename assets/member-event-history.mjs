// [codex] 01a20fd9-f999-7b90-8b1b-b8cd977d4517 · Private timeline of explicitly linked and checked-in tickets.
import {memberDate,safeId,tokenValid} from './member-ui.mjs';

const slugOK=value=>typeof value==='string'&&value.length<=160&&/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
const timestamp=value=>typeof value==='string'&&Number.isFinite(Date.parse(value));
const optionalDate=value=>value===null||timestamp(value);
const count=value=>Number.isSafeInteger(value)&&value>=0;
const invalid=()=>new Error('invalid_history_response');

export function parseEventHistory(value,accountId){
  if(!safeId(accountId)||value?.memberId!==accountId||!timestamp(value.asOf)||!Array.isArray(value.items)||value.items.length>100||typeof value.truncated!=='boolean')throw invalid();
  const seen=new Set();
  const items=value.items.map(item=>{
    if(!item||!slugOK(item.eventSlug)||seen.has(item.eventSlug)||typeof item.title!=='string'||!item.title.trim()||
      !(item.city===null||typeof item.city==='string')||!optionalDate(item.startAt)||!optionalDate(item.endAt)||!timestamp(item.checkedInAt)||
      Date.parse(item.checkedInAt)>Date.parse(value.asOf)||(item.startAt&&Date.parse(item.startAt)>Date.parse(value.asOf))||
      item.eventHref!=='etkinlik.html?slug='+item.eventSlug||(item.albumHref!==null&&item.albumHref!=='albumler.html?etkinlik='+item.eventSlug)||
      !(item.ticketId===null||safeId(item.ticketId))||typeof item.feedbackEligible!=='boolean'||(item.feedbackEligible&&!item.ticketId))throw invalid();
    const feedback=item.feedback;
    if(!feedback||!['pending','approved','rejected'].every(status=>count(feedback[status])))throw invalid();
    seen.add(item.eventSlug);
    return {slug:item.eventSlug,title:item.title,city:item.city,startAt:item.startAt,checkedInAt:item.checkedInAt,eventHref:item.eventHref,
      albumHref:item.albumHref,ticketId:item.ticketId,feedbackEligible:item.feedbackEligible,feedback:{pending:feedback.pending,approved:feedback.approved,rejected:feedback.rejected}};
  });
  return {items,truncated:value.truncated};
}

export async function mountEventHistory({host,memberId,api,isCurrent,go=href=>location.assign(href)}){
  const doc=host.ownerDocument,root=doc.createElement('article');
  root.className='member-history';host.replaceChildren(root);
  let sequence=0,alive=true,opening=false;
  const active=n=>alive&&isCurrent()&&root.isConnected&&!doc.hidden&&(n===undefined||n===sequence);
  const element=(name,text,cls)=>{const item=doc.createElement(name);if(text)item.textContent=text;if(cls)item.className=cls;return item;};
  const link=(title,path)=>{const a=element('a',title,'mh-link');a.href=path;return a;};
  const button=(title,action)=>{const b=element('button',title,'mh-button');b.type='button';b.addEventListener('click',action);return b;};
  const setState=s=>{root.dataset.historyState=s;root.setAttribute('aria-busy',String(s==='loading'));};
  function heading(){
    const header=element('header',null,'mh-heading');header.append(element('h1','Katıldığım etkinlikler'),element('p','Hesabına bağladığın biletlerle giriş yaptığın etkinlikler.'));return header;
  }
  function failure(){
    setState('error');const message=element('p','Geçmişin şu anda yüklenemiyor.');message.setAttribute('role','status');
    root.replaceChildren(heading(),message,button('Yeniden dene',load));
  }
  async function openTicket(item,control,status){
    if(!active()||opening||!item.ticketId)return;
    const n=sequence;opening=true;control.disabled=true;
    try{
      const ticket=await api('member/tickets/open',{ticketId:item.ticketId});
      if(!active(n))return;
      if(!tokenValid(ticket?.token)||ticket?.eventSlug!==item.slug)throw invalid();
      go('bilet.html#token='+ticket.token);
    }catch{if(active(n))status.textContent='Bilet şu anda açılamıyor. Güncel geçmişini yeniden yükle.';}
    finally{if(active(n)){opening=false;control.disabled=false;}}
  }
  function card(item){
    const card=element('li',null,'mh-card');card.dataset.historyEvent=item.slug;
    const date=element('div',null,'mh-date');
    date.append(element('span','Kapı girişi'),element('time',memberDate(item.checkedInAt)));date.lastChild.dateTime=item.checkedInAt;
    const content=element('div',null,'mh-content');const title=element('h2');
    title.append(link(item.title,item.eventHref));content.append(title);
    const dateText=item.startAt?memberDate(item.startAt):'Etkinlik tarihi belirtilmemiş';
    content.append(element('p',[dateText,item.city].filter(Boolean).join(' · '),'mh-place'));
    const fb=[['pending','incelemede'],['approved','yayımlanmış'],['rejected','yayıma alınmamış']].filter(([key])=>item.feedback[key]>0).map(([key,label])=>item.feedback[key]+' '+label);
    if(fb.length)content.append(element('p','Değerlendirmelerin · '+fb.join(', '),'mh-feedback'));
    const nav=element('div',null,'mh-actions');nav.append(link('Etkinlik dosyası',item.eventHref));
    if(item.albumHref)nav.append(link('Fotoğraf albümü',item.albumHref));
    const status=element('p',null,'mh-status');status.setAttribute('role','status');
    if(item.ticketId){
      const ticket=button(item.feedbackEligible?'Bileti aç ve değerlendir':'Bileti aç',()=>void openTicket(item,ticket,status));nav.append(ticket);
    }
    content.append(nav,status);card.append(date,content);return card;
  }
  async function load(){
    const n=++sequence;opening=false;setState('loading');root.replaceChildren(heading(),element('p','Geçmiş yükleniyor…'));
    try{
      const data=parseEventHistory(await api('member/event-history'),memberId);
      if(!active(n))return;
      const header=heading();header.append(button('Yenile',load));
      root.replaceChildren(header);setState(data.items.length?'ready':'empty');
      if(!data.items.length){root.append(element('p','Henüz bu hesaba bağlı, kapı girişi doğrulanmış bir etkinlik yok.','mh-empty'),link('Biletlerimi gör','hesabim.html#member-tickets'));return;}
      const list=element('ol',null,'mh-list');for(const item of data.items)list.append(card(item));root.append(list);
      if(data.truncated)root.append(element('p','En son giriş yaptığın 100 etkinlik gösteriliyor.'));
    }catch{if(active(n))failure();}
  }
  await load();
  return ()=>{alive=false;++sequence;root.remove();};
}
