import React from 'react';
import {interpolate, staticFile} from 'remotion';
import {EditDiv, EditImg} from './Editable';
import art from './system-art.json';
import {systemFont,useSystemVietnameseFont} from './SystemVietnameseFont';

const clamp={extrapolateLeft:'clamp',extrapolateRight:'clamp'} as const;
type Kind='skills'|'learn'|'focus'|'memory';
// These are illustrative mental images, not additional abilities or brain anatomy.
export function SystemAbilityPanel({kind,frame,knowledgeTokens}:{kind:Kind;frame:number;knowledgeTokens?:string[]}){
 useSystemVietnameseFont();
 const melee=kind==='skills'&&frame>=66;
 const title=kind==='skills'?(melee?'CẬN CHIẾN':'KIẾM THUẬT'):kind==='learn'?'HỌC CÓ THU HOẠCH':kind==='focus'?'TẬP TRUNG':'KHÔNG BAO GIỜ QUÊN';
 const sprite=(name:string,id:string,style:React.CSSProperties)=><EditImg editorId={id} editorLabel={'Minh họa · '+name} src={staticFile(`images/system-ability-${name}.png`)} style={{position:'absolute',objectFit:'contain',...style}}/>;
 const tokens=knowledgeTokens??['剑','学','知','忆','练','悟','书','记'];
 return <EditDiv editorId="S01-234" editorLabel="Bảng hệ thống · diễn giải năng lực" style={{position:'absolute',left:210,top:95,width:1500,height:820,background:'#172d39ed',border:'2px solid #93b3bc',borderRadius:12,boxShadow:'0 15px 45px #0008',overflow:'hidden',opacity:interpolate(frame,[0,7],[0,1],clamp)}}>
  <EditDiv editorId="system-heading" style={{position:'absolute',left:48,top:26,color:'#acc4c9',font:`26px ${systemFont}`,letterSpacing:3}}>NHẬT THÀNH / HỆ THỐNG</EditDiv>
  <EditDiv editorId="ability-heading" style={{position:'absolute',left:48,top:78,color:'#f2e7cc',font:`bold 46px ${systemFont}`}}>{title}</EditDiv>
  {kind==='skills'&&<>
   {!melee&&sprite(frame<24?'ready':'slash','sword-action',{left:220+interpolate(frame,[20,30],[0,80],clamp),top:160,width:780,height:535})}
   {melee&&<EditImg editorId="melee-action" editorLabel="Nhật Thành · ra đòn" src={staticFile(art.fist.src)} style={{position:'absolute',left:620+interpolate(frame,[66,80],[0,95],clamp),top:178,height:520,width:'auto'}}/>}
   <EditDiv editorId="skill-state" style={{position:'absolute',right:70,top:220,color:'#dfcfa9',font:`30px ${systemFont}`}}>Chưa nhập môn</EditDiv>
  </>}
  {kind==='learn'&&<>
   {sprite('read','reading',{left:80,top:190,width:650,height:505})}
   {frame>=32&&sprite('think','absorbing',{left:900,top:170,width:460,height:490,opacity:interpolate(frame,[32,44],[0,1],clamp)})}
   {tokens.map((text,i)=>{const p=interpolate(frame,[36+i*7,63+i*7],[0,1],clamp);return p>0&&p<1?<EditDiv key={i} editorId={'knowledge-'+i} editorLabel="Kiến thức từ sách vào trí nhớ" style={{position:'absolute',left:425+p*700,top:550-p*310-Math.sin(p*Math.PI)*140,font:`bold 42px ${systemFont}`,color:'#e7d6a5',opacity:Math.sin(p*Math.PI),transform:`rotate(${i%2?12:-12}deg) scale(${1-p*.4})`}}>{text}</EditDiv>:null;})}
   <EditDiv editorId="learning-meaning" style={{position:'absolute',left:50,right:50,bottom:38,textAlign:'center',font:`32px ${systemFont}`,color:'#dfd8c4'}}>{frame<36?'Đọc · học · luyện tập':'Mỗi lần học đều có tiến bộ'}</EditDiv>
  </>}
  {(kind==='focus'||kind==='memory')&&<>
   {sprite('think','thinking',{left:60,top:180,width:540,height:510})}
   {sprite('brain','memory-map',{left:650,top:170,width:650,height:440})}
   {kind==='focus'&&<EditDiv editorId="focus-word" style={{position:'absolute',left:850,top:640,color:'#f2e7cc',font:`36px ${systemFont}`}}>Chú tâm vào điều đang học</EditDiv>}
   {kind==='memory'&&['sword','book','experience'].map((name,i)=><EditDiv key={name} editorId={'memory-area-'+name} editorLabel={'Ký ức · '+name} style={{position:'absolute',left:645+i*245,top:510+interpolate(frame,[i*4,i*4+8],[45,0],clamp),width:220,height:195,opacity:interpolate(frame,[i*4,i*4+6],[0,1],clamp),background:'#10232de8',border:'1px solid #7c9c9f',borderRadius:8}}>
    {sprite(name==='sword'?'ready':name==='book'?'book':'read','remember-'+name,{left:30,top:5,width:160,height:135})}
    <EditDiv editorId={'memory-label-'+name} style={{position:'absolute',bottom:15,width:'100%',textAlign:'center',color:'#eadfc6',font:`25px ${systemFont}`}}>{['Kiếm thuật','Kiến thức','Trải nghiệm'][i]}</EditDiv>
   </EditDiv>)}
  </>}
  {kind==='skills'&&<EditDiv editorId="skill-footer" style={{position:'absolute',bottom:35,left:50,right:50,color:'#b5c6c6',font:`29px ${systemFont}`,textAlign:'center'}}>Kỹ năng cần học và rèn luyện</EditDiv>}
 </EditDiv>;
}

