# Rà soát nghiệm thu nền tảng

Cập nhật: 2026-10-10. Mục tiêu giữ nguyên: ổn định toàn quy trình làm phim, nền tảng dễ mở rộng và UX thân thiện. Đây là đối chiếu bằng chứng, chưa phải tuyên bố hoàn tất. Nhật ký lịch sử trong STABILIZATION không thay trạng thái tổng hợp này.

## Đối chiếu tám cổng

| Cổng | Bằng chứng đã kiểm chứng | Phần cần chốt tiếp |
| --- | --- | --- |
| Runtime | HTTP/static/readiness/loopback/Host/Range/path isolation có integration tests. Launcher thật kiểm chứng build, reuse đúng identity, từ chối khác root/version, IPC stop/restart giữ dữ liệu và giải phóng lease. Audio/export có shutdown tests riêng. | Đã bổ sung runtime-loaded-shutdown-verification.json: audio và stubborn export cùng chạy qua HTTP, close chờ worker/descendant thoát, trạng thái bền vững và lease/HTTP đóng, reopen không tự chạy lại. Provider/worker mô phỏng; không coi đây là render thật hoặc standalone-process restart. Hai phạm vi sau có evidence riêng. |
| Dữ liệu | Migration/schema/revision/history/transaction/SQLite faults; backup online/hash/media; GUI offline restore r6, rollback r7, reload và integrity. Crash server, nháp hai cửa sổ và save receipt có tests/UI evidence. | fresh-session-verification.json bổ sung close/reopen tab: lỗi SQLite chỉ đọc giữ X333; tab mới X0/r0, picker phiên khác X333, chọn rõ ràng lưu r1/reload333. Document chỉ đổi XY/revision, project timestamp theo save và6media byte giữ nguyên. Lost-session unit fixture giữ mirror. Đây không phải browser-process crash hay mất điện. |
| Công việc nền | Audio/export durable states, cancel/retry, PID/OS birth, request idempotency, snapshot/media hash, giới hạn một render và guardian có tests. UI mất/chậm receipt và busy/error recovery đã thử. | Ghi rõ kết quả provider không xác định: không tự retry; người dùng kiểm tra trước khi yêu cầu lại. Không hứa dịch vụ ngoài máy chỉ tính phí một lần. |
| Luồng phim | Luồng browser liên tục đã hoàn thành: sub → audio/lỗi dòng2/retry → nền → Canis/props → kéo vị trí/trim/XY → autosave/reload → MP4 1080p. final-flow-verification.json đối chiếu snapshot, sáu media và 169frame; browser playback kết thúc ở1x. TTS thật và audit waveform riêng có bằng chứng trước đó. | Audio của lần cuối dùng byte thật đã cache; lỗi provider mô phỏng. Các thay đổi sau đó chỉ sửa UI/keyboard và công cụ kiểm thử, không cần lặp render chỉ vì đổi câu chữ. |
| UX/UI | Save/offline/conflict/loading/quota/focus/dialog và responsive có UI evidence. CTA contrast sửa3,964→5,394; kho không chồng timeline. Canis146face/104pose tabstop giảm1+1; mũi tên/Enter/Space thêm đúng PNG và focus đến layer mới. | Transport có tên lùi/tiến frame và Space đúng; inspector diamonds có tên thuộc tính/pressed state. Visual audit phát hiện selection Z100000 đè dialog Z20000, đã sửa stage isolation và xác nhận ảnh. Chưa chạy screenreader/forced-colors thực tế; chọn ảnh gồm alpha vẫn là giới hạn tương tác. |
| Quy mô | Dự án3scene/126cue/36layer/354,9s xuất1080p thật;126cue audit,1x playback, telemetry395mẫu và boards có bằng chứng. | long-preview-verification.json đã bổ sung13mốc tua đúng frame/scene/layer, ảnh đều tải; phát qua hai biên scene và đạo cụ. Phát hiện clock reset do inputProps mới mỗi frame; memo hóa khôi phục timeline29,84–30,12fps từ14–16. Scene mode29,15fps trong một đoạn5s. Đây là tiến độ clock theo DOM, chưa phải phép đo compositor FPS hoặc input-to-paint; không suy rộng sang mọi dự án. |
| Đường xuất | Purpose editor-preview, provenance current/older/unknown, frozen snapshot/media, source-preservation và baseline8; editor không tự duyệt native. SOURCE-AUTHORITY mô tả trách nhiệm rõ. | Cầu nối editor→native chưa thực hiện. Đây là phạm vi riêng nếu cần master native; bản thân cổng này yêu cầu ranh giới và bảo vệ nguồn, không bắt buộc xây cầu nối. Không render native khi chưa được ủy quyền. |
| Vận hành/mở rộng | README có start/recovery; ARCHITECTURE có ownership/contracts; một lệnh tự cô lập chạy150tests, TypeScript và build/launcher đạt. Lỗi spawn/log/exit/child chết đột ngột nay ghi phase fail; log1MB được kiểm chứng đủ dữ liệu. | Force-kill tiến trình kiểm thử cha hoặc mất điện có thể để report running. Không dùng report ấy làm pass; xem PID/log/receipt. Chưa có fault-injection cho mọi giai đoạn orchestration. |

