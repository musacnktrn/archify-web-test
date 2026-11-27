// [codex] 01a20fd9 · Owner-only status projection for explicitly linked community applications.
import {safeId} from './member-ui.mjs';
const labels={received:'Başvurun alındı',in_review:'Ekip incelemesinde',contact_recorded:'Ekip iletişim kaydı ekledi',closed:'İnceleme kapandı'};
const date=new Intl.DateTimeFormat('tr-TR',{dateStyle:'medium',timeStyle:'short',timeZone:'Europe/Istanbul'});
function parse(v,owner){
 if(!safeId(owner)||v?.memberId!==owner||v.available!==true||typeof v.truncated!=='boolean'||!Number.isFinite(Date.parse(v.asOf))||!Array.isArray(v.items)||v.items.length>100)throw Error('invalid_community_list');
 const seen=new Set();for(const i of v.items){if(!i||!/^GRP-[A-F0-9]{16}$/.test(i.reference)||seen.has(i.reference)||typeof i.groupId!=='string'||i.groupId.length>80||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(i.groupId)||!(i.groupName===null||typeof i.groupName==='string')||!Object.hasOwn(labels,i.status)||!Number.isFinite(Date.parse(i.createdAt))||!Number.isFinite(Date.parse(i.updatedAt)))throw Error('invalid_community_row');seen.add(i.reference);}
 return v;
}
export async function mountCommunityApplications({host,memberId,api,isCurrent}){
 const doc=host.ownerDocument,root=doc.createElement('article');root.className='member-history';host.replaceChildren(root);
 let alive=true,turn=0;
 const el=(t,s,cls)=>{const n=doc.createElement(t);if(s!=null)n.textContent=s;if(cls)n.className=cls;return n;};
 const title=el('header',null,'mh-heading'),refresh=el('button','Durumları yenile','mh-button'),status=el('p',null,'mh-status'),list=el('ul',null,'mh-list');
 title.append(el('h1','Topluluk başvurularım'),el('p','Yeni başvurunda hesabında takip etmeyi seçtiğinde inceleme durumunu burada görebilirsin.'),refresh);refresh.type='button';refresh.dataset.action='refresh';status.setAttribute('role','status');root.append(title,status,list);
 const current=id=>alive&&isCurrent()&&root.isConnected&&!doc.hidden&&id===turn;
 function timestamp(raw){const t=el('time',date.format(Date.parse(raw)));t.dateTime=raw;return t;}
 async function load(){
  const id=++turn;refresh.disabled=true;list.replaceChildren();status.textContent='Güncel başvurular kontrol ediliyor…';
  try{const data=parse(await api('member/community-applications'),memberId);if(!current(id))return;
   for(const row of data.items){const card=el('li',null,'mh-card'),dates=el('div',null,'mh-date'),info=el('div',null,'mh-content');card.dataset.communityReference=row.reference;
    dates.append(el('span','Başvuru tarihi'),timestamp(row.createdAt));info.append(el('h2',row.groupName||'Topluluk kaydı'),el('p',labels[row.status],'mh-feedback'),el('p',row.reference,'mh-place'));
    const update=el('p','Son güncelleme · ','mh-place');update.append(timestamp(row.updatedAt));info.append(update);card.append(dates,info);list.append(card);}
   status.textContent=data.items.length?'Durumlar güncel. Gruba katılım, ekibin davet sürecinde gerçekleşir.':'Hesabına bağlı bir topluluk başvurusu henüz yok.';
   if(data.truncated)status.textContent+=' En güncel 100 kayıt gösteriliyor.';
  }catch{if(current(id))status.textContent='Güncel başvurular yüklenemedi. Bağlantını kontrol edip yeniden deneyebilirsin.';}
  finally{if(current(id))refresh.disabled=false;}
 }
 refresh.onclick=()=>{if(!refresh.disabled)void load();};await load();return ()=>{alive=false;turn++;root.remove();};
}
