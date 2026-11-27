// [codex] 01a20fd9 · Explicit binding for a new community application, in memory only.
import {createMemberClient,publicMember} from './member.mjs';
const denied=()=>Object.assign(Error('community_account_changed'),{code:'community_account_changed',status:409});
export function setupCommunityAccountChoice({doc,preview}){
 const host=doc.querySelector('#community-account-choice'),input=doc.querySelector('#community-link-account'),note=doc.querySelector('#community-account-note');
 if(preview||!host||!input||!note)return null;
 const win=doc.defaultView,client=createMemberClient({fetch:win.fetch.bind(win),location:win.location});
 let displayed=null,selected=null,version=0,visibility=0,loading=false,confirmedFor=null,paused=doc.hidden;
 const change=()=>{version++;selected=input.checked?displayed:null;confirmedFor=null;};
 input.addEventListener('change',change);
 function hide(){paused=true;visibility++;displayed=null;host.hidden=true;input.disabled=true;note.textContent='';client.clear();
  if(confirmedFor){doc.querySelector('#form-status')?.replaceChildren();confirmedFor=null;}
 }
 async function session(){const s=await client.request('member/session');if(!s.available||!s.member)return null;const m=publicMember(s.member);return {...m,csrf:s.csrfToken};}
 async function show(){if(doc.hidden)return;paused=false;const n=++visibility;loading=true;try{
  const member=await session();if(paused||n!==visibility)return;displayed=member?.id||null;
  host.hidden=!member&&!selected;input.disabled=!member&&!selected;
  input.checked=Boolean(selected);
  note.textContent=selected&&selected!==displayed?'Açık hesap değişti. Önceki hesapla devam edebilir veya hesapta takip seçimini açıkça kaldırabilirsin.':member?'Açık hesap · '+member.displayName:'';
 }catch{if(!paused&&n===visibility){displayed=null;host.hidden=!selected;input.disabled=!selected;note.textContent=selected?'Üye oturumu doğrulanamadı. Doğru hesapla yeniden dene.':'';}}
 finally{if(n===visibility)loading=false;}}
 const visible=()=>doc.hidden?hide():void show();doc.addEventListener('visibilitychange',visible);win.addEventListener('pagehide',hide);win.addEventListener('pageshow',e=>{if(e.persisted)void show();});
 if(!paused)void show();
 function capture(){
  if(!selected&&!input.checked)return null;
  if(!selected||paused||loading||!displayed||displayed!==selected)throw denied();
  const owner=selected,choiceVersion=version;
  return async application=>{
   const epoch=visibility;
   const check=()=>{if(paused||doc.hidden||epoch!==visibility||version!==choiceVersion||selected!==owner||!input.checked)throw denied();};
   const verify=async()=>{check();const m=await session();check();if(m?.id!==owner)throw denied();client.setCSRF(m.csrf);};
   await verify();const result=await client.request('member/community-applications',{linkToAccount:true,application});
   try{await verify();}catch{throw Object.assign(Error('community_result_unconfirmed'),{code:'community_result_unconfirmed',status:0});}
   confirmedFor=owner;return result;
  };
 }
 return {capture,complete(){selected=null;input.checked=false;version++;}};
}
