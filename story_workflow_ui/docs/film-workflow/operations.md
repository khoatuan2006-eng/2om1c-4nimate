# Agentic Film Studio — vận hành Mốc 3

## Chạy local

Từ `D:\Doyin\story_workflow_ui`:

```powershell
npm.cmd start
```

Mở `http://127.0.0.1:3010/film-studio.html`. Màn hình Film Workspace tự nạp fixture 3 scene; bấm `Bắt đầu film draft` để điều phối scene child runs, render native Remotion và assembly MP4 thật có audio/SRT.

Workflow metadata mặc định nằm ở `backend/data/film-workflow.db`. Artifact JSON bất biến nằm ở `backend/data/film-workflow-artifacts/`. Có thể cô lập storage bằng:

```powershell
$env:FILM_WORKFLOW_DB_PATH = 'D:\temp\film-workflow\workflow.db'
$env:FILM_WORKFLOW_ARTIFACT_ROOT = 'D:\temp\film-workflow\artifacts'
npm.cmd start
```

Media của mỗi scene và mỗi film assembly nằm riêng dưới `public/renders/film-workflow/<runId>/attempt-XX/`; không dùng pointer `latest` và không ghi đè output của run khác.

## Film run và artifact

`POST /api/film-workflow/film-runs` nhận FilmBrief, FilmPlan, FilmBible, scene inputs và policy. Operation key bao gồm film revision, input hashes, policy và variant ID nên request lặp trả lại cùng film run.

Các route chính:

- `GET /api/film-workflow/film-fixture` — fixture isolated 3 scene.
- `GET /api/film-workflow/film-runs` — danh sách film run.
- `GET /api/film-workflow/film-runs/:filmRunId` — FilmRunState và film event stream.
- `GET /api/film-workflow/film-runs/:filmRunId/preview` — FilmAssemblyManifest, media và subtitle ref sau assembly.
- `GET /api/film-workflow/film-runs/:filmRunId/scenes/:sceneId` — scene state và child run diagnostic.
- `POST .../:filmRunId/continue`, `/retry`, `/cancel` — điều khiển film run.

Assembly chỉ nhận `SceneOutputReference` có artifact ID/revision/content hash cụ thể. EDL giữ scene order, source in/out và film-global frame/time range. `FilmMedia`, `FilmSubtitle` và `FilmAssemblyManifest` được publish sau read-set/fencing gate; staging không được xem là draft đã hoàn tất.

## Trạng thái và phục hồi

Film state gồm `queued`, `running`, `partial`, `blocked`, `failed`, `succeeded`, `cancelled`, `interrupted`. Scene state được theo dõi riêng (`pending`, `running`, `succeeded`, `reused`, `blocked`, `failed`, `cancelled`). Scene độc lập có thể hoàn tất và giữ output khi scene khác blocked; assembly không chạy khi thiếu scene bắt buộc.

Khi process khởi động, lease assembly hết hạn được chuyển sang `retry_wait`, film run active được reconcile và scene child state được đọc lại từ workflow source of truth. Continue tiếp tục child run bị gián đoạn. Assembly worker dùng fencing token; worker mất lease hoặc run bị cancel không được publish media/manifest.

`Retry` chỉ tác động tới child scene/assembly ở trạng thái retry hợp lệ. Lỗi contract/asset-gap (`blocked`) cần sửa input/binding hoặc tạo variant mới; không retry vô hạn. `Cancel` chuyển scene chưa hoàn tất và assembly sang cancelled, đồng thời giữ các artifact immutable đã tồn tại.

## Kiểm tra nhanh

```powershell
node --test --test-concurrency=1 backend/tests/film-workflow.test.mjs backend/tests/film-workflow-m2.test.mjs backend/tests/film-workflow-m3.test.mjs
```

Đây là API/contract/recovery evidence. Chưa được dùng để kết luận chất lượng diễn xuất hoặc QG2. `compile-preview` chỉ trả manifest hợp lệ; `scene-preview` chỉ thành công khi MP4 scene đã qua native Remotion + `ffprobe`; film preview chỉ thành công sau assembly đủ scene, profile/duration/audio gate và subtitle sidecar.

## Reconcile thủ công

Không xóa database hoặc asset library để “làm sạch”. Artifact file có tên theo SHA-256; nếu cần kiểm tra orphan file, đối chiếu tên file với `film_artifacts.file_path` trước khi quarantine. Không sửa trực tiếp artifact ref để đổi version; tạo run/manifest revision mới.

