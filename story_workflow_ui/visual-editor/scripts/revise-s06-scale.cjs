const fs=require('fs');const p='preproduction/nhat-thanh/EP01/S06/PirateEra.tsx';let s=fs.readFileSync(p,'utf8');s="import {PirateCrowd,PirateFleet} from './WorldScale';\n"+s;s=s.replace("import {systemFont} from '../../../../visual-editor/SystemVietnameseFont';\n",'');s=s.replace("frame<205?'red':frame<290?'white':frame<385?'cross':'era'","frame<225?'red':frame<295?'white':frame<365?'cross':frame<405?'fleet':'era'");s=s.replace("phase==='white'?205:phase==='cross'?290:385","phase==='white'?225:phase==='cross'?295:phase==='fleet'?365:405");
s=s.replace(/\{current&&<>.*?\{current.title\}<\/EditDiv><\/>\}/s,'{current&&<><PirateCrowd frame={q}/>{current.members.map(actor)}</>}');
s=s.replace(/ <EditDiv editorId="era-title".*?<\/EditDiv>/s,' <PirateCrowd frame={q} wide/>');
s=s.replace(/ <EditDiv editorId="crew-title".*?<\/EditDiv>/s,'');
s=s.replace(/ <EditDiv editorId="crew-depth".*?<\/EditDiv>/s,'');
s=s.replace("top:125,width:625,height:795","top:160,width:625,height:760");
s=s.replace("{phase==='era'&&<>","{phase==='fleet'&&<PirateFleet frame={q}/>}\n {phase==='era'&&<>");
fs.writeFileSync(p,s);
let f=fs.readFileSync('visual-editor/test-fixtures/s06-editor-review.mjs','utf8').replace('evidence/s06-editor-review','evidence/s06-pirate-era/world-scale-preview').replace(/const frames=\[.*?\],tiles=\[\];/,'const frames=[119,120,145,180,224,225,250,280,294,295,320,350,364,365,380,404,405,420,440,460,480,484,485],tiles=[];');fs.writeFileSync('visual-editor/test-fixtures/s06-world-scale.mjs',f);
