// [codex] 01a20fd9 · Consent and exact, currently authorized proposal shares.
import {offerMarkup,portalId,utcStamp,portalDate} from './partner-offer.mjs';
const route='member/partner-portal';
export async function mountPartnerPortal({host,memberId,api,isCurrent}){
 const d=host.ownerDocument,win=d.defaultView;
 const el=(t,s,cls)=>{const n=d.createElement(t);if(s!=null)n.textContent=s;if(cls)n.className=cls;return n;};
 const root=el('article',null,'pp-workspace'),head=el('header',null,'pp-heading'),status=el('p',null,'pp-status'),body=el('div');
 head.append(el('h1','Sponsor panelim'),el('p','Archify ekibinin bu hesapla paylaştığı sponsorluk tekliflerini ve tekliflerin erişim süresini buradan inceleyebilirsin.'));
 status.setAttribute('role','status');status.setAttribute('aria-live','polite');root.append(head,status,body);host.replaceChildren(root);
 let alive=true,seq=0,busy=false,timer=null;
 const current=id=>alive&&isCurrent()&&root.isConnected&&!d.hidden&&(id==null||id===seq);
 const button=(s,name,fn)=>{const n=el('button',s,'pp-btn');n.type='button';n.dataset.action=name;n.onclick=()=>{if(current()&&!busy)void fn();};return n;};
 const lock=value=>{busy=value;root.setAttribute('aria-busy',String(value));for(const n of body.querySelectorAll('button'))n.disabled=value;};
 function renewTimer(serverNow,shares){win.clearTimeout(timer);if(!shares.length)return;
  const delay=Math.max(0,Math.min(...shares.map(s=>Date.parse(s.expiresAt)))-Date.parse(serverNow));timer=win.setTimeout(()=>{if(current())void load();},Math.min(2147483000,delay+1));}
 function render(identity,data){
  if(!portalId(memberId)||identity?.memberId!==memberId||data?.memberId!==memberId||!utcStamp(data.serverNow)||!Array.isArray(data.shares)||data.shares.length>100||typeof data.truncated!=='boolean'||typeof identity.consent?.active!=='boolean'||!Number.isSafeInteger(identity.consent.revision)||identity.consent.revision<0)throw Error('invalid_portal');
  const consent=identity.consent;if(!consent.active&&data.shares.length)throw Error('invalid_consent');
  const prefs=el('section',null,'pp-section');prefs.append(el('h2','Teklif alma tercihi'),el('p',consent.active?'Bu hesap sponsorluk teklifi alabilir.':'Sadece Archify ile sponsorluk görüşmesi yürütüyorsan teklif almaya açabilirsin.'));
  if(consent.active){
   const code=button('Hesap kimliğimi göster','identity',()=>{const ref=el('code',memberId,'pp-ref');ref.tabIndex=0;ref.setAttribute('aria-label','Archify hesap kimliği');code.replaceWith(ref);ref.focus();});prefs.append(code);
   const off=el('details',null,'pp-consent');off.append(el('summary','Teklif almayı kapat'),el('p','Kapattığında bu hesapla daha önce paylaşılmış tekliflere erişim sona erer.'),button('Erişimi kapatmayı onayla','disable',()=>change(false,consent.revision)));prefs.append(off);
  }else prefs.append(button('Bu hesapla teklif almayı aç','enable',()=>change(true,consent.revision)));
  const list=el('section',null,'pp-list');list.append(el('h2','Paylaşılan teklifler'));
  const seen=new Set();
  for(const s of data.shares){if(!portalId(s.shareId)||seen.has(s.shareId)||s.status!=='active'||!utcStamp(s.expiresAt)||s.expiresAt<=data.serverNow)throw Error('invalid_share');seen.add(s.shareId);
   const offer=offerMarkup(d,s.proposal);offer.dataset.offer=s.shareId;offer.append(el('p','Erişim sonu · '+portalDate(s.expiresAt)+' (İstanbul)','pp-end'));list.append(offer);}
  if(!data.shares.length)list.append(el('p','Bu hesapla paylaşılmış, erişim süresi açık bir teklif bulunmuyor.','pp-empty'));
  if(data.truncated)list.append(el('p','En güncel paylaşımlar gösteriliyor.'));body.replaceChildren(prefs,list,button('Güncel teklifleri yenile','refresh',()=>load()));renewTimer(data.serverNow,data.shares);
 }
 async function load(message=''){
  if(!current())return;const n=++seq;win.clearTimeout(timer);body.replaceChildren();lock(true);status.textContent='Hesaba bağlı teklifler kontrol ediliyor…';
  try{const identity=await api(route+'/identity');if(!current(n))return;const data=await api(route);if(!current(n))return;render(identity,data);status.textContent=message||'Teklifler güncel.';}
  catch{if(current(n)){body.replaceChildren(button('Yeniden yükle','retry',()=>load()));status.textContent='Güncel erişim doğrulanamadı. Teklifleri yeniden yükleyebilirsin.';}}
  finally{if(current(n))lock(false);}
 }
 async function change(active,revision){if(!current()||busy)return;const n=++seq;lock(true);status.textContent='Tercihin kaydediliyor…';
  try{const result=await api(route+'/consent',{requestId:crypto.randomUUID(),expectedRevision:revision,active});if(!current(n))return;if(result.memberId!==memberId||result.consent?.active!==active)throw Error('invalid_consent');await load(active?'Teklif alma tercihin açıldı.':'Teklif erişimin kapandı.');}
  catch{if(current(n))await load('İşlemin sonucu doğrulanamadı. Güncel tercih aşağıda.');}
 }
 await load();return ()=>{alive=false;seq++;win.clearTimeout(timer);root.remove();};
}
