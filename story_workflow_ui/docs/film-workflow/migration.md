# Agentic Film Studio — migration boundary Mốc 3

- AssetHub SQLite vẫn sở hữu `assetId`, `versionId`, capability, requirement và binding.
- Film workflow SQLite chỉ tham chiếu các identity đó; không copy hoặc tự nâng version binding.
- Legacy state JSON tiếp tục phục vụ UI cũ và không được ghi chung làm authoritative run state mới.
- Feature flag hiện tại ở cấp entry point: người dùng mở `/film-studio.html`; root Canvas vẫn chạy đường legacy.
- Scene run đang chạy dùng `engine_version=film-workflow-v1`; film run M2 dùng `film-orchestrator-v1`. Không diễn giải artifact envelope bằng code khác schema/tool version nếu migration chưa có.
- `compile-preview` chỉ publish manifest hợp lệ; `scene-preview` thêm `render-scene`, dùng Remotion `TimelineIRScene` hiện hữu và publish MP4 dưới `public/renders/film-workflow/<runId>/attempt-XX/` sau gate `ffprobe`.
- Media output, input hashes và metadata là per-run/per-attempt; không dùng pointer `latest` và không ghi đè media của run khác.
- Film workflow lưu FilmPlan, FilmBible, scene inputs, dependency state, assembly lease/fencing và FilmRun events trong các bảng `film_orchestrations*`; không dual-write vào legacy `orchestrator-state.json`.
- Assembly chọn SceneOutputReference theo artifact ID/revision/content hash cụ thể, tạo EDL/FilmMedia/FilmSubtitle/FilmAssemblyManifest immutable; scene child output có thể được reuse khi `inputHash` và variant key không đổi.
- Review/revision M3 thêm các bảng `film_review_comments`, `film_revisions`, `film_revision_decisions`, `film_current_refs`; candidate run và patched package nằm trong workflow SQLite, current ref chỉ swap trong transaction sau approval hash/scope.
- Rollback an toàn: reject/cancel candidate hoặc dừng entry point mới để tiếp tục dùng current run cũ; không cần reset AssetHub và không xóa artifact immutable.

Mốc 3 có natural-language adapter boundary opt-in tại API; client vẫn phải nhận/kiểm `TypedPatch` trước khi tạo revision. Mốc 4 mới xử lý critic/repair, backup/restore và production metrics. Không dual-write `film_orchestrations` vào `orchestrator-state.json`.
