# Luồng làm phim gọn

## Một timeline, ba bước

```text
Kịch bản + asset đã pin
          ↓
TimelineManifest (một nguồn quyết định hình, tiếng và thời gian)
          ↓
Preview → sửa timeline → duyệt → Render
```

Remotion là bộ phát và xuất video. Nó chỉ nhận `TimelineManifest` qua `backend/film-workflow/timeline-boundary.mjs`; preview và native render phải dùng cùng `timelineProps(manifest)`. Không tạo props scene riêng cho preview hoặc render.

## Ai chịu trách nhiệm cho việc gì

- Agent đề xuất nội dung scene, shot, pose, biểu cảm, vị trí, hành động và đạo cụ.
- Compiler resolve asset, timing và camera thành `TimelineManifest`; asset phải ghim theo ID/version.
- Người dùng chỉnh nội dung trên timeline/scene intent. Mỗi thay đổi tạo manifest mới có revision và bằng chứng preview.
- Remotion đọc manifest và hiển thị; không tự suy diễn cốt truyện hay tự chọn asset.

Các bước nội bộ như lập plan, staging, đo audio và kiểm tra compile vẫn giữ trace để tìm lỗi. Chúng không phải các dạng timeline mà tác giả phải sửa riêng.

## Cổng chất lượng đơn giản

1. **Có thể xem:** asset tồn tại, actor/prop có chỗ đứng, mọi shot có thời lượng.
2. **Đúng ý:** pose, mặt, hướng nhìn và hành động khớp với nội dung; kiểm tra bằng Preview Studio.
3. **Có thể xuất:** audio đã đo, manifest hợp lệ, video render qua kiểm tra media.

Compile pass chỉ cho biết dữ liệu đi đến renderer. Nó không thay việc xem video. Chưa có preview hoặc render thì ghi trạng thái chưa kiểm chứng, không chấm chất lượng hình.

## Giữ hệ thống dễ sửa

- Chỉ duy trì một scene manifest chuẩn; adapter cũ chuyển dần vào ranh giới chung, không thêm pipeline song song.
- Khi một hành động chưa được hỗ trợ, báo rõ để người viết chọn cách khác; không âm thầm bỏ motion, đạo cụ hay âm thanh.
- Giữ các kiểm tra cứng cho asset/version, continuity, timing và output. Không cần agent riêng cho từng bước dựng.
- Thêm khả năng diễn xuất từng phần: trước hết keyframe vị trí/scale/rotation và đổi pose; sau đó mới rig khớp, chu kỳ bước và lip-sync khi asset cho phép.
