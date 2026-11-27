// [codex] 01a20fe8-199e-7631-8910-07e7d27b753d · P10 public media dossier; publication and player permission supplied by root.
const mounts = new WeakMap();
const validId = value => typeof value === 'string' && /^[A-Za-z0-9_-]{11}$/.test(value);
const text = (value, max = 4000) => typeof value === 'string' && value.length <= max && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value) ? value.trim() : '';
const slugOK = value => typeof value === 'string' && value.length <= 160 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
const detailHref = id => 'medya.html?video=' + encodeURIComponent(id);
const eventHref = slug => 'etkinlik.html?slug=' + encodeURIComponent(slug);
function localImage(value) {
  return typeof value === 'string' && value.length <= 1500 && /^(?:assets|media)\/[A-Za-z0-9_./-]+\.(?:webp|png|jpe?g|avif)$/i.test(value) && !value.split('/').includes('..') ? value : '';
}
function videoDTO(value) {
  if (!value || !validId(value.id) || !text(value.title, 500)) return null;
  let url; try { url = new URL(value.url); } catch { return null; }
  if (url.origin !== 'https://www.youtube.com' || url.pathname !== '/watch' || url.searchParams.get('v') !== value.id || url.username || url.password) return null;
  return {id:value.id, title:text(value.title,500), subtitle:text(value.subtitle,500), kind:text(value.kind,100) || 'Video', description:text(value.description), url:'https://www.youtube.com/watch?v='+value.id, eventSlug:slugOK(value.eventSlug) ? value.eventSlug : null};
}
export function mediaFeaturePlaybackURL(value, id) {
  if (!validId(id) || typeof value !== 'string') return null;
  let url; try { url = new URL(value); } catch { return null; }
  if (url.origin !== 'https://www.youtube-nocookie.com' || url.pathname !== '/embed/'+id || url.username || url.password || url.hash) return null;
  for (const [key,val] of url.searchParams) if (!['autoplay','rel'].includes(key) || !['0','1'].includes(val) || url.searchParams.getAll(key).length !== 1) return null;
  return url.href;
}
function eventDTO(value, slug) {
  if (!value || value.slug !== slug || !text(value.title,500) || !Array.isArray(value.gallery)) return null;
  const seen = new Set(), gallery = [];
  for (const item of value.gallery.slice(0,40)) {
    const src = localImage(item?.src); if (!src || seen.has(src)) continue; seen.add(src);
    gallery.push({src, thumbnail:localImage(item.thumbnail) || src, alt:text(item.alt,1000) || value.title, caption:text(item.caption,2000)});
  }
  return {slug, title:text(value.title,500), city:text(value.city,150), year:Number.isInteger(value.year) && value.year >= 1900 && value.year <= 2200 ? value.year : null, gallery};
}

