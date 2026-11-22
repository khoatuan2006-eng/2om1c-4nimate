# Bản đồ module Studio — tài liệu tra cứu

Luồng làm việc chuẩn ở PRODUCTION-WORKFLOW.md; cursor ở SQLite API, không nằm trong tệp này. Số liệu kiểm kê và revision tại lần rà soát cũ xem archive/rule-audit-2026-10-29/integration.md.

| Công việc | Module trong story_workflow_ui/visual-editor |
|---|---|
| Project/scene, revision, lịch sử | project-store.mjs, project-server.mjs |
| Kho gốc, PSD/extract, catalog bổ sung | library-server.mjs, supplemental-catalog.mjs, AssetBrowser.tsx |
| Chuẩn bị media theo hash | prepared-media.mjs, audio-reference.mjs |
| Layer, transform, keyframe/nội suy | Editable.tsx, model.mjs |
| Preview scene/toàn phim, composition xuất | ProjectComposition.tsx, CreatedScene.tsx |
| Plan → schema editor và kiểm tra recipe | script-plan.mjs, script-plan-server.mjs, production-contract.mjs |
| Truy vết lời kể/task và audit | ScriptTrace.tsx, production-audit.mjs |
| Audio job, xuất snapshot, backup | created-scenes-server.mjs, export-media.mjs, backup-service.mjs |

Đoạn thử EP02 đã nhập vào Studio. Id dự án/scene và lệnh audit lấy từ profile. Ảnh/audio3032 đã dùng lại được vẫn là tài nguyên có nguồn gốc; UI3032 không là công cụ dựng chính. Không làm theo các lệnh khởi động/cursor trong tài liệu thử nghiệm cũ.

Sự khác nhau giữa editor preview/export và pipeline native xem SOURCE-AUTHORITY.md. Tệp này không thêm yêu cầu duyệt hoặc kỹ thuật sáng tạo.
