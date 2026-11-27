// [codex] 01a20fd9-f999-7b90-8b1b-b8cd977d4517 · Search only enumerates documented public catalogues.
import {apiURL,isPreviewDeployment} from './core.mjs';
import {setupNavigation} from './navigation.mjs';
import {buildSiteSearchIndex,searchSite} from './site-search-index.mjs';
import {mountSiteSearch} from './site-search-view.mjs';

const host=document.querySelector('#site-search-root');
const base=new URL('./',location.href);
const preview=isPreviewDeployment(document,location);
async function read(url){
 const response=await fetch(url,{method:'GET',credentials:'omit',cache:'no-store',redirect:'error',headers:{Accept:'application/json'},signal:AbortSignal.timeout(10000)});
 if(!response.ok)throw Error('public_catalog_unavailable');
 return response.json();
}
async function readSources(){
 const jobs=[
  read(preview?new URL('data/catalog.json',base):apiURL('events',base)).then(value=>Array.isArray(value?.events)?value.events:null),
  read(new URL('data/editorial.json',base)),read(new URL('data/community-profiles.json',base)),
  read(preview?new URL('data/media.json',base):apiURL('site-media',base))
 ];
 const results=await Promise.allSettled(jobs),[events,editorial,profiles,media]=results.map(r=>r.status==='fulfilled'?r.value:null);
 return {preview,events,editorial,profiles,media};
}
document.documentElement.classList.add('js');
setupNavigation();
for(const button of document.querySelectorAll('[data-consent-preferences]'))button.hidden=true;
const notice=document.querySelector('#deployment-notice');if(notice)notice.hidden=!preview;
if(host)mountSiteSearch({host,readSources,buildIndex:buildSiteSearchIndex,search:searchSite});
