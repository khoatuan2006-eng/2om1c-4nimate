import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..'),out=resolve(root,'evidence/system-art');await mkdir(out,{recursive:true});
const s03file=resolve(root,'../preproduction/nhat-thanh/EP01/S01/scenes.tsx'),s06file=resolve(root,'../preproduction/nhat-thanh/EP01/S06/Scene6.tsx');
let s03=(await readFile(s03file,'utf8')).replace(/\r\n/g,'\n'),s06=(await readFile(s06file,'utf8')).replace(/\r\n/g,'\n');
await writeFile(resolve(out,'scenes-before.tsx'),s03);await writeFile(resolve(out,'Scene6-before.tsx'),s06);
const importLine="import {SystemArtwork} from '../../../../visual-editor/SystemArtwork';\n";
s03=importLine+s03;s06=importLine+s06;
const start=s03.indexOf(' {psychic&&<>'),end=s03.indexOf('\n </>}\n {caption&&',start);
if(start<0||end<0)throw Error('S03 boundaries missing');
s03=s03.slice(0,start)+` {psychic&&<>
 <SystemArtwork id="S01-234" kind={mode==='skills'?'skills':mode==='learn'?'learn':mode==='focus'?'focus':'memory'} frame={f-(mode==='skills'?cut.reveal:mode==='learn'?cut.talent:mode==='focus'?cut.focus:cut.memory)}/>
 {mode==='learn'&&<IdentityScope id="S03-art-reaction"><Person name="hero" x={110} ground={1000} h={680} still/></IdentityScope>}
 </>}`+s03.slice(end);
// Replace the procedural expanding ring on the system call with the actor's held reaction.
const ringStart=s03.indexOf(" {mode==='call'&&<EditSvg"),ringEnd=s03.indexOf('\n </>}',ringStart);if(ringStart>=0)s03=s03.slice(0,ringStart)+s03.slice(ringEnd);
const cStart=s06.indexOf('const TalentCard='),cEnd=s06.indexOf('const Scene6Base=',cStart);if(cStart<0||cEnd<0)throw Error('S06 boundaries missing');
s06=s06.slice(0,cStart)+`const TalentCard=({frame}:{frame:number})=><SystemArtwork id="S06-3" kind="learn" frame={frame} compact/>;
const SkillCard=({label,score,frame,icon}:{label:string,score:number,frame:number,icon?:string})=><SystemArtwork id="S06-9" kind={icon?'sword':label.includes('NƯỚC')?'water':'hand'} score={score} frame={frame} compact/>;
const SkillRoster=({frame}:{frame:number})=><EditDiv editorId="S06-19" editorLabel="Kỹ năng · chữ ngắn" style={{position:'absolute',left:160,top:330,width:820,color:'#f4e4be',font:'700 36px Georgia, serif',lineHeight:1.65,textShadow:'0 3px 5px #000'}}>
 <EditImg editorId="S06-19-sword" src={asset('sword')} style={{position:'absolute',left:0,top:-100,height:420,transform:'rotate(18deg)'}}/>
 <div style={{marginLeft:240}}>Kiếm thuật · 4/10<br/>Cận chiến · 6/10<br/>Dưới nước · 5/10<br/><span style={{fontSize:27}}>Đều chưa nhập môn</span></div>
</EditDiv>;

`+s06.slice(cEnd);
const lStart=s06.indexOf("  {beat.view==='learning'&&"),lEnd=s06.indexOf("\n  {beat.view==='wish'",lStart);if(lStart<0||lEnd<0)throw Error('Learning boundary');s06=s06.slice(0,lStart)+`  {beat.view==='learning'&&<SystemArtwork id="S06-55" kind="learn" frame={q} compact/>}`+s06.slice(lEnd);
await writeFile(s03file,s03);await writeFile(s06file,s06);console.log('Replaced S03/S06 procedural HUD; preserved authored timing and IDs where possible');
