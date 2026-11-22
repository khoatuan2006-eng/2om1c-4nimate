# Kiểm kê dọn dẹp (bước 0)

Lập 2026-11-14. Đây là danh sách ứng viên, **không** phải lệnh xóa. Mỗi mục cần bạn duyệt; nên sao lưu ra đĩa ngoài trước khi xóa mục nặng.

## Đã dọn (2026-11-14, chuyển vào Thùng rác Windows, khôi phục được)
- 47 thư mục `visual-editor/data.lease-stale-*` (còn 3 trong 50 con số ban đầu là ước lượng), `story_workflow_ui/scratch/` (30 MB), `visual-editor/data/qa-work/` (479 MB), `visual-editor/data/capture-work/` (195 MB). Tổng khoảng 704 MB. Giữ nguyên `data.lease` hiện tại và `projects.sqlite`. Dung lượng chỉ được giải phóng khi dọn Thùng rác.

## Đã xóa phim mẫu (2026-11-14, theo yêu cầu)
- Sao lưu trước: `visual-editor/data/backups/b7afa6be-ec04-43b4-b095-c0226a5ba1f1` (đã verify: 4 dự án, 20 cảnh, 531 file). Khôi phục: đóng Studio rồi `node visual-editor/backup-cli.mjs restore --id=b7afa6be-ec04-43b4-b095-c0226a5ba1f1`.
- Xóa qua API Studio: EP01 (8 cảnh), EP02 (9 cảnh), QA · Dự án độc lập (2 cảnh), Codex production flow TEST (1 cảnh).
- Chuyển vào Thùng rác: 10 job trong `visual-editor/data/exports` (~1 GB) và `D:\Doyin\exports` (~0,9 GB, MP4 review EP01/intro).
- Giữ: kho tài nguyên, catalog bổ sung (pose Nhật Thành), media đã chuẩn bị, `data/backups`. Mã cảnh EP01 trong `preproduction/` và import trong `ProjectComposition.tsx` vẫn còn (gỡ ở bước tái cấu trúc renderer).

## Đã làm
- `git init` tại `D:\Doyin`, nhánh `main`; baseline chỉ có mã và tài liệu (2.561 file, ~26 MB). Media, database, evidence, `node_modules` bị `.gitignore`.
- `keys.txt` đã nằm trong `.gitignore` (cả gốc lẫn `story_workflow_ui`), không bị track. Backend đọc nó theo thiết kế (`backend/config.mjs`, `gemini.service.mjs`), nên **chưa chuyển sang `.env`** để không làm hỏng backend; việc này cần sửa code ở bước sau.
- `services/capcut-tts-api` là repo git lồng nhau (bên thứ ba) → bỏ qua.

## Ứng viên dọn (theo mức an toàn)

| Mức | Mục | Dung lượng | Lý do / điều kiện |
|---|---|---|---|
| An toàn | `visual-editor/data.lease-stale-*` (50 thư mục) | ~0 | Khóa cũ của runtime đã chết; chỉ giữ `data.lease` hiện tại. Dừng Studio trước khi xóa. |
| An toàn | `story_workflow_ui/scratch/` | 32 MB | Thư mục nháp, có DB thử nghiệm ngày 09/2026. |
| An toàn | `visual-editor/data/qa-work/` | 481 MB | Dữ liệu chạy test QA ngày 09–10/10. |
| An toàn | `visual-editor/data/capture-work/` | 196 MB | Ảnh capture tạm; server tạo lại được. |
| Cân nhắc | `story_workflow_ui/qa-evidence/` | 257 MB | ~40 bản sao `asset-hub.db` + evidence cũ; giữ lại bản có liên kết review nếu cần. |
| Cân nhắc | `visual-editor/data/backups/` | 879 MB | Giữ 2 bản mới nhất (30/10), xóa các bản 09–10/10 (65 KB, bản test). |
| Cân nhắc | `visual-editor/data/exports/` | 1.016 MB | MP4 xuất thử; giữ bản đã duyệt. |
| Cân nhắc | `visual-editor/evidence/` | 1.003 MB | Bằng chứng ổn định hóa; nén lưu trữ thay vì xóa. |
| Cân nhắc | `motion_e2e_20260909/` | 58 MB | Bản thử cũ (PROJECT-MAP đã ghi là ứng viên dọn). |
| Cân nhắc | `.cleanup-archive/`, `.tmp/` | ~7 MB | Lịch sử dọn cũ. |
| Lưu trữ | `story_workflow_ui/simple-scene` | 518 MB | Hệ dựng song song, ngừng từ 05/10. Chuyển vào `archive/`, không xóa. |
| Lưu trữ | `story_workflow_ui/backend/film-workflow` + `film-workflow.db` | — | 16 bảng, 0 dòng dữ liệu. |
| Lưu trữ | `orchestrator_ui/` | 108 MB | Giao diện điều phối riêng, không được Studio dùng. |
| Lưu trữ | `story_workflow_ui/preproduction` | 1.080 MB | Chứa mã cảnh EP01 mà `ProjectComposition.tsx` còn import — **không đụng** cho tới khi cảnh EP01 chuyển sang dữ liệu thuần. |

## File lẻ ở gốc (nghi không còn dùng, chưa kiểm chứng bằng chạy thử)
`elder_*.png/svg/html`, `test_*.png`, `character_scene_studio.html`, `multi_agent_workflow_ui.html`, `add-s06-courtyard.mjs`, `serve_studio.mjs`.

## Script một lần trong `visual-editor` (không thấy file nào khác tham chiếu)
`build-ep02-*.mjs` (4), `integrate.mjs`, `add-graphics.mjs`, `qa-long-project.mjs`, `authoring-benchmark.mjs`, `s0x-*.json`, `Scene4Memory.tsx`, `PastLifeSequence.tsx`, `SystemAbilityPanel.tsx`.
Cần chạy `video:edit:test` và `tsc` sau khi di chuyển để xác nhận không vỡ.

## Không đụng
`visual-editor/data/projects.sqlite` (+wal/shm), `data/media`, `asset_browser/library`, `motion_intro/node_modules`, `creative-memory`.
