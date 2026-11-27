// [codex] 01a20fd9-f999-7b90-8b1b-b8cd977d4517 · Optional, first-party measurement for the published photo archive.
import {setupAnalytics} from './analytics.mjs';
import {apiURL} from './core.mjs';

export function mountAlbumMeasurement({document,window,host,selectedSlug,preview}){
  const base=new URL('./',window.location.href);
  let csrf='';
  async function request(route,body){
    if(preview||!['session','analytics/consent','analytics/collect'].includes(route))throw Error('invalid_route');
    const read=route==='session';
    const response=await window.fetch(apiURL(route,base),{method:read?'GET':'POST',credentials:'same-origin',cache:'no-store',
      redirect:'error',referrerPolicy:'no-referrer',keepalive:route==='analytics/collect',signal:AbortSignal.timeout(10000),
      headers:read?{Accept:'application/json'}:{'Content-Type':'application/json','X-CSRF-Token':csrf},...(read?{}:{body:JSON.stringify(body)})});
    const value=await response.json();
    if(!response.ok)throw Object.assign(Error('analytics_unavailable'),{code:value?.error,status:response.status});
    return value;
  }
  async function session(){
    const value=await request('session');
    if(typeof value.csrfToken!=='string'||!value.csrfToken)throw Error('analytics_unavailable');
    csrf=value.csrfToken;return value;
  }
  const analytics=setupAnalytics({document,window,location:window.location,preview,request,session});
  let last='',confirmedInput=false;
  function sync(){
    const root=host.querySelector('[data-albums-state]');
    let ctx=null;
    if(!document.hidden && root && ['ready','empty'].includes(root.dataset.albumsState)){
      if(selectedSlug===null){
        ctx={kind:'directory',slugs:[...root.querySelectorAll('[data-album-slug]')].map(e=>e.dataset.albumSlug)};
      }else if(root.dataset.albumsState==='ready' && root.querySelector('[data-album-photo]')){
        ctx={kind:'event',slug:selectedSlug};
      }
    }
    const key=ctx?JSON.stringify(ctx):'';
    if(key!==last){last=key;analytics.replaceAlbumContext(ctx);}
    return !!ctx;
  }
  // The public gallery commits a ready view only after its current request wins.
  const observer=new window.MutationObserver(sync);
  observer.observe(host,{childList:true,subtree:true,attributes:true,attributeFilter:['data-albums-state']});
  function action(target,slug){if(sync())analytics.recordAlbumAction(target,slug);}
  function click(event){
    const node=event.target;
    if(!node?.closest)return;
    const link=node.closest('[data-album-slug] a');
    if(link){action('album-open',link.closest('[data-album-slug]').dataset.albumSlug);return;}
    if(node.closest('[data-albums-more]'))action('album-more');
    else if(node.closest('[data-albums-refresh]'))action('album-refresh');
    else if(node.closest('[data-albums-clear]'))action('album-filter');
  }
  function change(event){
    if(event.target.matches?.('[data-albums-category],[data-albums-city],[data-albums-year]'))action('album-filter');
  }
  function input(event){if(event.target.matches?.('[data-albums-query]'))confirmedInput=true;}
  function confirm(event){
    if(!confirmedInput||!event.target.matches?.('[data-albums-query]')||(event.type==='keydown'&&event.key!=='Enter'))return;
    confirmedInput=false;action('album-search');
  }
  function clear(){last='';confirmedInput=false;analytics.replaceAlbumContext(null);}
  host.addEventListener('click',click,true);host.addEventListener('change',change,true);
  host.addEventListener('input',input,true);host.addEventListener('keydown',confirm,true);host.addEventListener('focusout',confirm,true);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)clear();});
  window.addEventListener('pagehide',clear);
  return {openedPhoto(){action('album-photo-open');}};
}
