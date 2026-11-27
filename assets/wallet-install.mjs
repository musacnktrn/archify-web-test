// [codex] 01a20fe8-62df-78c3-a20e-1c904d040938 · explicit, package-scoped installation controls.
const mounted=new WeakMap();
const STYLE=`.wallet-install-card{border:1px solid #d3d8c9;border-radius:14px;padding:25px;background:#f4f5ee;color:#182116;max-width:900px;margin:24px auto;font:14px/1.7 system-ui,-apple-system,sans-serif}.wallet-install-card h2{font-size:25px;font-weight:600;line-height:1.2;letter-spacing:-.035em;margin:0 0 13px}.wallet-install-card p{margin:0 0 14px;color:#59644e}.wallet-install-actions{display:flex;flex-wrap:wrap;gap:10px;margin:18px 0}.wallet-install-card button{font-family:inherit;font-size:13px;font-weight:600;line-height:1.5;min-height:44px;padding:11px 16px;border:1px solid #98ac86;border-radius:7px;background:white;color:#29411b;cursor:pointer}.wallet-install-card button[data-wallet-action=enable]{background:#29411b;color:white}.wallet-install-card button:disabled{opacity:.5;cursor:default}.wallet-install-card :focus-visible{outline:3px solid #7c985e;outline-offset:4px}.wallet-install-card [hidden]{display:none!important}.wallet-install-card details{border-top:1px solid #d3d8c9;padding-top:14px;margin-top:15px}.wallet-install-card summary{cursor:pointer;font-weight:600;min-height:36px}.wallet-install-card ol{padding-left:22px}.wallet-install-card li{margin:9px 0}.wallet-install-card [data-wallet-status]{font-size:13px;color:#415334;min-height:23px}.wallet-install-card .wallet-install-error{color:#8b3d26}.wallet-install-card small{display:block;font-size:11px;line-height:1.7;color:#69725e}.wallet-install-card a{color:#29411b;font-weight:600}@media(max-width:560px){.wallet-install-card{padding:22px 18px}.wallet-install-actions{flex-direction:column}.wallet-install-actions button{width:100%}}`;

