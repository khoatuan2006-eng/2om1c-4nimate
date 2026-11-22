import {useEffect,useState} from 'react';
import {cancelRender,continueRender,delayRender,staticFile} from 'remotion';

export const systemFont='"System Vietnamese", Arial, sans-serif';
let ready:Promise<void>|undefined;
function loadFont(){
 return ready??=(async()=>{
  for(const [file,weight] of [['regular','400'],['bold','700']]){
   const face=new FontFace('System Vietnamese',`url("${staticFile(`images/fonts/system-vietnamese-${file}.ttf`)}")`,{weight,style:'normal'});
   document.fonts.add(await face.load());
  }
 })();
}
// Hold native frames until the exact same font used in preview is ready.
export function useSystemVietnameseFont(){
 const [handle]=useState(()=>delayRender('Nạp font tiếng Việt của bảng hệ thống'));
 useEffect(()=>{let active=true;loadFont().then(()=>{if(active)continueRender(handle);}).catch(error=>{if(active)cancelRender(error);});return()=>{active=false;continueRender(handle);};},[handle]);
}
