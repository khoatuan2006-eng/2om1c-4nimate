# Rà soát tổ chức rule — 2026-10-29

Đây là báo cáo, không phải một bộ rule mới. Điểm vào là RESUME.md; quy trình Studio ở PRODUCTION-WORKFLOW.md. Không đổi bản dựng, layer, audio, tài nguyên hoặc quy tắc chất lượng native trong lần rà soát này.

## Phát hiện và xử lý

| Vấn đề thực tế | Cách xử lý |
|---|---|
| creative-memory/RESUME vừa ghi lịch sử, vừa tự nhận preview3020/3021 và saved-edits là hiện hành | Tách bản cũ vào archive; RESUME sáng tạo chỉ dẫn tới sở thích và router hệ thống |
| work.json trộn việc hiện tại với scope “không có tích hợp editor”, cursor EP01 cũ, preview3032 và số liệu thử nghiệm | Giữ checkpoint ngắn cho hiện tại; chuyển toàn bộ bản trước vào archive có đường dẫn rõ |
| STUDIO-INTEGRATION vừa nói đã nhập vừa nói chưa nhập, lặp hướng dẫn tiếp tục | Chuyển thành bản đồ module, bỏ cursor/số liệu động và rule dựng lặp |
| README phân tích tự nhận r3, r5, r6 đều là mới nhất | Bỏ nhãn trạng thái động; giữ hướng dẫn module, phân biệt tiền kỳ với adapter Studio |
| update-climb-work.mjs của thí nghiệm3032 vẫn ghi đè checkpoint chính | Vô hiệu hóa thao tác ghi; giữ nguyên mã cũ trong archive để tra cứu |
| status chỉ in JSON ghi trước và auditCommand sao chép id dễ lệch profile | Đọc live cursor qua Studio API; offline ghi unavailable; sinh lệnh audit từ cùng lựa chọn project/scene |
| Audit chặn cả trau chuốt tùy chọn và lỗi khi review chưa tồn tại | Tách blocking/advisory; issue cũ chưa phân loại vẫn blocking; thiếu review trả trạng thái chưa review |
| Các SQLite và cursor của Studio/simple-scene/native dễ bị coi là cùng một hệ | Router có bảng phạm vi; child AGENTS ghi rõ phần simple-scene không sở hữu visual-editor |

## Những gì hợp logic và được giữ

- Phân rã theo ý nghĩa/trước-sau, không theo số shot hoặc số chữ cố định.
- Dùng chung hạ tầng Studio và kho; recipe là kỹ thuật có điều kiện, không là khuôn hình bắt buộc.
- Quy tắc nhẹ cho bản dựng thô và quy tắc native/QG-2 nghiêm ngặt có phạm vi riêng. Không hạ hoặc áp nhầm tiêu chuẩn native.
- Rule cho agent, schema/code kiểm tra được và đánh giá trực quan là ba loại khác nhau; không gọi cả ba là tự động cưỡng chế.
- Checkpoint chỉ giữ công việc và đường dẫn; SQLite giữ bản dựng; feedback giữ phản hồi; profile giữ lựa chọn dự án. Không lấy bản ghi lịch sử làm cursor.

## Giới hạn còn lại

Recipe v1 vẫn là thư viện thử nghiệm. Một số mẫu cố ý gắn với kỹ thuật cụ thể: direction-cut v1 kiểm tra lật nền/nhân vật đồng mốc, không chứng minh mọi cách rẽ đều phải làm vậy. acceptedLimits hiện so khớp câu chữ của đúng phiên bản; không sửa câu chữ registry cũ tùy tiện. Nếu đổi hợp đồng, cần version mới; stable limitation IDs là cải tiến kỹ thuật sau này.

Việc đọc đúng ngữ cảnh, phân biệt lỗi nội dung với trau chuốt và xem hình vẫn phụ thuộc người/agent. Audit không tự chứng minh diễn xuất đạt. canExpand chưa là khóa UI. T03 của EP02 vẫn là lỗi nội dung đang mở, không được biến thành ghi chú tùy chọn để đi qua cổng.

Bản trước khi dọn: archive/rule-audit-2026-10-29/. Các tài liệu trong đó là lịch sử, không tự có hiệu lực hiện hành.