/** All HTTP and source authority is injected; this module performs no fetch or storage access. */
export async function mountMediaFeature({host, videoId, loadMedia, loadEvent, verifyPlayback}) {
  mounts.get(host)?.();
  const doc = host.ownerDocument, win = doc.defaultView;
  const el = (tag, cls='', content) => { const node=doc.createElement(tag); if(cls)node.className=cls; if(content!==undefined)node.textContent=content; return node; };
  const root=el('article','media-feature'); host.replaceChildren(root);
  let alive=true, generation=0, playbackGeneration=0, stopPlayback=null;
  const eventReads=new WeakMap();
  const originalTitle=doc.title; let ownedTitle=null;
  const title = value => { ownedTitle=value; doc.title=value; };
  const current = stamp => alive && root.parentNode===host && host.isConnected && (stamp===undefined || generation===stamp);
  const link = (label,href,cls='mf-link') => { const a=el('a',cls,label); a.href=href; return a; };
  const button = (label,action,cls='mf-button') => { const b=el('button',cls,label); b.type='button'; b.dataset.mediaAction=action; return b; };
  const external = (label,href,cls='mf-link') => { const a=link(label,href,cls); a.target='_blank'; a.rel='noopener noreferrer'; return a; };
  const mediaBack = () => link('Tüm yayınlar','medya.html','mf-back');
  function clearPlayback() { playbackGeneration++; stopPlayback?.(false); stopPlayback=null; root.querySelectorAll('iframe').forEach(frame=>frame.remove()); }
  function state(kind, heading, detail) {
    clearPlayback(); root.replaceChildren(); root.dataset.mediaFeatureState=kind; root.removeAttribute('aria-busy');
    const section=el('section','mf-empty'); const h=el('h1','',heading); h.tabIndex=-1;
    section.append(el('p','mf-kicker','ARCHIFY / YAYIN'),h,el('p','mf-lead',detail));
    const actions=el('div','mf-actions'); actions.append(mediaBack());
    if (kind==='error') { const retry=button('Yeniden dene','retry'); retry.addEventListener('click',()=>void load(true)); actions.append(retry); }
    section.append(actions); root.append(section); title(heading+' · Archify');
  }
  function missing(focus=false) { state('missing','Bu yayın şu anda bulunamıyor.','Bağlantı eksik olabilir veya yayın kaldırılmış olabilir. Archify’nin diğer yayınlarına göz atabilirsin.'); if(focus)root.querySelector('h1')?.focus({preventScroll:true}); }
  function renderEvent(event, slot) {
    slot.replaceChildren(); slot.removeAttribute('aria-busy'); slot.removeAttribute('data-media-event'); if(!event) { slot.hidden=true; return; }
    slot.hidden=false; slot.dataset.mediaEvent=event.slug;
    const head=el('div','mf-section-heading'),copy=el('div'); copy.append(el('p','mf-kicker','YAYINDAN ETKİNLİĞE'),el('h2','','Buluşmanın kaydı'));
    const route=link('Etkinliğin hikâyesi',''+eventHref(event.slug)); route.dataset.mediaEventLink=''; head.append(copy,route);
    const card=el('div','mf-event-card'),meta=[event.city,event.year].filter(Boolean).join(' · ');
    card.append(el('p','mf-event-meta',meta),el('h3','',event.title),el('p','','Bu yayının ilişkili olduğu etkinliğin programına ve kaynaklarına arşiv kaydından ulaşabilirsin.'));
    slot.append(head,card);
    if (event.gallery.length) {
      const gallery=el('div','mf-gallery'); gallery.dataset.mediaGallery='';
      const label=el('p','mf-gallery-label','Etkinliğin arşivinden'); slot.append(label);
      for (const photo of event.gallery.slice(0,3)) {
        const figure=el('figure','mf-photo'),a=link('',eventHref(event.slug)+'#archive-gallery-title','mf-photo-link'),image=el('img');
        image.src=photo.thumbnail; image.alt=photo.alt; image.loading='lazy'; image.decoding='async'; a.setAttribute('aria-label',photo.alt+' · etkinlik galerisini aç'); a.append(image);
        const caption=el('figcaption'); caption.append(el('span','mf-photo-label','Etkinlik fotoğrafı'),el('span','',photo.caption || photo.alt)); figure.append(a,caption); gallery.append(figure);
      }
      slot.append(gallery);
    }
  }
  function render(video, videos, channel, stamp) {
    clearPlayback(); root.replaceChildren(); root.dataset.mediaFeatureState='ready'; root.removeAttribute('aria-busy'); title(video.title+' · Archify Media');
    const header=el('header','mf-header'); header.append(mediaBack());
    const tags=el('p','mf-kicker',video.kind+' / ARCHIFY YAYINI'),h1=el('h1','mf-title',video.title); h1.dataset.mediaTitle=''; h1.tabIndex=-1;
    header.append(tags,h1); if(video.subtitle)header.append(el('p','mf-subtitle',video.subtitle)); root.append(header);
    const viewing=el('section','mf-viewing'); viewing.setAttribute('aria-label','Video oynatıcı');
    const player=el('div','mf-stage'); player.dataset.mediaPlayer='';
    const cover=el('div','mf-cover'),mark=el('span','mf-wordmark','ARCHIFY'); mark.setAttribute('aria-hidden','true');
    cover.append(el('p','mf-stage-kind',video.kind),mark);
    const play=button('Videoyu oynat','play','mf-play video-trigger'); play.dataset.analyticsTarget='video-play'; play.setAttribute('aria-label',video.title+' · videoyu oynat');
    const icon=el('span','mf-play-icon'); icon.setAttribute('aria-hidden','true'); play.prepend(icon); cover.append(play); player.append(cover);
    const toolbar=el('div','mf-player-toolbar'),status=el('p','mf-status'); status.dataset.mediaStatus=''; status.setAttribute('role','status'); status.setAttribute('aria-live','polite');
    const stop=button('Videoyu kapat','stop','mf-stop'); stop.hidden=true; toolbar.append(status,stop);
    const policy=el('p','mf-policy','Oynat dediğinde YouTube ile bağlantı kurulur. Oynatıcı sen seçmeden yüklenmez.');
    viewing.append(player,toolbar,policy); root.append(viewing);
    const stopThis = (focus=true) => { playbackGeneration++; player.replaceChildren(cover); play.disabled=false; player.removeAttribute('aria-busy'); stop.hidden=true; status.textContent='Oynatıcı kapatıldı.'; if(focus && current(stamp))play.focus({preventScroll:true}); };
    stopPlayback=stopThis; stop.addEventListener('click',()=>stopThis());
    play.addEventListener('click',async()=>{
      if(!current(stamp) || play.disabled)return;
      const attempt=++playbackGeneration;
      const relation=eventReads.get(eventSlot); relation.revision++; relation.slug=null; renderEvent(null,eventSlot);
      play.disabled=true; player.setAttribute('aria-busy','true'); stop.hidden=false; stop.textContent='Yüklemeyi iptal et'; status.textContent='Yayının güncel durumu kontrol ediliyor…';
      try {
        const supplied=await verifyPlayback(video.id);
        if(!current(stamp) || attempt!==playbackGeneration || !player.isConnected)return;
        if(supplied===null) { generation++; missing(true); return; }
        if(!supplied || typeof supplied!=='object' || Array.isArray(supplied) || !(supplied.eventSlug===null || slugOK(supplied.eventSlug)) || !Object.hasOwn(supplied,'event'))throw Error('invalid_playback_snapshot');
        const url=mediaFeaturePlaybackURL(supplied.url,video.id); if(!url)throw Error('invalid_player_url');
        relation.slug=supplied.eventSlug; relation.revision++;
        renderEvent(supplied.eventSlug===null?null:eventDTO(supplied.event,supplied.eventSlug),eventSlot);
        const frame=el('iframe'); frame.src=url; frame.title='YouTube: '+video.title; frame.loading='lazy'; frame.allow='accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; web-share'; frame.referrerPolicy='strict-origin-when-cross-origin'; frame.allowFullscreen=true; frame.tabIndex=0;
        player.replaceChildren(frame); player.removeAttribute('aria-busy'); stop.textContent='Videoyu kapat'; status.textContent='YouTube oynatıcısı açıldı. Dilersen Videoyu kapat ile bu sayfaya dönebilirsin.'; frame.focus({preventScroll:true});
      } catch {
        if(!current(stamp) || attempt!==playbackGeneration)return;
        play.disabled=false; player.removeAttribute('aria-busy'); stop.hidden=true; status.textContent='Video şu anda açılamıyor. Yeniden oynatmayı deneyebilir veya YouTube bağlantısını kullanabilirsin.'; play.focus({preventScroll:true});
      }
    });
    const body=el('section','mf-body'),about=el('div','mf-about'); about.append(el('h2','','Yayın hakkında'));
    if(video.description)about.append(el('p','mf-description',video.description)); else about.append(el('p','mf-description',video.subtitle || video.title));
    const source=el('aside','mf-source'); source.append(el('p','mf-kicker','RESMÎ KAYNAK'),el('p','mf-channel',text(channel?.name,120) || 'Archify'));
    const sourceLink=external('YouTube’da aç',video.url,'mf-link video-link'); sourceLink.dataset.mediaSource=''; sourceLink.dataset.analyticsTarget='video-external'; source.append(sourceLink);
    if(channel?.url==='https://www.youtube.com/@archifycom')source.append(external('@archifycom kanalına git',channel.url));
    body.append(about,source); root.append(body);
    const eventSlot=el('section','mf-event'); eventSlot.hidden=true; eventReads.set(eventSlot,{revision:0,slug:video.eventSlug}); root.append(eventSlot);
    const related=videos.filter(item=>item.id!==video.id).slice(0,6);
    if(related.length) {
      const section=el('section','mf-related'),head=el('div','mf-section-heading');head.append(el('h2','','Diğer yayınlar'),mediaBack());section.append(head);
      const list=el('div','mf-related-grid'); for(const item of related){const a=link('',detailHref(item.id),'mf-related-card');a.dataset.mediaRelatedId=item.id;a.append(el('p','mf-kicker',item.kind),el('h3','',item.title));if(item.subtitle)a.append(el('p','',item.subtitle));a.append(el('span','mf-related-read','Yayını keşfet ↗'));list.append(a);}section.append(list);root.append(section);
    }
    return eventSlot;
  }
  async function loadRelatedEvent(slot,slug,stamp,focus=false) {
    const relation=eventReads.get(slot);
    if(!current(stamp) || !slot.isConnected || !relation || relation.slug!==slug || slot.getAttribute('aria-busy')==='true')return;
    const revision=++relation.revision;
    slot.setAttribute('aria-busy','true'); const retryButton=slot.querySelector('button'); if(retryButton)retryButton.disabled=true;
    try { const value=await loadEvent(slug); if(current(stamp) && slot.isConnected && relation.revision===revision && relation.slug===slug){renderEvent(eventDTO(value,slug),slot);if(focus){const target=slot.querySelector('h2') || root.querySelector('[data-media-action=play]');if(target){if(target.tagName!=='BUTTON')target.tabIndex=-1;target.focus({preventScroll:true});}}} }
    catch {
      if(!current(stamp) || !slot.isConnected || relation.revision!==revision || relation.slug!==slug)return;
      renderEvent(null,slot);slot.hidden=false;
      slot.append(el('p','mf-event-unavailable','İlişkili etkinlik kaydına şu anda ulaşılamıyor. Videoyu izlemeye devam edebilirsin.'));
      const retry=button('Etkinlik kaydını yeniden dene','retry-event');retry.addEventListener('click',()=>void loadRelatedEvent(slot,slug,stamp,true));slot.append(retry);
    }
  }
  async function load(focus=false) {
    const stamp=++generation; clearPlayback();
    if(!validId(videoId)){missing();return;}
    state('loading','Yayın yükleniyor.','Archify yayın kaydı açılıyor.');root.setAttribute('aria-busy','true');
    try {
      const data=await loadMedia(); if(!current(stamp))return;
      if(!data || data.unavailable || !Array.isArray(data.videos))throw Error('unavailable');
      const seen=new Set(),videos=data.videos.slice(0,500).map(videoDTO).filter(video=>video && !seen.has(video.id) && seen.add(video.id));
      const video=videos.find(item=>item.id===videoId); if(!video){missing(focus);return;}
      const eventSlot=render(video,videos,data.channel,stamp); if(focus)root.querySelector('h1')?.focus({preventScroll:true});
      if(video.eventSlug) await loadRelatedEvent(eventSlot,video.eventSlug,stamp);
    } catch { if(current(stamp)){state('error','Yayına kısa bir ara.','Yayın bilgisine şu anda ulaşılamıyor. Yeniden deneyebilir veya tüm yayınlara dönebilirsin.');if(focus)root.querySelector('h1')?.focus({preventScroll:true});} }
  }
  function onPageHide() { playbackGeneration++; stopPlayback?.(false); root.querySelectorAll('iframe').forEach(frame=>frame.remove()); if(root.dataset.mediaFeatureState==='loading'){generation++;state('error','Yayını yeniden açalım.','Devam etmek için yayın bilgisini yeniden yükle.');} }
  const observer=new win.MutationObserver(()=>{if(root.parentNode!==host || !host.isConnected)cleanup();});observer.observe(doc.documentElement,{childList:true,subtree:true});
  function cleanup() { if(!alive)return;alive=false;generation++;clearPlayback();observer.disconnect();win.removeEventListener('pagehide',onPageHide);root.remove();if(doc.title===ownedTitle)doc.title=originalTitle;if(mounts.get(host)===cleanup)mounts.delete(host); }
  mounts.set(host,cleanup);win.addEventListener('pagehide',onPageHide);await load();return cleanup;
}
