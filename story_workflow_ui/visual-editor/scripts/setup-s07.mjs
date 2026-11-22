import {readFile,writeFile} from 'node:fs/promises';
const root='preproduction/nhat-thanh/EP01/S07/';
const lines=[
[0,'street','Trở lại con phố trước mắt, Nhật Thành cảm nhận rõ năm kẻ vẫn bám sát phía sau.'],
[4.48,'watch','Không cần quay đầu liên tục, cậu cũng biết chúng chưa hề bỏ cuộc.'],
[7.72,'sense','Tinh thần vượt xa người thường khiến cảm giác của cậu nhạy bén hơn.'],
[10.74,'wound','Sau lần bị thương và đổ máu, Nhật Thành đã hiểu thế nào là sát khí.'],
[14.48,'threat','Lần này, cảm giác ấy đến từ chính những kẻ đang theo đuôi mình.'],
[17.86,'orders','Mấy ngày qua, Canis không ít lần sai bốn tên đàn em gây chuyện với cậu.'],
[21.82,'guard','Chính những lần bị ép phải chống trả ấy đã khiến kỹ năng cận chiến tay không xuất hiện trên bảng hệ thống.'],
[25.9,'restraint','Trên tàu, chúng còn phải kiêng dè.'],
[28.4,'rule','Băng hải tặc không cho phép người trên cùng một thuyền tàn sát lẫn nhau.'],
[31.54,'safe','Luật ấy từng giữ Nhật Thành khỏi một kết cục tệ hơn.'],
[34.18,'shore','Nhưng lúc này, cả bọn đã lên bờ.'],
[36.4,'canis','Nhật Thành rất rõ: cơ hội mà chúng chờ đợi đã đến.'],
[39.5,'five','Canis và bốn tên tay sai tuyệt đối không định để cậu yên ổn rời đi.'],
[42.98,'route','Cậu giữ bước chân, mắt nhanh chóng quan sát con phố phía trước.'],
[46.1,'decision','Muốn sống sót, Nhật Thành phải tự tìm đường thoát khỏi năm kẻ đang áp sát.']];
const duration=1490;
const beats=lines.map(([t,view,text],i)=>({from:Math.round(t*30),to:i===lines.length-1?duration:Math.round(lines[i+1][0]*30),view,text}));
await writeFile(root+'scene-data.json',JSON.stringify({fps:30,durationInFrames:duration,beats,cues:beats.map(({from,to,text})=>({from,to,text}))},null,2));
await writeFile(root+'work.json',JSON.stringify({scene:'S07',status:'preview-draft',nativeRenderAuthorization:false,latestStep:'Mai49.656s and local ASR word timestamps prepared;15 source-derived beats. Existing S05 hero PSD run/watch/guard extracted with verified hashes. Author preview next.',resumeCommand:'Inspect Scene7.tsx in browser editor, fix blocking defects before any native render.',source:'../EP01-SCENE-PLAN.md and ../../sources/001.txt',continuityIn:'Return from S06 reflection to S02 street pursuit. Same Canis and four henchmen; five pursuers total.',continuityOut:'Observe route without entering alley; S08 owns turn and chase dialogue.',limitations:['ASR boundary estimates, no forced-alignment certification','No native rendering authorization or QG2 evidence']},null,2));
