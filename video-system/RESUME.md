# Điểm vào hệ thống video

Khi dựng/sửa truyện trong Studio, dùng skill [studio-storytelling](../.agents/skills/studio-storytelling/SKILL.md). Skill dẫn tới quy trình và công cụ kiểm tra tình tiết; không thay nguồn trạng thái SQLite. Các bản bị người dùng bác không là mẫu đã đạt.

Từ D:/Doyin chạy `node video-system/status.mjs --project=nhat-thanh`. Đọc profile, checkpoint ngắn và liveWorkflow trả về. Nếu Studio chưa chạy, liveWorkflow phải ghi unavailable; không lấy revision trong MD hoặc chat làm trạng thái thật.

## Chọn đúng quy trình

| Phạm vi đang làm | Nguồn trạng thái thật | Điểm vào |
|---|---|---|
| Dựng/preview trong Studio3022 | visual-editor/data/projects.sqlite, đọc qua API | profile + PRODUCTION-WORKFLOW.md |
| Bảo trì simple-scene | data/series/work.sqlite | story_workflow_ui/AGENTS.md + handoff CLI |
| Native trong motion_intro | episode/capsule của pipeline native | root AGENTS.md + motion_intro/AGENT-INDEX.md |

Chỉ theo một cursor phù hợp với công việc. Không ghép revision giữa các hệ hoặc tự chuyển dự án sang pipeline khác. Quy tắc QG-2/native giữ nguyên phạm vi; không ép tiêu chuẩn render cuối lên mỗi nháp Studio. Preview3032 và helper performance cũ chỉ là thí nghiệm lịch sử.

## Mỗi nội dung có một nơi sở hữu

| Nội dung | Nơi chuẩn | Khi nào đọc |
|---|---|---|
| Phạm vi, giới hạn native, cảnh khóa | AGENTS.md áp dụng theo thư mục | luôn theo phạm vi |
| Trình tự dựng và hợp đồng đầu ra | video-system/PRODUCTION-WORKFLOW.md | khi dựng/tiếp tục chuỗi |
| Điều kiện kỹ thuật của mẫu diễn | visual-editor/performance-recipes.json + production-contract.mjs | khi chọn/kiểm tra recipe |
| Sở thích/identity/giọng và id dự án | video-system/profiles/<project>.json | đầu lượt làm việc |
| Phản hồi sáng tạo theo ngữ cảnh | creative-memory/STYLE-HANDBOOK.md + feedback.json | khi quyết định cách thể hiện |
| API và nguồn lưu của editor | visual-editor/SCRIPT-PLANS.md, SOURCE-AUTHORITY.md | khi tích hợp/thay đổi lưu trữ |
| Luồng tạo tập dành cho người dùng | story_workflow_ui/visual-editor/EPISODE-BUILDER.md | khi tạo tập hoặc tiếp tục nháp trong UI |
| Việc đang làm, vấn đề và liên kết review | checkpoint trong projects.json | đầu lượt làm việc; không phải nơi đặt rule |
| Trạng thái scene và review có còn hiện hành | SQLite API + production-audit | trước sửa/mở rộng |

Không sao chép rule vào checkpoint hoặc thêm một MD quy tắc cho mỗi lần sửa. Thay đổi quy trình ở nơi chuẩn, các chỗ còn lại chỉ dẫn link. Lịch sử dùng làm tham khảo, không được mang nhãn hiện tại.

Sau status, chạy production.auditCommand do status trả về khi cần đánh giá chuỗi. Nếu unavailable hoặc review stale, xác minh bản dựng trước; không suy ra duyệt. Giữ workflow SQLite, kho/prepare media, model/keyframe và composition đã có. Không tạo preview/kho scene/renderer song song.

STUDIO-INTEGRATION.md là bản đồ module khi cần tra cứu. RULE-AUDIT.md là báo cáo rà soát, không phải quy tắc mới.
