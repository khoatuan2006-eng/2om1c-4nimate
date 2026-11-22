import {readFile,writeFile} from 'node:fs/promises';
const root='preproduction/nhat-thanh/EP01/S06/';
const path=root+'scene-data.json',d=JSON.parse(await readFile(path));
await writeFile('visual-editor/evidence/s06-flashback-preview/scene-data-before-alignment.json',JSON.stringify(d,null,2));
// Phrase starts from ASR of the actual s06-mai.mp3, 30fps. Keep authored wording.
const anchors=[[0,0],[120,106],[225,189],[365,302],[485,460],[560,543],[600,563],[735,644],[795,699],[855,785],[915,874],[965,941],[1017,975],[1070,1006],[1120,1050],[1180,1090],[1240,1169],[1300,1223],[1348,1307],[1396,1396]];
function map(f){const i=anchors.findIndex(a=>a[0]>=f);if(i===0)return 0;const [a,b]=[anchors[i-1],anchors[i]];return Math.round(a[1]+(f-a[0])/(b[0]-a[0])*(b[1]-a[1]));}
for(const list of [d.beats,d.shots,d.cues])for(const entry of list){entry.from=map(entry.from);entry.to=map(entry.to);}
const sword=d.beats.find(b=>b.view==='skill-sword');sword.from=921;
d.beats.splice(d.beats.indexOf(sword),0,{from:874,to:921,view:'skill-list',bg:'s05-cabin',meaning:'Show the three-skill overview on the spoken introduction, then emphasize sword only when named.'});
const intro=d.cues.findIndex(c=>c.from===874);d.cues[intro].to=921;d.cues[intro].text='Ba kỹ năng đã hiện lên:';d.cues.splice(intro+1,0,{from:921,to:941,text:'kiếm thuật,'});
const last=d.cues.pop();d.cues.push({from:1169,to:1258,text:'Nhật Thành nhìn những kỹ năng còn dang dở rồi khép bàn tay lại.'},{from:1258,to:1307,text:'Lợi thế này không thể thắng thay cậu.'},{from:1307,to:1396,text:'Nhưng nếu tiếp tục học, nó có thể cho cậu cơ hội sống sót.'});
await writeFile(path,JSON.stringify(d,null,2));
await writeFile('visual-editor/evidence/s06-flashback-preview/audio-alignment.json',JSON.stringify({audio:'visual-editor/data/media/audio/s06-mai.mp3',fps:30,method:'Local faster-whisper base word timestamps, authored transcript preserved; ASR spelling is not used as subtitles.',anchors,limitation:'ASR boundaries are estimates; not a forced-alignment or continuous listening certification.'},null,2));
