import {parallaxMatrix} from './parallax.mjs';
import {multiply,hierarchy} from './scene-graph.mjs';
import {worldMatrix,visibleInHierarchy} from './scene-graph.mjs';
import React,{createContext,useContext,useRef,useLayoutEffect} from 'react';
import {Img,useCurrentFrame,staticFile} from 'remotion';
import {layerRole,effectiveZ} from './layer-order.mjs';
import {valueAt} from './model.mjs';
import {legacySavedEdits as saved} from '@legacy-scenes';

export type EditDocument={version:number;revision:number;layers:Record<string,any>;casting?:{characterId:string;name:string;source:string;images:Record<string,any>}};
export type LayerInfo={id:string;label:string;element:HTMLElement;start:number;end:number;role:string;authoredZ:number};
export const EditorContext=createContext<any>(null);
export function editorKey(value:unknown){if(value&&typeof value==='object'){const v=value as any;return String(v.id??`${v.name??'item'}-${v.x0??v.x??''}`)}return String(value)}
const Scope=createContext<{scene:string;frame:number;start:number;end:number;path:string}>({scene:'',frame:0,start:0,end:1,path:''});
export const IdentityScope=({id,children}:{id:string;children:React.ReactNode})=>{const p=useContext(Scope);return <Scope.Provider value={{...p,path:p.path+'/'+id}}>{children}</Scope.Provider>};
export function SceneScope({scene,shots,children}:{scene:string;shots:Array<{from:number;to:number}>;children:React.ReactNode}){
 const editor=useContext(EditorContext),doc=editor?.scene===scene?editor.document:(saved as any)[scene];
 const frame=useCurrentFrame();
 const replacement=Object.values(doc?.layers??{}).some((l:any)=>l.asset?.type==='backgrounds'&&useFrameInRange(l.asset));
 function useFrameInRange(a:any){return frame>=a.from&&frame<a.to;}
 const shot=shots.find(s=>frame>=s.from&&frame<s.to)??shots[0];
 return <Scope.Provider value={{scene,frame,start:shot?.from??0,end:shot?.to??1,path:`${scene}/shot-${shot?.from??0}`}}><div className={replacement?"scene-library-replacement":undefined} style={{position:'absolute',inset:0}}>{replacement&&<style>{`.scene-library-replacement > div:not([data-edit-id]) {background:transparent !important;}`}</style>}<AddedAssets background/>{children}<AddedAssets/></div></Scope.Provider>;
}
function useEdit(id:string,label:string,style:React.CSSProperties|undefined,ref:React.RefObject<any>,tag:string){
 const scope=useContext(Scope),editor=useContext(EditorContext),fullId=id.startsWith(scope.scene+'/shot-')?id:scope.path+'/'+id;
 const doc=editor?.scene===scope.scene?editor.document:(saved as any)[scope.scene];
 const role=doc?.layers?.[fullId]?.asset?.type==='backgrounds'?'background':layerRole(tag,style),authoredZ=Number(style?.zIndex)||0;
 const layer=doc?.layers?.[fullId],v=valueAt(layer,scope.frame);
 useLayoutEffect(()=>{
  if(!editor||!ref.current||!scope.scene)return;
  const element=ref.current;
  editor.register({id:fullId,label,element,start:layer?.asset?.from??scope.start,end:layer?.asset?.to??scope.end,role,authoredZ});
  return ()=>editor.unregister(fullId,element);
 },[editor?.register,fullId,label,scope.start,scope.end,role,authoredZ,layer?.asset?.from,layer?.asset?.to]);
 const neutral=!layer||Object.keys(layer.base??{}).length===0&&Object.values(layer.keys??{}).every((k:any)=>!k.length);
 const chain:string[]=layer?.asset?hierarchy(doc.layers,fullId):[],hasOpacity=chain.some((id:string)=>doc.layers[id]?.base?.opacity!==undefined||doc.layers[id]?.keys?.opacity?.length);
 // Layers are flat siblings (hierarchy is only a matrix), so a parent's fade must be multiplied into its children here.
 const opacity=hasOpacity?chain.reduce((product:number,id:string)=>product*valueAt(doc.layers[id],scope.frame).opacity,Number(style?.opacity??1)):undefined;
 const next=neutral?(hasOpacity?{...style,opacity}:style):{...style,translate:`${v.x}px ${v.y}px`,scale:`${v.scale*(v.flipX?-1:1)} ${v.scale*(v.flipY?-1:1)}`,rotate:`${v.rotation}deg`,...(hasOpacity?{opacity}:{}),...(layer.base?.z!==undefined||layer.keys?.z?.length?{zIndex:v.z}:{})};
 const replacement=role==='background'&&!layer?.asset&&Object.values(doc?.layers??{}).some((l:any)=>l.asset?.type==='backgrounds'&&scope.frame>=l.asset.from&&scope.frame<l.asset.to);
 const ordered=role!=='object'||layer?.base?.z!==undefined||layer?.keys?.z?.length?{...next,zIndex:effectiveZ(role,layer,v.z,authoredZ)}:next;
 if(layer?.asset&&(layer.parentId||hierarchy(doc.layers,fullId).some((id:string)=>doc.layers[id].camera?.enabled))){const m=multiply(parallaxMatrix(doc.layers,fullId,scope.frame),worldMatrix(doc.layers,fullId,scope.frame));Object.assign(ordered!,{left:0,top:0,translate:'none',scale:'none',rotate:'none',transformOrigin:'0 0',transform:`matrix(${m.join(',')})`});}
 return {style:replacement?{...ordered,visibility:'hidden' as const}:ordered,'data-edit-id':fullId,'data-edit-label':label};
}
export function EditImg({editorId,editorLabel,characterVariant,...props}:React.ComponentProps<typeof Img>&{editorId:string;editorLabel?:string;characterVariant?:string}){
 const scope=useContext(Scope),editor=useContext(EditorContext),doc=editor?.scene===scope.scene?editor.document:(saved as any)[scope.scene];
 const name=props.src.split('/').pop()?.split('?')[0]?.replace(/\.png$/,'')??'';
 const replacement=doc?.casting?.images?.[characterVariant?name+':'+characterVariant:name]??doc?.casting?.images?.[name];
 const ref=useRef<HTMLImageElement>(null),label=editorLabel??props.src.split('/').pop()?.replace('.png','')??'Hình';
 const edits=useEdit(editorId,replacement&&!replacement.hidden?(replacement.label??'Nhật Thành')+' · '+replacement.pose+' · '+replacement.face:label,props.style,ref,'IMG');
 const style=replacement?{...edits.style,...(characterVariant?{clipPath:undefined}:{}),...(replacement.hidden?{visibility:'hidden' as const}:{})}:edits.style;
 return <Img {...props} {...edits} src={replacement?.src?staticFile(replacement.src):props.src} style={style} ref={ref}/>;
}
export function EditDiv({editorId,editorLabel,...props}:React.HTMLAttributes<HTMLDivElement>&{editorId:string;editorLabel?:string}){
 const ref=useRef<HTMLDivElement>(null);const label=editorLabel??(typeof props.children==='string'?props.children.slice(0,35):'Nhóm / chữ');
 const edits=useEdit(editorId,label,props.style,ref,'DIV');
 return <div {...props} {...edits} ref={ref}><IdentityScope id={editorId}>{props.children}</IdentityScope></div>;
}
export function EditSvg({editorId,...props}:React.SVGProps<SVGSVGElement>&{editorId:string}){
 const ref=useRef<SVGSVGElement>(null),edits=useEdit(editorId,'Đồ họa SVG',props.style,ref,'SVG');
 return <svg {...props} {...edits} ref={ref}>{props.children}</svg>;
}

function AddedAssets({background=false}:{background?:boolean}){
 const scope=useContext(Scope),editor=useContext(EditorContext),doc=editor?.scene===scope.scene?editor.document:(saved as any)[scope.scene];
 return <>{Object.entries(doc?.layers??{}).map(([id,l]:any)=>{const a=l.asset;if(!a||(a.type==='backgrounds')!==background||!visibleInHierarchy(doc.layers,id,scope.frame))return null;return <EditDiv key={id} editorId={id} editorLabel={a.name} style={{position:'absolute',left:a.left,top:a.top,width:a.width,height:a.height,zIndex:a.type==='backgrounds'?0:100,transformOrigin:'50% 50%'}}>{a.parts.map((p:any,i:number)=><Img key={i} src={staticFile(p.src)} style={{position:'absolute',left:p.left,top:p.top,width:p.width,height:p.height,pointerEvents:'none'}}/>)}</EditDiv>})}</>;
}
