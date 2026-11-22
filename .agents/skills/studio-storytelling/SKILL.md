---
name: studio-storytelling
description: Dựng hoặc sửa truyện có lời kể trong Studio3022 bằng luồng Working Layer v2 (Declarative Scene Plan + Semantic Catalog + Tier-1 Fast Preview + Detach Guard). Dùng khi tạo shot/scene từ truyện hoặc sửa video không bám lời kể; không thay pipeline native/QG-2.
---

# Studio Storytelling (Working Layer v2)

Sản phẩm là chuỗi tình tiết người xem hiểu được bằng hình. Ưu tiên năng suất, đúng ý thoại, rõ nguyên nhân–hành động–kết quả; cắt đổi pose thô được phép, nhưng thiếu sự kiện chính hoặc sai hướng nhìn/vị trí là chưa đạt.

## 1. Luồng chuẩn duy nhất (1 đường đi)

Khi chạy MCP ở chế độ gọn (`STUDIO_MCP_MODE=v2`), dùng đúng vòng lặp sau:

1. **Đọc trạng thái thật**: Gọi `studio_state` (hoặc từ workspace chạy `node video-system/status.mjs --project=<profile>`). Xem `revision`, `lockedPrefix` và `planState` (`plan-managed` / `detached`). Đọc `creative-memory/STYLE-HANDBOOK.md` và `creative-memory/feedback.json` để nắm sở thích hình ảnh theo ngữ cảnh. Không lấy lịch sử chat hoặc MD cũ làm trạng thái thật.
2. **Tìm & xem tài nguyên**: Gọi `studio_catalog_search` (tiếng Việt/Anh/Trung) và `studio_asset_sheet` (tờ ảnh đánh số ô, khóa 1 `faceStyle`: `bean` hoặc `detailed` cho cả tập). Nếu kho sẵn có thiếu, gọi `psd_archive_search` tìm trên toàn bộ kho 7,697+ PSD gốc → xem trước bằng `psd_archive_thumb` → trích theo nhu cầu bằng `psd_archive_extract` (không giải nén hàng loạt).
3. **Viết `scene-plan.json` & Soát nhanh Tier-1**:
   - Dùng tên pose/face bằng tiếng Việt/Anh/Trung hoặc số ô; dùng `faceTo: "<alias>"` / `look: "left"|"right"` để tự tính `flip`; dùng `camera: "drift"|"push-in"|"zoom-punch"|"whip-left"|...` kết hợp **`angle`** (`"standard"|"ots"|"reverse"|"hero-low"|"dutch-left"|"dutch-right"`) để đảo góc máy qua vai / góc ngược kịch tính khi đối thoại, **`speaker` / `actor.speaking`** (`true|"calm"|"excited"`) để nhân vật tự nhún theo nhịp thoại (`talk` / `talk-excited`), **`actor.emote`** (`"shock"|"question"|"anger"|"sweat"|"spark"|"silence"`), và **`speech: { who, text, fromQuote, prop, variant: "normal"|"shout"|"thought", maxChars }`** để gắn bong bóng thoại chỉ thẳng vào miệng người nói (dùng `fromQuote: true` ở cấp beat để giữ nguyên 100% lời thoại khi cắt qua nhiều góc máy `cuts[]`, và `speech.prop` cho diễn giả là đạo cụ ngoài `cast`). Kết hợp nhịp cắt `cutTransition`, `impactFrame`, `actor.trail`, `lighting`, `particles`, `splitPanel`, `dof`, `halftone`, `filmBurn`, `letterbox`, `panel.style` (`system|comic|speech`), `captionStyle` và `bgm` + `sfx`.
   - Gọi `scene_plan_preview` (Tier-1 Sharp composite ~vài giây, không ghi DB) để kiểm tra bằng mắt: hướng nhìn, chân đứng trên mặt đất, không đè chữ/nhân vật, chú ý cảnh báo FX `full-screen`.
4. **Đẩy vào Studio (Timing + Detach Guard)**:
   - Gọi `scene_plan_apply` với `timing: { mode: "auto-tts" }` (sản xuất thật, tự đo cue TTS + 12f padding) hoặc `timing: { mode: "draft" }` (nháp không tiếng).
   - Nếu scene đã bị Đạo diễn chỉnh tay trên UI (`409 SCENE_DETACHED`), **dừng lại báo Đạo diễn**; tuyệt đối không tự ý truyền `forceResync: true` khi chưa được yêu cầu.
5. **Xác minh Tier-2 trên Studio 3022**:
   - Tier-1 (`scene_plan_preview`) **chỉ là bản nháp soát bố cục**, không phải bằng chứng duyệt.
   - Sau khi apply, dùng `studio_preview_capture` + `studio_capture_image` (Remotion thật) để kiểm tra pixel cuối và báo Đạo diễn mở Studio 3022 xem playback có tiếng.

