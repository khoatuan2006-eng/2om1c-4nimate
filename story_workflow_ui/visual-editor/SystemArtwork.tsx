import React from 'react';
import {staticFile,interpolate} from 'remotion';
import {EditDiv,EditImg} from './Editable';
import art from './system-art.json';
const clamp={extrapolateLeft:'clamp',extrapolateRight:'clamp'} as const;
// Artwork is raster PSD material; these controls only stage, reveal and label it.
export function SystemArtwork({id,kind,frame=0,compact=false,score}:{id:string;kind:'skills'|'learn'|'focus'|'memory'|'sword'|'hand'|'water';frame?:number;compact?:boolean;score?:number}){
 const actor=kind==='skills'||kind==='hand'?'fist':kind==='focus'?'focus':'memory';
 const title={skills:'KIẾM THUẬT · CẬN CHIẾN',learn:'HỌC CÓ THU HOẠCH',focus:'TẬP TRUNG',memory:'GHI NHỚ',sword:'KIẾM THUẬT',hand:'CẬN CHIẾN',water:'CHIẾN ĐẤU DƯỚI NƯỚC'}[kind];
 const reveal=interpolate(frame,[0,10],[0,1],clamp);
 const portrait=!compact&&(kind==='focus'||kind==='memory');
 return <EditDiv editorId={id} editorLabel={'Minh họa · '+title} style={{position:'absolute',left:kind==='water'?0:compact?120:220,top:kind==='water'?0:compact?225:110,width:kind==='water'?1920:compact?850:1450,height:kind==='water'?1080:compact?610:760,opacity:reveal,transform:`translateY(${interpolate(frame,[0,12],[12,0],clamp)}px)`}}>
  {(kind==='skills'||kind==='hand'||kind==='focus'||kind==='memory')&&<EditImg editorId={id+'-actor'} editorLabel={'Nhật Thành · '+art[actor].pose} src={staticFile(art[actor].src)} style={{position:'absolute',left:kind==='skills'?700:compact?330:470,top:portrait?-65:undefined,bottom:portrait?undefined:95,height:portrait?1350:compact?470:650,width:'auto',filter:'drop-shadow(0 7px 4px #0007)'}}/>}
  {(kind==='skills'||kind==='sword')&&<EditImg editorId={id+'-sword'} editorLabel="Kiếm · artwork" src={staticFile('images/sword.png')} style={{position:'absolute',left:kind==='skills'?180:compact?310:560,top:45,height:compact?400:580,transform:'rotate(22deg)',filter:'drop-shadow(0 6px 4px #0007)'}}/>}
  {kind==='learn'&&<EditImg editorId={id+'-book'} editorLabel="Sách · artwork" src={staticFile('images/system-book.png')} style={{position:'absolute',left:compact?85:320,top:60,width:compact?650:800,height:'auto',filter:'drop-shadow(0 9px 6px #0008)'}}/>}
  {kind==='water'&&<EditImg editorId={id+'-water'} editorLabel="Ký ức bến nước" src={staticFile('images/harbor-memory.png')} style={{position:'absolute',inset:0,width:1920,height:1080,objectFit:'cover',filter:'brightness(.72) saturate(.75)'}}/>}
  <EditDiv editorId={id+'-title'} style={{position:'absolute',left:0,right:0,bottom:kind==='water'?180:35,textAlign:'center',font:'700 40px Georgia, serif',color:'#f4e4be',textShadow:'0 3px 5px #000, 0 1px 2px #000'}}>{title}{score!==undefined&&<span style={{display:'block',font:'28px Georgia, serif',marginTop:10,color:'#e9dcc5'}}>{score}/10 · Chưa nhập môn</span>}</EditDiv>
 </EditDiv>;
}
