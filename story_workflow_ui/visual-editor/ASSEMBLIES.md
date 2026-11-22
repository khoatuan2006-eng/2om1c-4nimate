# Nhóm cha–con, điểm cầm theo pose và bối cảnh có chiều sâu

## Gắn đạo cụ vào nhân vật

1. Thêm nhân vật và đạo cụ từ kho. Chọn đạo cụ, chọn Đối tượng cha và Gắn vào cha · giữ vị trí.
2. Chọn nhân vật, mở Điểm cầm theo pose. Chọn Tay phải, Tay trái hoặc Thắt lưng, nhấp vào vị trí gắn trên ảnh pose và chỉnh góc cầm. Làm một lần cho mỗi pose muốn dùng.
3. Chọn đạo cụ, mở Điểm cầm theo pose, chọn cùng điểm gắn và nhấp vào chuôi đạo cụ. Chuôi được đưa về điểm gắn của cha.
4. Khi đổi qua lại các pose đã thiết kế, đạo cụ tự đổi vị trí và góc theo điểm của từng pose. Quan hệ cũng theo chuyển động, scale và lật của cha. X/Y, xoay và keyframe của con vẫn là chuyển động riêng.

Điểm theo pose là dữ liệu thiết kế có thể chỉnh lại, không suy đoán vị trí tay từ pixel. Pose chưa định vị có cảnh báo trên đạo cụ. Khi khóa thiết kế, editor chặn chuyển sang pose thiếu điểm cầm đang dùng để tránh làm trôi đạo cụ trong lúc diễn.

## Khóa thiết kế và tái sử dụng

Khóa thiết kế các đối tượng con bảo vệ vị trí, quan hệ và điểm đã dựng. Chọn gốc để mở khóa khi cần sửa. Gốc vẫn được diễn hoạt; các keyframe đã có của con vẫn chạy. Nhân bản hoặc xóa gốc áp dụng toàn bộ cây con.

Mở Bộ nhân vật & bối cảnh đã thiết kế, chọn gốc và Lưu bộ đang chọn. Mẫu lưu trong SQLite hiện có. Đặt bộ từ đây đến hết shot tạo bản riêng, đổi mã các layer và co giãn thời gian/keyframe/camera theo shot. Quan hệ, điểm từng pose, chiều sâu và khóa thiết kế được giữ. Sửa bản đã đặt không sửa ngược mẫu; lưu một mẫu mới khi muốn giữ phiên bản thiết kế khác.

Chụp/dán bố cục và tiếp nối cảnh cũng giữ quan hệ và điểm cầm. Chụp bố cục lấy trạng thái tại playhead, bao gồm vị trí camera tại thời điểm đó. Tách khỏi cha giữ chuyển động ở từng frame trong khoảng hiển thị chung, bao gồm camera; thao tác này có thể tạo nhiều keyframe.

## Bối cảnh nhiều lớp và parallax

Dùng một lớp nền làm gốc, gắn các lớp cảnh còn lại vào gốc. Đặt Z của mỗi lớp để quyết định thứ tự che nhau; Z lớn hơn nằm trước. Các lớp nền có thể mở khóa Z qua bảng Nhóm & chiều sâu. Z và độ gần parallax là hai thông số riêng.

Trong Máy quay & parallax, đặt độ gần của mỗi lớp: 0 cho chân trời, 0.25 cho xa, 0.5 cho trung cảnh, 1 cho gần và 1.5–2 cho tiền cảnh. Con mặc định kế thừa độ gần của cha khi chưa tự chọn. Chọn gốc, áp dụng Lia trái, Lia phải hoặc Tiến gần. Máy quay chạy tự động theo thời gian của bộ; lớp gần di chuyển/zoom nhiều hơn lớp xa. Có thể đổi preset hoặc tắt máy quay.

## Timeline cây nhóm

Timeline đặt con ngay dưới cha, kể cả khi cha là nhân vật còn con là đạo cụ. Mũi tên cạnh cha thu/mở cây; chọn một con từ danh sách sẽ mở lại các cha để tìm thấy track. Thu gọn chỉ đổi cách nhìn, không đổi hình ảnh hay dữ liệu. Kéo clip của cha di chuyển thời gian của cả bộ, keyframe và camera; trim của cha giới hạn khoảng hiển thị chung.

## Dữ liệu và kiểm chứng

Tất cả chạy trong Studio3022, model/keyframe/Composition và SQLite hiện có. Không chuyển cảnh authored EP01 sang scene mới và không dựng renderer khác. Preview Studio và xuất video dùng cùng composition; thay đổi này không tự cấp quyền xuất hoặc native render.

Kiểm tra trong scene-graph.test.mjs, assembly-library.test.mjs, assembly-performance.test.mjs và e2e/assembly-performance.spec.mjs. Bằng chứng hình ảnh và video chạy trình duyệt ở evidence/frontend-tests; báo cáo nghiệm thu ở evidence/frontend-tests/assembly-completion.json khi kiểm chứng cuối đã hoàn tất.
