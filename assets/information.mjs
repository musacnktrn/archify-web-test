// [codex] 01a20fe8-199e-7631-8910-07e7d27b753d · public information architecture
export const CATEGORY_PAGES = [
 {id:'zirve',name:'Zirveler',label:'Zirve',kicker:'Fikirlerin buluşma noktası',title:'Bir sahne.\nBirçok bakış.',intro:'Mimarlık pratiğini, tasarımın yeni sorularını ve mesleki deneyimleri birlikte konuşuyoruz. Bir oturumda başlayan fikir, bir sonraki karşılaşmaya taşınır.',topics:['Mesleki deneyimler','Tasarım yaklaşımları','Disiplinler arası konuşmalar'],matches:['Zirve'],series:['mimarlik-zirvesi','women-of-architecture']},
 {id:'festival',name:'Festivaller',label:'Festival',kicker:'Mimarlık açık havada',title:'Biraz üretim.\nBiraz keşif.',intro:'Kampın ritmi, atölyenin merakı ve birlikte geçirilen zaman. Festival; mimarlık etrafında buluşmayı, gündelik hayatın dışına taşıyan bir alan.',topics:['Kamp ve birlikte yaşam','Atölyeler ve paylaşımlar','Müzik ve sosyal program'],matches:['Festival'],series:['archfest']},
 {id:'yurt-disi-tur',name:'Yurt dışı turları',label:'Yurt dışı tur',kicker:'Başka kentlerden bakmak',title:'Bir yapının\nötesine bak.',intro:'Bir kenti sokakları, yapıları ve gündelik yaşamıyla okumak için ayrı bir alan. Yeni bir mimari gezi duyurulduğunda rota, tarihler ve katılım bilgileri burada yer alacak.',topics:['Kent ve yapı okumaları','Yerinde gözlem','Rota ve katılım bilgileri'],matches:['Yurt dışı tur','Yurt dışı turları'],series:[]},
 {id:'sempozyum',name:'Sempozyumlar',label:'Sempozyum',kicker:'Ortak sorular, farklı disiplinler',title:'Birlikte düşün.\nDerine in.',intro:'Mimarlığın toplumsal sorumluluğunu uzmanlıkların kesiştiği yerden ele alıyoruz. Güvenli kentler, dayanıklı yapılar ve ortak gelecek için konuşmaya alan açıyoruz.',topics:['Yapı ve kent güvenliği','Disiplinler arası bilgi','Toplumsal sorumluluk'],matches:['Sempozyum'],series:['deprem-ozel']},
 {id:'atolye',name:'Atölyeler',label:'Atölye',kicker:'Deneyerek öğrenmek',title:'Fikri eline al.\nBirlikte üret.',intro:'Düşünceyi denemeye, denemeyi üretime dönüştüren buluşmalar. Bağımsız atölyeler duyurulduğunda konu, yürütücü ve katılım bilgilerini burada bulabilirsin.',topics:['Tasarım denemeleri','Malzeme ve yöntem','Birlikte üretim'],matches:['Atölye','Workshop'],series:[]},
 {id:'sosyal',name:'Sosyal buluşmalar',label:'Sosyal',kicker:'Sohbet için de bir yer var',title:'Tanış. Paylaş.\nYeniden karşılaş.',intro:'Farklı okulların, şehirlerin ve tasarım pratiklerinin yollarını kesiştiren buluşmalar. Ortak bir merak, bazen yeni bir tanışıklığın ilk cümlesidir.',topics:['Toplulukla tanışma','Mesleki sohbetler','Yeni bağlantılar'],matches:['Buluşma','Sosyal'],series:['vizyon']}
];
export const GROUP_TYPES=['Duyuru','Meslek','Şehir / Bölge','Uluslararası'];
export function categoryPage(id){return CATEGORY_PAGES.find(item=>item.id===id)||null;}
export function directInvite(value){
 try{const url=new URL(value);return url.protocol==='https:'&&url.hostname==='chat.whatsapp.com'&&!url.port&&!url.username&&!url.password&&/^\/[A-Za-z0-9]{12,128}\/?$/.test(url.pathname)&&!url.search&&!url.hash?url.href:'';}catch{return '';}
}
export function communityTargets(catalog,published=[]){
 const valid=published.filter(g=>g&&typeof g.id==='string'&&typeof g.name==='string'&&directInvite(g.joinUrl)&&g.full!==true&&g.isFull!==true&&g.capacityReached!==true&&g.status!=='full');
 return catalog.map(group=>{
  const matches=valid.filter(g=>g.id===group.id);
  // An ambiguous duplicate never chooses a potentially different community.
  const direct=matches.length===1?directInvite(matches[0].joinUrl):'';
  return {...group,href:direct||'grup-basvuru.html?grup='+encodeURIComponent(group.id),direct:!!direct};
 });
}
export function additionalGroups(catalog,published=[]){
 const known=new Set(catalog.map(g=>g.id));const ids=new Set();
 return published.filter(g=>g&&typeof g.id==='string'&&typeof g.name==='string'&&!known.has(g.id)&&!ids.has(g.id)&&directInvite(g.joinUrl)&&g.full!==true&&g.isFull!==true&&g.capacityReached!==true&&g.status!=='full'&&(ids.add(g.id),true));
}

export const VERIFIED_VIDEO_IDS=Object.freeze(['Zi7DA-7ozEA','okaeVZXCzGE']);
export function videoEmbedURL(id){return typeof id==='string'&&/^[A-Za-z0-9_-]{11}$/.test(id)&&VERIFIED_VIDEO_IDS.includes(id)?'https://www.youtube-nocookie.com/embed/'+id+'?autoplay=1&rel=0':'';}
