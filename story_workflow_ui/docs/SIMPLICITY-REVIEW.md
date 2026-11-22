# Kiểm tra mức độ đơn giản

Ngày kiểm tra: 2026-10-01

## Kết luận

**Chưa đơn giản với người làm phim.** Ranh giới backend đã gọn hơn: preview và native render dùng cùng `TimelineManifest` qua `timeline-boundary.mjs`. Bài kiểm tra workflow nền pass 6/6 và diagnostic compile pass 17/17. Nhưng các kết quả đó đo tính đúng của pipeline, không đo số thao tác hay độ dễ hiểu của giao diện.

## Bằng chứng

- Canvas workflow vẫn chia công việc thành các node riêng: scene, asset hub, audio sync, camera director, actor motion và Remotion render; nhãn production lane ghi các bước 04–09.
- Frontend canvas gọi `/api/tasks/...`; Film Studio gọi `/api/film-workflow/film-runs`. Đây là hai luồng thực thi công khai cùng tồn tại.
- Film Studio có ô nhập truyện, nhưng nút Start hiện gọi `loadFixture()` và gửi `filmFixture`; ô `storyText` chưa được đưa vào request tạo film run. Vì vậy người dùng chưa thể nhập truyện mới rồi tạo preview qua luồng này.
- Timeline boundary chỉ thống nhất props tới Remotion. Nó chưa giúp người dùng sửa shot, blocking, pose, đạo cụ hay thời lượng trên một timeline duy nhất.

## Đánh giá theo thao tác

| Việc người làm phim muốn làm | Kết quả hiện tại |
|---|---|
| Nhập truyện mới và nhận preview | Chưa nối ô truyện vào FilmPlan; Film Studio chạy fixture |
| Sửa một hành động/pose rồi xem lại | Phải tìm node tương ứng và hiểu trạng thái manifest |
| Giữ preview và render giống nhau | Đạt ở backend: dùng cùng `TimelineManifest` |
| Biết lỗi cần sửa ở đâu | Chưa gọn: có node statuses, task API cũ và film workflow mới |

## Việc cần làm tiếp theo

1. Chọn một đường dùng chính; giữ Film Studio làm luồng chuẩn, chuyển canvas cũ sang tương thích rồi mới gỡ.
2. Nối ô truyện vào FilmPlan/scene inputs thật, thay fixture demo.
3. Đặt chỉnh sửa shot cơ bản cạnh preview: nhân vật, pose/mặt, blocking, đạo cụ, thời lượng.
4. Chỉ hiện một trạng thái “Preview”, “Cần sửa” hoặc “Sẵn sàng xuất”; giữ trace kỹ thuật ở phần chi tiết.

Cho đến khi bốn bước này xong, không nên gọi trải nghiệm sản xuất là đơn giản. Chưa có native render hay QG-2 trong lần đánh giá này.
