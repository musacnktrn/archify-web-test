// [codex] 01a20fd9 · The founder preview and recipient read the same proposal projection.
const supports={cash:'Nakdi destek',in_kind:'Ayni destek',mixed:'Nakdi ve ayni destek'};
const vat={included:'KDV dahil',excluded:'KDV hariç',exempt:'KDV muaf',unknown:'KDV durumu belirtilmemiş'};
const kinds={company:'Şirket',university:'Üniversite',public:'Kamu kurumu',association:'Dernek',other:'Kurum'};
const money=new Intl.NumberFormat('tr-TR',{style:'currency',currency:'TRY'});
const calendar=new Intl.DateTimeFormat('tr-TR',{dateStyle:'long',timeZone:'UTC'}),instant=new Intl.DateTimeFormat('tr-TR',{dateStyle:'medium',timeStyle:'short',timeZone:'Europe/Istanbul'});
export const portalId=id=>typeof id==='string'&&/^[a-f0-9]{32}$/.test(id);
export const utcStamp=v=>typeof v==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/.test(v)&&Number.isFinite(Date.parse(v));
export const portalDate=stamp=>utcStamp(stamp)?instant.format(new Date(stamp)):'Zaman doğrulanamadı';
const day=v=>typeof v==='string'&&/^\d{4}-\d\d-\d\d$/.test(v)&&Number.isFinite(Date.parse(v));
const string=(v,max)=>typeof v==='string'&&v.trim()!==''&&Array.from(v).length<=max;
export function offerMarkup(doc,p){
 if(!p||!string(p.event?.title,180)||!string(p.organization?.name,180)||!Object.hasOwn(kinds,p.organization.kind)||!Object.hasOwn(supports,p.supportType)||!Object.hasOwn(vat,p.vatStatus)||p.currency!=='TRY'||
 !Number.isSafeInteger(p.proposalVersion)||p.proposalVersion<=0||!string(p.package?.title,180)||!Number.isSafeInteger(p.package.version)||p.package.version<=0||
 !Array.isArray(p.package.deliverables)||p.package.deliverables.length<1||p.package.deliverables.length>25||!(p.validUntil===null||day(p.validUntil))||
 !(p.cashAmountMinor===null||Number.isSafeInteger(p.cashAmountMinor)&&p.cashAmountMinor>0)||!(p.inKindDescription===null||string(p.inKindDescription,2000)))throw Error('invalid_offer');
 const el=(t,s,cls)=>{const n=doc.createElement(t);if(s!=null)n.textContent=s;if(cls)n.className=cls;return n;};
 const card=el('article',null,'pp-offer');card.append(el('p',p.event.title,'pp-overline'),el('h2',p.package.title),el('p',p.organization.name+' · '+kinds[p.organization.kind],'pp-org'));
 const dl=el('dl',null,'pp-facts');
 function fact(k,v){const wrap=el('div');wrap.append(el('dt',k),el('dd',v));dl.append(wrap);}
 fact('Teklif sürümü',String(p.proposalVersion));fact('Paket sürümü',String(p.package.version));fact('Destek türü',supports[p.supportType]);
 if(p.cashAmountMinor!==null)fact('Teklif tutarı',money.format(p.cashAmountMinor/100));fact('KDV',vat[p.vatStatus]);
 if(p.inKindDescription!==null)fact('Ayni destek',p.inKindDescription);
 fact('Teklif geçerliliği',p.validUntil?calendar.format(new Date(p.validUntil+'T12:00:00Z')):'Tarih belirtilmemiş');card.append(dl,el('h3','Paketteki teslimler'));
 const list=el('ul',null,'pp-items');
 for(const d of p.package.deliverables){if(!string(d.title,240)||!(Number.isSafeInteger(d.quantity)&&d.quantity>0)||!string(d.unit,120)||!(d.dueOn===null||day(d.dueOn)))throw Error('invalid_deliverable');
  const li=el('li');li.append(el('strong',d.title),el('span',d.quantity.toLocaleString('tr-TR')+' '+d.unit+(d.dueOn?' · '+calendar.format(new Date(d.dueOn+'T12:00:00Z')):'')));list.append(li);}
 card.append(list);return card;
}