## 2. Quy tắc kể chuyện cốt lõi

- **Không đứng im quá 3 giây (90f @ 30fps) & không đứng "chết chân"**: Với mọi câu TTS dài > 3 giây, **bắt buộc dùng `beat.cuts[]`** chia thành 2–3 góc máy/pose liên tiếp (mỗi nhịp hình 1.5–2.5s); kết hợp **`actor.motion`** (`slide-in-*`, `step-in`, `dash-*`, `recoil`, `run-*`, `bob`) để nhân vật có sức sống và chuyển động theo hành động.
- **Đúng hướng nhìn, liên tục không gian, tự động chân dung cận cảnh (`full|bust|portrait`) & đặt chân chuẩn**: Người bên phải đối đầu không được quay ra ngoài; bật `persistStage: true` + `focus` để giữ cố định nhân vật/đạo cụ trong cùng 1 bối cảnh và làm mờ đối tượng phụ (chỉ dùng `leave` khi rời khỏi khung hoặc `solo: true` cho độc thoại nội tâm). **Ưu tiên chân dung (`portrait`) cho các nhịp thoại/phản ứng/nội tâm**: mọi `shot: 'close'` (không chạy/lao) sẽ **tự động cắt chân dung đầu–vai** để rõ biểu cảm và tránh lỗi chân, còn `shot: 'wide'`/`'medium'` (hoặc `framing: 'full'`) giữ toàn thân cho các cảnh cần thấy không gian/di chuyển; nền biển/bàn họp tự dùng `bust`. Trình biên dịch `scene-plan.mjs` tự áp dụng `locationStages` (`walkableX`, `forbiddenZones`, `defaultFraming`), `characterMeta` (`heightScale`), chống chồng ngang (`anti-overlap`) và đẩy đạo cụ trùng X ra sau nhân vật; nếu dùng **bối cảnh mới chưa có trong `semantic-registry.json`**, xem ảnh preview và bổ sung `locationStages`/`characterMeta` ngay. Không phủ FX nổ toàn màn hình lên beat đang cần thấy biểu cảm.
- **Chuyển thể hành động theo kho pose thật**: Khi kho không có đúng pose cho một động tác chi tiết trong truyện gốc, **viết lại lời kể và sửa động tác cho khớp với pose kho diễn được rõ ràng**, nhưng **giữ nguyên 100% cốt truyện, tình tiết chính và chuỗi nguyên nhân–kết quả** (không lược sự kiện, cũng không cố ép pose sai hoặc gen ảnh hàng loạt).
- **Bám lời kể**: Mỗi beat phải trả lời được *ai làm gì → tác động tới ai → phản ứng ra sao* ngay cả khi tắt tiếng. Không thay hành động bằng bảng chữ dài.
- **Đạo diễn theo cung cảm xúc, căn `cuts[].ratio` theo mệnh đề & bong bóng sạch**: Tránh cut kéo dài > 7 giây, xen reaction shot vào thoại dài và chuyển ánh sáng (`sunset`/`night`) theo mạch tâm lý; với sự kiện thị giác ở nửa sau beat (khói biến mất, triệu hồi, prop `enter: "drop-in"`), tính `cuts[].ratio` khớp vị trí mệnh đề trong lời đọc để hình bung đúng câu nói. Bong bóng `style: "speech"` không chứa nhãn tên bên trong, đuôi thoại thoáng mặt, không ngắt dòng rơi vào từ nối tiếng Việt và tự đặt tránh người nghe khi thoại off-screen.
- **Nhân vật/face thiếu chuẩn PSD mô-đun (khi được phép tạo ảnh)**: Chỉ tạo khi người dùng cho phép; tạo pose **mặt trống** tham chiếu nét vẽ/tỷ lệ PSD sẵn có rồi ghép chung bộ face PSD thật từ kho thay vì gen ảnh AI có sẵn mặt; khi nhân vật sẵn có cần biểu cảm biến trạng thái đặc biệt, ưu tiên bổ sung face trực tiếp vào manifest nhân vật đó để giữ liền mạch trang phục. Mẫu tham khảo theo ngữ cảnh: `creative-memory/STYLE-HANDBOOK.md`.
- **Quyền xuất tách riêng**: Hoàn thành dựng/preview trong Studio **không** cấp quyền xuất video; chỉ gọi `studio_export_request` khi Đạo diễn yêu cầu rõ.

## 3. Đường cũ (Legacy / Deprecated)

Các đường cũ như `script-plan` (`/api/script-plans/import`), `stage-authoring` và gửi `authoring-batch` thủ công từng tọa độ được giữ lại chỉ để tương thích ngược; **không dùng cho cảnh mới** — mọi cảnh mới đi qua `scene-plan` (`scene_plan_preview` → `scene_plan_apply`). Chi tiết schema: `story_workflow_ui/visual-editor/SCENE-PLAN.md`.