export function mountWalletInstall(host){
  if(!host?.ownerDocument)return()=>{};if(mounted.has(host))return mounted.get(host);
  const doc=host.ownerDocument,win=doc.defaultView,nav=win?.navigator;
  const base=new URL('../',import.meta.url),workerURL=new URL('archify-sw.js',base),manifestURL=new URL('site.webmanifest',base);
  const prefix='archify-wallet:'+encodeURIComponent(base.href)+':';
  const ownsCache=name=>name.startsWith(prefix)&&/^v[1-9][0-9]*$/.test(name.slice(prefix.length));
  const supported=Boolean(win?.isSecureContext&&nav?.serviceWorker&&base.origin===win.location.origin&&['http:','https:'].includes(base.protocol));
  const el=(tag,text)=>{const n=doc.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
  let alive=true,busy=false,intent=false,promptEvent=null,manifest=null,enabled=false;
  const current=()=>alive&&host.isConnected;
  const style=el('style');style.textContent=STYLE;const card=el('section');card.className='wallet-install-card';card.setAttribute('aria-label','Ana ekran kurulumu');
  card.append(el('h2','Archify’ı ana ekranına ekle'),el('p','Desteklenen tarayıcıda uygulama olarak açabilirsin. Çevrimdışı kopya yalnız bağlantı ekranı ve marka ikonlarıdır; hesap, bilet ve başvurular internet gerektirir.'));
  const actions=el('div');actions.className='wallet-install-actions';
  const button=(label,action)=>{const b=el('button',label);b.type='button';b.dataset.walletAction=action;return b;};
  const enable=button('Kurulumu etkinleştir','enable'),install=button('Ana ekrana ekle','install'),remove=button('Çevrimdışı kopyayı kaldır','remove');install.hidden=true;enable.disabled=!supported;remove.disabled=!supported;actions.append(enable,install,remove);card.append(actions);
  const status=el('p');status.dataset.walletStatus='';status.setAttribute('role','status');status.setAttribute('aria-live','polite');card.append(status);
  const instructions=el('details'),summary=el('summary','Telefonumda nasıl eklerim?'),list=el('ol');
  list.append(el('li','Önce Kurulumu etkinleştir düğmesini kullan. Bu seçim küçük, genel bir çevrimdışı kopya saklar.'),el('li','Android: Destekleniyorsa Ana ekrana ekle düğmesini seç. Alternatif olarak tarayıcı menüsünde Uygulamayı yükle veya Ana ekrana ekle seçeneğini ara.'),el('li','iPhone veya iPad: Safari paylaş menüsünden Ana Ekrana Ekle seçeneğini kullan. Kurulum seçeneği görünmüyorsa siteyi tarayıcıda kullanmaya devam edebilirsin.'),el('li','Kaldırmak için bu ekrandaki Çevrimdışı kopyayı kaldır düğmesini kullan. Ana ekran simgesini cihazının menüsünden ayrıca kaldır.'));
  instructions.append(summary,list);card.append(instructions,el('small','Bu işlem bildirim izni istemez; otomatik başvuru, mesaj veya ödeme başlatmaz.'));
  const exit=el('a','Siteye dön');exit.href=new URL('index.html',base).href;card.append(exit);host.replaceChildren(style,card);
  const say=(text,error=false)=>{if(current()){status.textContent=text;status.classList.toggle('wallet-install-error',error);}};
  if(!supported)say('Bu tarayıcıda kurulum desteği kullanılamıyor. Siteyi normal bağlantıyla kullanabilirsin.');
  const ownRegistration=r=>{const workers=[r.active,r.waiting,r.installing].filter(Boolean);return r.scope===base.href&&workers.length>0&&workers.every(w=>w.scriptURL===workerURL.href);};
  const lock=value=>{busy=value;if(!current())return;enable.disabled=value||!supported||enabled;remove.disabled=value||!supported;install.disabled=value||!promptEvent;};
  function addManifest(){
    const existing=[...doc.querySelectorAll('link[rel=manifest]')];
    if(existing.some(n=>n.href!==manifestURL.href))throw Error('other_manifest');
    if(existing.length)return;
    manifest=el('link');manifest.rel='manifest';manifest.href=manifestURL.href;manifest.dataset.archifyWallet='';doc.head.append(manifest);
  }
  async function activate(){
    if(!current()||busy||!supported||enabled)return;lock(true);intent=true;say('Genel çevrimdışı kopya hazırlanıyor…');
    try{
      const registrations=await nav.serviceWorker.getRegistrations();
      if(!current())return;
      if(registrations.some(r=>r.scope===base.href&&!ownRegistration(r)))throw Error('other_worker');
      addManifest();
      const registration=await nav.serviceWorker.register(workerURL.href,{scope:base.href,updateViaCache:'none'});
      if(registration.scope!==base.href)throw Error('scope_mismatch');
      // A registration can exist even when install fails. Wait for the concrete worker state.
      const candidate=registration.installing||registration.waiting||registration.active;
      if(!candidate)throw Error('install_failed');
      if(!['installed','activated'].includes(candidate.state))await new Promise((resolve,reject)=>{
        const timer=win.setTimeout(()=>{candidate.removeEventListener('statechange',changed);reject(Error('install_timeout'));},20000);
        const changed=()=>{if(['installed','activated','redundant'].includes(candidate.state)){win.clearTimeout(timer);candidate.removeEventListener('statechange',changed);candidate.state==='redundant'?reject(Error('install_failed')):resolve();}};
        candidate.addEventListener('statechange',changed);changed();
      });
      if(!current())return;enabled=true;say('Kurulum desteği hazır. Ana ekrana eklemek için tarayıcının seçeneğini kullan. Hesap ve bilet bilgileri çevrimdışı saklanmaz.');instructions.open=true;
    }catch(error){if(!current())return;intent=false;promptEvent=null;install.hidden=true;if(manifest){manifest.remove();manifest=null;}say(error.message==='other_worker'||error.message==='other_manifest'?'Bu adreste başka bir kurulum yapılandırması var. Ona dokunulmadı; siteyi normal kullanabilirsin.':'Kurulum tamamlanamadı. Siteyi kullanmaya devam edebilir veya yeniden deneyebilirsin.',true);}
    finally{lock(false);}
  }
  async function prompt(){
    if(!current()||busy||!intent||!promptEvent)return;const saved=promptEvent;promptEvent=null;lock(true);
    try{await saved.prompt();const choice=await saved.userChoice;if(current())say(choice?.outcome==='accepted'?'Tarayıcı kurulum seçimini aldı. Ana ekran simgesini cihazında kontrol et.':'Kurulum seçilmedi. Siteyi kullanmaya devam edebilirsin.');}catch{say('Tarayıcı kurulum penceresini açamadı. Telefon yönergesini kullanabilirsin.',true);}finally{install.hidden=true;lock(false);}
  }
  async function uninstall(){
    if(!current()||busy||!supported)return;lock(true);intent=false;promptEvent=null;install.hidden=true;say('Bu Archify kopyasının çevrimdışı desteği kaldırılıyor…');
    try{
      const registrations=await nav.serviceWorker.getRegistrations();
      for(const r of registrations)if(ownRegistration(r))await r.unregister();
      if(win.caches)for(const name of await win.caches.keys())if(ownsCache(name))await win.caches.delete(name);
      for(const link of doc.querySelectorAll('link[rel=manifest][data-archify-wallet]'))if(link.href===manifestURL.href)link.remove();manifest=null;enabled=false;
      say('Bu kopyanın çevrimdışı desteği kaldırıldı. Açık sekmeyi yenilediğinde worker devreden çıkar. Ana ekran simgesini cihazından ayrıca kaldır.');
    }catch{say('Kaldırma tamamlanamadı. Yeniden dene; tarayıcının site verisi ayarından da kontrol edebilirsin.',true);}
    finally{lock(false);}
  }
  const before=e=>{if(!current()||!intent)return;e.preventDefault();promptEvent=e;install.hidden=false;install.disabled=busy;};
  const installed=()=>{if(current()&&intent){promptEvent=null;install.hidden=true;say('Tarayıcı kurulumun tamamlandığını bildirdi.');}};
  enable.addEventListener('click',activate);install.addEventListener('click',prompt);remove.addEventListener('click',uninstall);
  win?.addEventListener('beforeinstallprompt',before);win?.addEventListener('appinstalled',installed);
  function cleanup(){if(!alive)return;alive=false;promptEvent=null;win?.removeEventListener('beforeinstallprompt',before);win?.removeEventListener('appinstalled',installed);win?.removeEventListener('pagehide',cleanup);host.replaceChildren();mounted.delete(host);}
  win?.addEventListener('pagehide',cleanup,{once:true});mounted.set(host,cleanup);return cleanup;
}
if(typeof document!=='undefined'&&typeof window!=='undefined'){
  const mount=()=>{const host=document.getElementById('wallet-install');if(host)mountWalletInstall(host);};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
  window.addEventListener('pageshow',event=>{if(event.persisted)mount();});
}
