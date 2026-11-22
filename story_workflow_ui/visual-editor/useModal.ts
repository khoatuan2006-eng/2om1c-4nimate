import {useEffect,useRef} from 'react';

export function useModal(open:boolean){
 const ref=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  if(!open)return;
  const previous=document.activeElement as HTMLElement,overflow=document.body.style.overflow;
  document.body.style.overflow='hidden';
  // Hide every sibling branch from interaction, preserving any existing inert
  // state (for example a workspace already locked by a pending operation).
  const backgrounds=new Map<HTMLElement,boolean>();
  const parents=new Set<HTMLElement>();
  const isolate=()=>{for(let branch:HTMLElement|null=ref.current;branch?.parentElement;branch=branch.parentElement){
   parents.add(branch.parentElement);
   for(const sibling of Array.from(branch.parentElement.children))if(sibling!==branch&&sibling instanceof HTMLElement&&!backgrounds.has(sibling)){backgrounds.set(sibling,sibling.inert);sibling.inert=true;}
   if(branch.parentElement===document.body)break;
  }};
  isolate();
  // React can insert alerts or other background branches after the dialog opens.
  // Observe only ancestor child lists, not the preview's per-frame subtree.
  const observer=new MutationObserver(isolate);for(const parent of parents)observer.observe(parent,{childList:true});
  const elements=()=>Array.from(ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled):not([type="hidden"]),select:not(:disabled),textarea:not(:disabled),a[href],summary,audio[controls],video[controls],[tabindex]')??[]).filter(el=>el.tabIndex>=0&&!el.matches(':disabled')&&!el.closest('[inert]')&&el.getClientRects().length);
  const focus=()=>{const first=elements()[0];if(first)first.focus();else if(ref.current){ref.current.tabIndex=-1;ref.current.focus();}};
  focus();
  const trap=(event:KeyboardEvent)=>{if(event.key!=='Tab')return;const items=elements(),first=items[0],last=items.at(-1);if(!items.length){event.preventDefault();focus();}else if(!ref.current?.contains(document.activeElement)){event.preventDefault();(event.shiftKey?last:first)?.focus();}else if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}};
  const node=ref.current;node?.addEventListener('keydown',trap);
  return()=>{observer.disconnect();node?.removeEventListener('keydown',trap);for(const [element,inert] of backgrounds)element.inert=inert;document.body.style.overflow=overflow;if(previous?.isConnected&&!previous.matches(':disabled')&&!previous.closest('[inert]'))previous.focus();else document.querySelector<HTMLElement>('header button:not(:disabled)')?.focus();};
 },[open]);
 return ref;
}
