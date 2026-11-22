# Nguồn dữ liệu và trạng thái bản xuất

Editor cục bộ lưu bản dựng đang chỉnh trong SQLite `data/projects.sqlite`: project giữ thứ tự scene; mỗi scene có document/revision riêng. Thao tác Save/Restore dùng revision để phát hiện cửa sổ khác đã thay đổi dữ liệu. Nháp browser chỉ là bản dự phòng, không phải bản đã lưu trên máy chủ.

Export lấy project đã lưu, tạo snapshot và cố định media riêng cho job. Snapshot được hash và worker kiểm tra trước khi xuất. Từ bổ sung provenance, job/snapshot còn ghi purpose `editor-preview`, project revision, thứ tự scene và revision document từng scene. Giao diện so nguồn này với bản dựng đã lưu; chỉnh sửa mới chưa Save không thuộc nguồn xuất. Job lịch sử thiếu provenance được coi là chưa xác định, không suy ra phiên bản hiện tại.

`verification.json` của export kiểm tra kỹ thuật file (frame/kích thước/thời lượng/audio), không phê duyệt sáng tạo. Editor không nâng điểm hay đổi trạng thái duyệt của pipeline native.

Pipeline `motion_intro` giữ workflow theo episode/capsule và các render/evidence đã khóa. Cập nhật bản dựng trong editor không tự đồng bộ sang workflow native. Muốn đưa bản dựng sang đường duyệt chính thức cần bước chuyển dữ liệu có đối chiếu visual/audio/timing/assets, bảo vệ prefix đã duyệt, Preview Studio preflight và native render có ủy quyền theo quy tắc dự án. Hiện chưa có cầu nối này được nghiệm thu; không gọi MP4 editor là master đã duyệt.

Bằng chứng nguồn xuất: `evidence/stabilization/export-provenance-verification.json`. Các điều kiện production còn mở trong `STABILIZATION.md`.

Một yêu cầu xuất mới có requestId được trình duyệt giữ trước POST. Backend lưu reservation trong job.json trước khi sao chép media. Gửi lại cùng mã đọc cùng job, kể cả đã kết thúc; muốn xuất bản mới cần thao tác mới sau khi nhận receipt. Reservation preparing có owner PID/OS birth; phiên gián đoạn không tự khởi chạy lại. Cơ chế này dựa trên runtime giữ độc quyền thư mục dữ liệu và job xuất còn trên đĩa. Nháp mã yêu cầu dùng sessionStorage cùng tab; không được coi là bản sao lưu lâu dài.
