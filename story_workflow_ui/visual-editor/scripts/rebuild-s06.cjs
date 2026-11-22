const fs=require('fs');
const p='preproduction/nhat-thanh/EP01/S06/Scene6.tsx';let s=fs.readFileSync(p,'utf8');
s="import {SkillSequence} from './SkillSequence';\nimport acting from '../../../../visual-editor/s06-acting.json';\nimport {systemFont,useSystemVietnameseFont} from '../../../../visual-editor/SystemVietnameseFont';\n"+s;
s=s.replace(' const f=useCurrentFrame();',' useSystemVietnameseFont();\n const f=useCurrentFrame();');
s=s.replace("src={asset('s05r30-seated-blue')}","src={staticFile(acting.reflect.src)}").replace("left:1175,top:240,width:230,transform:'scaleX(-1)'","left:1470,top:310,height:640,width:'auto',transform:'scaleX(-1)'");
s=s.replace("src={asset('hero')}","src={staticFile(acting.resolve.src)}").replace('left:1190,bottom:78,width:420','left:1080,bottom:-240,width:650');
s=s.replace("const cabin=['cabin'","const cabin=['cabin'");
s=s.replace("const TalentCard=({frame}:{frame:number})=><SystemArtwork id=\"S06-3\" kind=\"learn\" frame={frame} compact/>","const TalentCard=({frame}:{frame:number})=><SkillSequence view=\"talent\" frame={frame}/>");
s=s.replace(/const SkillCard=.*?;\r?\n/,'const SkillCard=({label,score,frame,icon}:{label:string,score:number,frame:number,icon?:string})=><SkillSequence view={icon?\'skill-sword\':label.includes(\'NƯỚC\')?\'skill-water\':\'skill-hand\'} frame={frame}/>;\n');
const start=s.indexOf('const SkillRoster=');const end=s.indexOf('\n\nconst Scene6Base',start);
s=s.slice(0,start)+'const SkillRoster=({frame}:{frame:number})=><SkillSequence view="skill-list" frame={frame}/>;'+s.slice(end);
s=s.replace('<SystemArtwork id="S06-55" kind="learn" frame={q} compact/>','<SkillSequence view="learning" frame={q+25}/>');
s=s.replace("fontFamily:'Arial'","fontFamily:systemFont");
// A genuine close-up, applied to the complete cabin image rather than a floating face patch.
s=s.replace("transformOrigin:origin}}><IdentityScope", "transformOrigin:origin}}><IdentityScope");
s=s.replace("width:[170,180,190,180][i]","width:[290,310,330,300][i]").replace("left:[80,500,980,1450][i]","left:[170,570,1010,1450][i]").replace("bottom:[430,360,380,415][i]-5","bottom:[170,135,125,160][i]-5").replaceAll('([430,360,380,415][i])','([170,135,125,160][i])').replace('([430,360,380,415][i])-22','([170,135,125,160][i])-22');
fs.writeFileSync(p,s);
// Keep all original cue boundaries and audio. Reduce repeated code inserts and let the emotional reaction land.
const d='preproduction/nhat-thanh/EP01/S06/scene-data.json',data=JSON.parse(fs.readFileSync(d));
for(const b of data.beats){if(b.from===45){b.view='cabin';b.bg='s05-cabin';}if(b.from===88){b.view='reaction';b.bg='s05-cabin';}if(b.from===680){b.view='office';}if(b.from===795){b.view='reaction';b.bg='s05-cabin';}if(b.from===1240){b.view='resolve';}}
fs.writeFileSync(d,JSON.stringify(data,null,2));
let fixture=fs.readFileSync('visual-editor/test-fixtures/s05-editor-review.mjs','utf8').replaceAll('s05-editor-review','s06-editor-review').replaceAll("['S05']","['S06']");fixture=fixture.replace(/const frames=\[.*?\],tiles=\[\];/,'const frames=[0,44,45,87,88,119,120,179,180,224,225,279,280,314,315,364,365,424,425,484,485,534,535,559,580,599,600,645,679,680,734,735,794,795,854,855,900,914,915,940,964,965,990,1016,1017,1040,1069,1070,1119,1120,1179,1180,1239,1240,1299,1300,1347,1348,1395],tiles=[];');fs.writeFileSync('visual-editor/test-fixtures/s06-editor-review.mjs',fixture);
