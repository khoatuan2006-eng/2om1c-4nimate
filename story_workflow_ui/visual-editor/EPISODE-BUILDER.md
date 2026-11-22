# Xây dựng tập phim trong Studio

Mở dự án → tạo dự án mới sẽ mở hướng dẫn. Dự án có sẵn dùng **Xây dựng tập** trên thanh công cụ. Dự án trống cũng có nút **Bắt đầu xây dựng tập phim**. **Thêm cảnh** vẫn mở công cụ tạo đoạn trực tiếp.

1. **Kịch bản**: dán lời kể / thoại, chọn dựng trước chưa có giọng hoặc dựng với giọng đọc. Chia bằng đoạn trống, từng dòng hoặc tự thêm cảnh. Phân đoạn giữ nguyên nội dung; không suy diễn đạo diễn tự động.
2. **Chia cảnh**: sửa tên và nội dung, thêm, xóa, tách, gộp, sắp xếp. Có trường ý đồ trước–hành động–kết quả và ghi chú. Bản dựng đã có được bảo vệ; chọn **Làm lại cảnh để sửa nội dung** nếu cần thay lời. Thao tác có xác nhận, giữ bản cũ cùng lịch sử chỉnh sửa trong SQLite, tạo mã công việc mới để không nhầm audio cũ. Scene đã duyệt và EP01 gốc không được làm lại từ luồng này.
3. **Nhân vật & bối cảnh**: chọn ảnh nền trong catalog, nhân vật/pose/khuôn mặt, bộ thiết kế đã lưu, camera và thời lượng dự kiến khi dựng chưa có giọng. Có thể áp dụng lựa chọn cho các cảnh chưa dựng. Bộ tái dùng giữ liên kết cha–con/socket, lock, Z/depth và keyframe; không tự đoán điểm cầm hoặc tự ghép mọi lớp nền trong kho.
4. **Dựng cảnh**: với giọng đọc, gửi/tiếp tục công việc audio hiện có và nghe từng dòng. Tạo cảnh khi audio khớp nội dung và hoàn tất. Khi lời/giọng đổi sau khi đã gửi audio, tạo công việc mới. Với bản chưa có giọng, dùng thời lượng tự chọn và chia phụ đề đều để dựng nháp. Tạo cảnh là bố cục ban đầu, không phải tự diễn đầy đủ nội dung. Xem ngay bằng composition hiện có, rồi **Mở cảnh để dựng tiếp** để thay pose, kéo chuyển động và thiết kế lớp.
5. **Xem toàn tập**: xem cảnh ngay trong hướng dẫn hoặc phát timeline toàn tập. Ba mục tự kiểm tra ghi nhận đúng document revision; sau sửa hình phải xem lại. Đây không phải phê duyệt QG-2 hay điểm nghệ thuật. Xuất video vẫn là thao tác riêng do người dùng chủ động chọn.

## Lưu và tiếp tục

**Lưu nháp tập**, chuyển bước hoặc đóng hướng dẫn đều lưu nháp lên SQLite qua API. Trình duyệt giữ nháp chưa gửi để khôi phục sau tải lại. Xung đột giữa cửa sổ không ghi đè máy chủ; hiển thị lỗi, giữ nội dung trên trình duyệt và cho tải bản mới. Nháp khác revision được lưu riêng dưới khóa archive trước khi chuyển sang máy chủ. Audio đã gửi tiếp tục theo AudioJobs khi đóng hướng dẫn; quay lại đúng cảnh để xem tiến độ. Không tự gửi hàng loạt yêu cầu giọng đọc.

Nguồn chuẩn: `meta` trong `visual-editor/data/projects.sqlite` cho nháp/ghi nhận kiểm tra; `projects/scenes/edit_history` hiện có cho phim và timeline. API `/api/episode-workflows/:projectId` GET/PUT và `/rows/:rowId/{build,review,reset}` POST. Ghi có Origin và revision; build idempotent, kiểm tra lại revision sau chuẩn bị media. Catalog/prepare, assembly library, AudioJobs, authoring operations và Remotion composition được dùng lại; không có renderer/kho riêng. Dựng thử và kiểm thử dùng SQLite tạm; EP02 thật giữ rỗng cho tới khi người dùng bắt đầu dựng.