TTS live-provider E2E chưa được bật vì cần explicit provider authority/budget. Production TTS binding là ByteDance / CapCut qua `capcut-tts-api`; Edge và Google không phải fallback. Fixture và injected-boundary tests dùng MP3 thật chỉ để kiểm adapter/staging/probe; không claim đó là live TTS. Khi có voice identity đã pin, `change-dialogue` không có `audioPath` sẽ tạo `ttsRequest`; audio được tạo vào staging, đo duration bằng `ffprobe`, hash/publish immutable rồi mới khóa timing. Subtitle là SRT cue-level lấy từ dialogue timing đã compile, chưa phải word-level alignment và chưa burn-in vào hình.

## Review và revision scoped

ReviewComment phải chứa `filmId`, `filmRunId`, `filmRevision`, `scope.sceneId` và ít nhất một trong `shotId`, `cueId`, `characterId`, hoặc timecode. Timecode lưu nguyên timebase/giá trị; server không tự remap comment cũ sang shot/cue mới.

Tạo revision bằng `POST /api/film-workflow/film-runs/:filmRunId/revision-requests` với một `TypedPatch`:

```json
{
  "commentIds": ["comment_01"],
  "patch": {
    "patchId": "patch_01",
    "targetType": "shot",
    "targetId": "SC-FIX-02-S01",
    "expectedRevision": 1,
    "inputRefs": [],
    "operations": [{
      "type": "change-face",
      "target": {"sceneId": "SC-FIX-02", "shotId": "SC-FIX-02-S01", "characterId": "char-tam"},
      "value": {"faceId": "1/0"}
    }]
  }
}
```

Các operation được phép: `change-face`, `change-pose`, `change-dialogue`, `change-dialogue-speed`, `change-silent-duration`, `change-prop-continuity`. `change-dialogue-speed` chỉ áp dụng cho dialogue cue, nhận multiplier workflow `0.5–2.0x` nhưng phải kiểm tra capability thực của voice đã pin; với ByteDance hiện `supportsSpeed=false`, `speedRange=null` vì chỉ thấy SDK parameter `rate`, chưa có provider-valid range/output evidence. Nó không thay đổi pause/silent-shot duration. Nếu provider/voice không hỗ trợ hoặc chưa xác minh, trả `unsupported`/`TTS_SPEED_UNSUPPORTED`, không fallback và không silent stretch. Planner kiểm capability vật lý và giữ nguyên binding `assetId/versionId`. Revision plan ghi `recompute`, `reuse`, `continuity-check`, `blocked`; hash input của scene không đổi được reuse dù global film revision tăng. Renderer hiện có granularity scene, nên face/pose hiển thị là scene-level.

Routes chính:

- `POST /api/film-workflow/film-runs/:filmRunId/review-comments`, `GET .../review-comments` — ghi/đọc comment có scope.
- `GET /api/film-workflow/film-runs/:filmRunId/revisions` — lịch sử revision của film.
- `POST /api/film-workflow/film-runs/:filmRunId/revision-requests` — tạo RevisionPlan idempotent.
- `GET /api/film-workflow/revisions/:revisionId` — plan, patched package, candidate run, decisions và current ref.
- `POST .../revisions/:revisionId/execute` hoặc `/cancel` — chạy/hủy candidate; current không đổi.
- `POST .../revisions/:revisionId/approve` hoặc `/reject` — approval decision. Approve bắt buộc khớp base film run/revision và assembly ArtifactRef content hash; stale trả conflict, reject giữ current.

Restart chỉ đọc lại revision đang `running` và candidate film run từ SQLite. Worker đến muộn sau cancel bị bỏ qua ở revision state; artifact có thể tồn tại immutable nhưng không thể tự trở thành current. Natural-language adapter có boundary riêng tại `POST /api/film-workflow/revision-adapter`: nó chỉ gọi `callGeminiWorker` hiện hữu, bắt output thành `TypedPatch` rồi validate; thiếu provider/key hoặc instruction mơ hồ thì fail rõ ràng. Film Workspace acceptance vẫn gửi typed operation trực tiếp, không hardcode câu mẫu.

## Ranh giới Mốc 3

Mốc 3 đã đóng film orchestration, continuity technical gate, assembly/mix tối thiểu, subtitle, whole-film preview, restart/reuse, failure isolation, scoped review/revision và approval-by-hash. Mốc 4 critic/repair, backup/restore và production metrics chưa triển khai và không được suy diễn từ các acceptance này.
