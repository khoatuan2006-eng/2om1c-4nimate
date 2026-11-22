# Kế hoạch cảnh (Scene Plan — Working Layer v2)

Một file JSON mô tả **cảnh cần kể gì**; bộ biên dịch `scene-plan.mjs` tự giải quyết tên tiếng Việt/Anh/Trung/số ô, hướng nhìn (`faceTo`/`look`), sân khấu theo địa điểm, thời lượng (`auto-tts`/`draft`), camera parallax và đẩy thẳng vào Studio 3022 qua API có Detach Guard. Ví dụ: `scene-plan.example.json`.

## Cách chạy

- **CLI soát nhanh (không ghi SQLite)**:
  ```
  node visual-editor/scene-plan-cli.mjs <plan.json> --out=<thư mục> [--fast=20,85,145] [--render=20,85,145] [--stage=<stage.json>]
  ```
  - `--fast`: Tier-1 Fast Layout Check bằng Sharp (~vài giây, có watermark `NOT FOR REVIEW`, chỉ dùng để soát bố cục/hướng nhìn).
  - `--render`: Tier-2 Remotion render chuẩn.
- **HTTP API & MCP (chế độ gọn `STUDIO_MCP_MODE=v2`)**:
  - `POST /api/scene-plans/preview` / MCP `scene_plan_preview`: biên dịch + ảnh Tier-1 Sharp, chưa ghi SQLite.
  - `POST /api/scene-plans/apply` / MCP `scene_plan_apply`: Timing Resolver (`auto-tts`/`draft`) → biên dịch → `upsertPlanScene` vào SQLite có kiểm `revision` và **Detach Guard**.

## Trường của Plan

| Trường | Ý nghĩa |
|---|---|
| `location.asset` (`item?`) | Tên hoặc id nền trong catalog; tự áp `locationStages` từ `semantic-registry.json` |
| `cast.<alias>` | `{asset, faceStyle}`; nhân vật có 2 kiểu mặt (`bean`/`detailed`) **bắt buộc** chọn `faceStyle` và giữ cả tập |
| `timing` | `{mode: "auto-tts" \| "draft", voiceId?, padFrames?: 12, fps?: 30}` — `auto-tts` đo cue thật qua `narration-cache.mjs` và tự điền `frames` |
| `bgm` | Nhạc nền / không khí tự động hạ âm lượng khi có lời kể (`auto-ducking`): `tension \| action \| trailer \| story \| ambience-water \| ambience-room \| ambience-warm` hoặc `{preset, volume?, duckVolume?, fadeIn?, fadeOut?}` |
| `captionStyle` | Kiểu phụ đề đáy: `classic \| highlight \| comic` (`highlight`/`comic` tô sáng từng từ khớp nhịp đọc TTS; từng beat có thể đặt thêm `highlightColor`) |
| `camera` | Preset anti-slideshow cấp cảnh: `off \| push-in \| pull-out \| pan-left \| pan-right \| drift \| zoom-punch \| whip-left \| whip-right` (hoặc `{type, intensity}`) |
| `transitions` | `in`/`out`: `fade-black \| fade-white \| wipe-left \| wipe-right \| flash` + `frames` |
| `beats[]` | `id`, `quote`, `highlightColor?`, `frames?` (tùy chọn khi có `timing`), `cuts[]?` (chia 1 câu TTS dài thành nhiều nhịp hình `ratio`/`shot`/`actors`/`camera` để mỗi hình ≤ 3s), `shot` (`wide\|medium\|close`), `location?` (đổi nền ngay trong cảnh — montage), `camera?`, `cameraShake?` (`true` hoặc `{at, frames, intensity}` rung suy giảm theo lực đánh), `cutTransition?` (`glitch-slam\|diagonal-wipe\|energy-burst\|shutter`), `impactFrame?` (`true\|invert\|bw\|crimson` hoặc `{at, frames, style}` chớp 2f đen–trắng/đảo màu khi va chạm mạnh), `lighting?` (`sunset\|night\|alarm\|spotlight\|point` hoặc `{type, x, y, radius, color, intensity, darkness}`), `splitPanel?` (`true` hoặc `{slant, gutter, leftTint, rightTint}` chia đôi khung chéo đối đầu kiểu manga), `sfx?` (`impact\|chime\|breath` hoặc mảng/object `{preset, at?, volume?}`), `lines?` (`focus\|speed\|speed-horiz`), `flash?` (`true\|white\|red\|gold` hoặc `{at, frames, color}`), `mood?` (`tension\|danger\|action\|flashback\|system`), `particles?` (`dust\|sparks\|embers\|wind\|debris\|smoke\|rain`), `impact?` (`true\|white\|gold\|red\|cyan` hoặc `{at, frames, x, y, color}`), `lightning?` (`true` hoặc `{x, color, frames}`), `sfxText?` (`string` hoặc `{text, style: impact\|menace\|speed\|rage\|glitch, at: left\|right\|center\|top-left\|top-right, start, frames, rotate}`), `filmBurn?` (`true\|warm\|cyan\|crimson` hoặc `{preset, opacity}`), `halftone?` (`true` hoặc `{opacity}`), `letterbox?` (`true` hoặc `{height}`), `portalGlow?` (`true` hoặc `{x, y, color, size, opacity}`), `dof?` (`true\|soft\|strong` hoặc `{blur, dim, shadow}` làm mờ nhẹ nền để tách nhân vật), `action?`, `actors[]`, `props[]`, `panel?`, `fx[]`, `shake?` |
| `actors[]` | `who`, `pose`, `face?`, `at` (`far-left…far-right`, `"keep"` để nối đúng vị trí cuối của nhịp trước, hoặc px), `depth` (`near\|mid\|far`), `flip?`, `look?` (`left\|right`), `faceTo?` (`<alias>`), `aura?` (`power\|dark\|cyan\|rage` nằm sau lưng nhân vật), `trail?` (`true\|cyan\|gold\|red\|purple\|white` hoặc `{color, copies, step}` dư ảnh tốc độ khi `dash`/`run`), `motion?` (`dash-left\|dash-right\|step-in\|recoil\|run-left\|run-right\|slide-in-left\|slide-in-right\|bob\|breathe\|float`), `enter` (`pop-in\|fade-in`), `exit` (`fade-out`), `height?` |
| `props[]` | `prop` (tên/id trong kho props), `item?`, `at?`, `y?`, `height?`, `flip?`, `enter?`, `exit?`, `z?` |
| `panel` | `{title?, text, side?: "left"\|"right"\|"center", style?: "system"\|"comic"\|"speech"}` (hoặc string) — bảng HUD hoặc khung truyện/bong bóng thoại nét vẽ tay cao hơn vùng phụ đề đáy |
| `fx[]` | `effect`, `at`, `frames`, `layer?` (`behind\|front`), `placement?` — tự cảnh báo nếu FX có `scope: "full-screen"` đè lên beat có nhân vật |

