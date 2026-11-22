# Công cụ và hợp đồng tình tiết

Chạy từ `story_workflow_ui`. SQLite là nguồn thật; file JSON chỉ là đầu vào hoặc báo cáo dẫn xuất. `visual-editor/SCRIPT-PLANS.md` sở hữu tài liệu API/batch; không sửa SQLite trực tiếp.

```powershell
node visual-editor/story-chain-cli.mjs --mode=save --project=<id> --scene=<anchor> --chain=<id> --file=<chain.json>
node visual-editor/story-chain-cli.mjs --mode=check --project=<id> --scene=<anchor> --chain=<id> --out=<report.json>
node visual-editor/story-chain-cli.mjs --mode=review --project=<id> --scene=<anchor> --chain=<id> --file=<review.json>
```

`save` dùng revision vừa đọc, lưu qua edits/history và xóa review của kế hoạch thay đổi. `review` yêu cầu fingerprint do check trả về; không tự điền fingerprint vào một review cũ. `check` chỉ đọc. Đừng chạy `save` lại sau dựng để vô tình xóa review.

Chain: `{version:1,id,steps:[...]}`, thêm `userRejection` khi bản trước đã bị bác. Mỗi step:

- `id`, `dependsOn`: tình tiết trước trong cùng chuỗi.
- `before,actor,action,target,response,result,visibleChange`: chuỗi nguyên nhân/kết quả cụ thể.
- `taskRefs:[{sceneId,taskId}]`: task thật, đúng thứ tự.
- `resources:[{sceneId,layerId,use}]`: layer hiện có và cách sử dụng; đọc hình trước khi khai khả năng.
- `gaps:[{missing,solution,status}]`: `resolved-by-approximation` hoặc `needs-decision`. Ý quan trọng còn mất thì chưa được ghi resolved.

Review: `{fingerprint,outcome,steps,evidence,playback,issues,resolvesUserRejection?}`. `outcome` là pass hoặc needs-fix. Mỗi decision `steps:[{id,outcome,observedChange}]` ghi thay đổi thật đã thấy. Không được chỉ chép tiêu chí mong muốn.

Evidence: `{captureId,stepId,phase,sceneId,frame,path,sha256,observation}`. CaptureId phải do Studio phát hành từ composition đang dùng; runtime kiểm registry/bytes/fingerprint/media/code, không công nhận ảnh caller tự tạo. `phase` là before/action/result; ba mốc theo thời gian, thuộc task đã khai; ảnh đầu/cuối không được giống byte. Đây chỉ là cổng chống bằng chứng thiếu/trùng/stale, không là nhận dạng hình bằng máy.

Playback: `{watched:true,ranges:[{sceneId,from,to,playbackId}],observed,limitations}`. PlaybackId là bản ghi server từ Player đúng bản dựng. Range phải phủ các task được review; các range ngắn được nối nếu không có khoảng trống và từng range đều hợp lệ. Chỉ khai đoạn đã thực sự quan sát. MCP preview_play/status điều khiển Player có giới hạn nhưng kết quả played-unreviewed chỉ là timing, không thay quan sát/nghe. Nếu chưa xem đủ, không ghi watched/pass. Issue `{stepId,problem,solution,blocking}`; không phân loại mặc định là chặn.

Code chuẩn: `visual-editor/story-chain.mjs`, `story-chain-cli.mjs`. CLI lấy kết luận từ server production-workflows và đối chiếu cùng snapshot; không tự chấp nhận hash file ảnh trên máy. --mode=review lưu nhận xét rồi trả kết quả server; một claimed pass thiếu capture/playback vẫn bị chặn và không có receipt. Fingerprint bao gồm kế hoạch, source/cue/shot, layer/casting và production/storyboard của các scene liên quan. Đổi hình/thoại/plan khiến review stale. Metadata review không tự làm stale chính nó. Import scene mới kiểm tra chain đã đăng ký, không cấm agent sửa nháp của chain bị lỗi.

Ca có thật để xem cách nối nguồn (chưa đạt): `script-analysis/EP02/production/ambush-chain.json`. Không sao chép nội dung Nhật Thành vào dự án khác.
