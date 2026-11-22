import {test} from 'node:test';
import assert from 'node:assert/strict';
import {editorStatus} from './editor-status.mjs';
const base={status:'Đã lưu · bản 8',dirty:false,saving:false,projectBusy:false,ready:true,timelineMode:'scene',sceneLabel:'S06',revision:8,projectAvailable:true,projectLoading:false};
test('new edits do not keep an earlier saved or opened message as their save status',()=>{
 for(const status of ['Đã lưu · bản 8','Đã mở S06 · bản 8','Đã khôi phục chỉnh sửa chưa lưu'])assert.equal(editorStatus({...base,status,dirty:true}),'● Chưa lưu · S06 · bản máy chủ 8');
 assert.equal(editorStatus({...base,dirty:true,status:'Có nháp từ phiên bản cũ.'}),'● Chưa lưu · Có nháp từ phiên bản cũ.');
 assert.equal(editorStatus({...base,dirty:true,status:'Không thêm được tài nguyên.'}),'● Chưa lưu · Không thêm được tài nguyên.');
});
test('pending save and project operations take precedence without claiming saved',()=>{
 assert.equal(editorStatus({...base,dirty:true,saving:true}),'Đang lưu S06 vào dự án…');
 assert.equal(editorStatus({...base,dirty:true,projectBusy:true}),'Đang cập nhật dự án…');
 assert.equal(editorStatus({...base,projectAvailable:false}),'Chưa mở được dự án');
});
test('film status describes the saved preview while preserving errors and read-only information',()=>{
 assert.equal(editorStatus({...base,timelineMode:'film'}),'Toàn phim · đang xem bản đã lưu');
 for(const status of ['Scene đã duyệt · chỉ xem','Chưa tải lại được dự án.','Không lưu được nháp trên trình duyệt.','Đã khôi phục bản 9. Chưa tải lại được thông tin dự án; thử kết nối lại.'])assert.equal(editorStatus({...base,status,timelineMode:'film'}),status);
 assert.equal(editorStatus({...base,timelineMode:'film',dirty:true}),'● Chưa lưu · S06 · bản máy chủ 8');
 assert.equal(editorStatus({...base}),base.status);
});