- `pose`/`face`: nhận tên gốc tiếng Trung, **tên tiếng Việt/Anh** (có/không dấu từ `asset-name-translations.txt`), hoặc **số ô trên tờ ảnh** (`studio_asset_sheet`). Tên mơ hồ hoặc không tồn tại làm biên dịch dừng, không đoán.
- **Detach Guard**: Scene tạo từ `scene-plan` có `planState.status = "plan-managed"` (cho phép re-compile đè, có lưu `edit_history`). Ngay khi Đạo diễn chỉnh tay trên Studio UI, scene chuyển sang `"detached"` và compiler bị chặn (`409 SCENE_DETACHED`) trừ khi truyền rõ `forceResync: true`.
- **Stage Persistence & Selective Focus (`persistStage`, `focus`, `solo`, `leave`, `leaveProps`)**:
  - Đặt `persistStage: true` ở cấp `plan` để **cố định mọi nhân vật và đạo cụ (`props`) trên cùng một nền (`location`)**: đối tượng đã xuất hiện ở nhịp trước sẽ tự động được giữ nguyên vị trí (`at: "keep"` mặc định) sang các cut/beat tiếp theo trên cùng bối cảnh thay vì biến mất đột ngột, và tự reset sạch khi đổi bối cảnh.
  - Dùng `focus: "who"` hoặc `focus: ["a", "b"]` trên `beat`/`cut` để giữ chủ thể chính sắc nét trong khi **tự động làm mờ và hạ sáng nhẹ (`DofStyleOverlay.dimLayerIds`) các nhân vật & đạo cụ phụ** đang đứng cùng bối cảnh.
  - Dùng `leave: ["who"]` / `leaveProps: ["propId"]` khi nhân vật/vật thể thực sự rời khỏi cảnh, và chỉ dùng `solo: true` cho các nhịp cô lập 1 nhân vật (đọc thoại nội tâm hoặc nhấn mạnh tuyệt đối).
