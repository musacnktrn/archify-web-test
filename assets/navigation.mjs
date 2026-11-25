// [codex] 01a20fe8-199e-7631-8910-07e7d27b753d · progressively enhanced disclosure navigation
export function setupNavigation(doc=document,win=window){
 const menu=doc.querySelector('.menu-toggle'),nav=doc.querySelector('#site-nav');
 if(!menu||!nav)return;
 const buttons=[...doc.querySelectorAll('[data-nav-toggle]')],mobileMenu=doc.querySelector('[data-mobile-menu]');
 const menuState=value=>{menu.setAttribute('aria-expanded',String(value));menu.querySelector('span').textContent=value?'Kapat':'Menü';if(mobileMenu){mobileMenu.setAttribute('aria-expanded',String(value));mobileMenu.textContent=value?'Kapat':'Menü';}};
 const mobile=()=>win.matchMedia?win.matchMedia('(max-width: 800px)').matches:globalThis.innerWidth<=800;
 const panel=b=>doc.querySelector('#'+b.getAttribute('aria-controls'));
 const region=b=>doc.querySelector('#'+b.dataset.navToggle);
 const open=b=>b.getAttribute('aria-expanded')==='true';
 const set=(b,value)=>{b.setAttribute('aria-expanded',String(value));panel(b).hidden=!value;region(b).classList.toggle('is-expanded',value);};
 const closePanels=()=>buttons.forEach(b=>set(b,false));
 const closeMenu=()=>{menuState(false);nav.classList.remove('is-open');doc.body.classList.remove('menu-open');closePanels();};
 const toggleMenu=()=>{const value=menu.getAttribute('aria-expanded')!=='true';menuState(value);nav.classList.toggle('is-open',value);doc.body.classList.toggle('menu-open',value);if(!value)closePanels();};
 buttons.forEach(b=>{
  const group=region(b),sub=panel(b);set(b,false);
  const show=()=>{buttons.filter(other=>other!==b).forEach(other=>set(other,false));set(b,true);};
  b.addEventListener('click',()=>{const value=!open(b);closePanels();set(b,value);});
  group.addEventListener('pointerenter',e=>{if(!mobile()&&e.pointerType!=='touch')show();});
  group.addEventListener('pointerleave',()=>{if(!mobile()&&!group.contains(doc.activeElement))set(b,false);});
  group.addEventListener('focusin',e=>{if(!mobile()&&e.target!==b)show();});
  group.addEventListener('focusout',e=>{if(!group.contains(e.relatedTarget))set(b,false);});
  b.addEventListener('keydown',e=>{if(['ArrowDown','ArrowUp'].includes(e.key)){e.preventDefault();show();const links=[...sub.querySelectorAll('a[href]')];(e.key==='ArrowDown'?links[0]:links.at(-1))?.focus();}});
  sub.addEventListener('keydown',e=>{const links=[...sub.querySelectorAll('a[href]')],i=links.indexOf(doc.activeElement);if(i<0)return;const keys=['ArrowDown','ArrowUp','Home','End'];if(!keys.includes(e.key))return;e.preventDefault();const next=e.key==='Home'?0:e.key==='End'?links.length-1:(i+(e.key==='ArrowDown'?1:-1)+links.length)%links.length;links[next]?.focus();});
 });
 menu.addEventListener('click',toggleMenu);
 doc.querySelector('[data-mobile-menu]')?.addEventListener('click',()=>{toggleMenu();if(menu.getAttribute('aria-expanded')==='true')menu.focus();});
 doc.addEventListener('keydown',e=>{if(e.key!=='Escape')return;const active=buttons.find(open);if(active){e.preventDefault();set(active,false);active.focus();}else if(menu.getAttribute('aria-expanded')==='true'){e.preventDefault();closeMenu();menu.focus();}});
 doc.addEventListener('pointerdown',e=>{if(!nav.contains(e.target)&&!menu.contains(e.target)&&!doc.querySelector('[data-mobile-menu]')?.contains(e.target))closeMenu();});
 win.addEventListener('resize',()=>{if(!mobile())closeMenu();});
 return {closeMenu};
}