## Bằng chứng hiện hành

- operating-verification.json:150/150, TypeScript và actual build/launcher sau labels/lost-session test. CSS-only stage isolation sau đó được actual build/launcher và UI visual kiểm chứng riêng trong fresh-session-css-launcher.json; không gọi đây là lượt150tests sau CSS.
- runtime-loaded-shutdown-verification.json: HTTP runtime với audio/export đồng thời, hủy worker/descendant, trạng thái/lease sau close và reopen; hash test và log run149.
- long-preview-before.json và long-preview-verification.json: mẫu frame trước/sau,13seek frame/scene/layer, QAproject giữ nguyên, fingerprint runtime mới và giới hạn phương pháp.
- final-flow-verification.json và final-flow-browser.json: luồng liên tục, snapshot/media/MP4/playback.
- recovery-ui-verification.json: GUI restore/rollback và keyboard/narrow view.
- fresh-session-verification.json: fresh-tab recovery, exact data/media, labels/Space/modal stacking và deployment fingerprint.
- accessibility-surfaces.json, accessibility-deployment.json, library-keyboard-verification.json: UI/focus/contrast/keyboard cụ thể.
- long-1080p-audio-verification.json và long-1080p-process-samples.json: media dài và tài nguyên process.
- deploy-dynamic-modal-backup.json: database logic,216media/job files và backup không đổi ở lần triển khai gần nhất.

Bốn fault tests mới nằm trong verification-phase.test.mjs. Lần đầu có một assertion sai do Windows trả mã spawn âm thay vì null; assertion đã sửa để kiểm tra fail/ENOENT và không nhận code0. Không coi lần thất bại đầu là lỗi sản phẩm.

## Việc tiếp theo

1. Scrub/seek và mẫu playback preview dài đã kiểm chứng; lỗi clock reset đã sửa/triển khai3022. Giữ giới hạn phép đo ngắn bằng DOM. Shutdown có tải đã có integration mới, tiếp tục đối chiếu khả năng khôi phục nháp để đóng cổng đúng phạm vi.
2. Fresh-tab recovery và lost-session mirror đã thử. Browser-process crash/mất điện chưa thử; không dùng close tab để thay bằng chứng đó. Giữ đây là giới hạn bằng chứng và không thao tác cưỡng bức lên browser có tab người dùng.
3. Hoàn thiện đối chiếu accessibility với bằng chứng cụ thể; không thay bằng tổng số tests. Loaded-shutdown đã bổ sung, vẫn giữ giới hạn provider/worker mô phỏng và same-process reopen.

Mixer nhiều track, ripple thoại, transitions giữa scene, upload PSD tùy ý và cộng tác không có trong phiên bản hiện tại. Không tự biến các tính năng mở rộng ấy thành điều kiện mới, cũng không dùng việc loại chúng để thu hẹp mục tiêu ổn định quy trình hiện có. Chưa đánh dấu toàn bộ tám cổng hoàn tất.
