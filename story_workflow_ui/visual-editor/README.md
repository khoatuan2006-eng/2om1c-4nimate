# Trình dựng video theo thoại

Mở http://127.0.0.1:3022. Khởi động bằng `Mo-trinh-chinh-video.cmd` trong `story_workflow_ui`, hoặc `node visual-editor/launch-editor.mjs`. Launcher build giao diện và mở trình duyệt sau khi backend báo sẵn sàng.

Launcher chỉ tái sử dụng runtime có cùng thư mục mã editor, dữ liệu, giao diện và fingerprint phiên bản. Health trả SHA-256 của đường dẫn chuẩn hóa, fingerprint code/dependency/giao diện đã build lúc khởi động và PID; không trả đường dẫn nội bộ. Nếu cổng đang phục vụ dữ liệu khác, code cũ hoặc runtime chưa có nhận diện phiên bản, launcher báo lỗi và giữ nguyên phiên đó. Lưu công việc, đóng phiên đang chạy rồi mở lại, hoặc chọn `EDITOR_PORT` khác. Lưu dự án, thêm media và thay đổi bằng chứng QA không làm đổi fingerprint. Hủy launcher trong lúc build sẽ dừng build và không khởi động backend sau đó.

## Cách làm việc

**Storyboard** mở bảng lời kể–task–tài nguyên của toàn dự án, preview cùng renderer, lưu đề xuất từng việc và quay lại đúng frame/layer trong editor. Lời đọc đề xuất vẫn là dự thảo đến khi có audio mới.

1. Bấm tên dự án ở góc trái để mở hoặc tạo dự án độc lập.
2. **Thêm đoạn**: nhập các dòng sub, tạo giọng đọc, chọn nền rồi mở editor. Số frame lấy từ audio đã đo; thoại, audio và phụ đề đi cùng scene.
3. Bên trái chuyển giữa **Scene**, **Đối tượng**, **Kho**, **Lịch sử**. Kho nằm cùng workspace; thêm nhanh hoặc kéo tài nguyên vào preview.
4. Giữa là preview; bên phải chỉnh X/Y, scale, Z, xoay, lật và thời gian xuất hiện. Click hình hoặc chọn trong danh sách khi đối tượng bị che.
5. Timeline dưới cùng có hai chế độ: **Toàn phim** để xem liên tục và kéo sắp xếp scene; **Scene đang sửa** để trim tài nguyên và đặt keyframe. Nhấp đúp clip toàn phim để sửa scene đó.
6. Bấm ◇ vị trí để đặt một mốc X/Y, sang frame khác rồi kéo hình hoặc nhập tọa độ. Hai tọa độ dùng chung một hàng keyframe. Có easing đều, mềm đầu/cuối, tăng tốc (ease-in), chậm dần (ease-out) và giữ. Easing của mỗi mốc điều khiển đoạn đi từ mốc đó đến mốc kế tiếp. Phím K thêm/xóa mốc vị trí tại con trỏ hiện tại; không kích hoạt khi nhập liệu hoặc giữ Ctrl/Alt/Meta.
7. Chỉnh sửa tự lưu sau khi ngừng thao tác; Ctrl+S lưu ngay. Ctrl+Z / Ctrl+Shift+Z hoàn tác/làm lại trong phiên. **Lịch sử** khôi phục thành phiên bản mới, giữ bản cũ để quay lại.
8. **Xuất video** tạo MP4 xem thử 1080p hoặc 540p từ bản lưu hiện tại. Có tiến độ, hủy, xem lại và tải file. Đóng hộp thoại không hủy tiến trình. Nếu mất phản hồi, **Kiểm tra yêu cầu trước** dùng lại mã đã giữ để nhận đúng phiên xuất, thay vì tạo bản trùng. Độ phân giải giữ theo yêu cầu đó; nhận được trạng thái rồi mới xuất bản mới.

Nếu lưu mất kết nối, chỉnh sửa trong phiên được giữ và cảnh báo có **Thử lưu lại**. Khi cửa sổ khác đã lưu cùng scene, bấm **Xem bản mới trên máy chủ**, xem revision rồi chọn **Giữ chỉnh sửa của tôi** hoặc **Dùng bản trên máy chủ**. Giữ bản của bạn thay toàn bộ chỉnh sửa hình ảnh tại revision đã xem; server thay đổi thêm sẽ bị chặn bằng kiểm tra revision. Dùng bản server đọc lại trước khi áp dụng và yêu cầu chọn lại nếu revision vừa thay đổi. Nháp cục bộ được lưu dự phòng trước khi thay thế; bộ nhớ trình duyệt không ghi được thì giữ nguyên phiên hiện tại. Undo có thể lấy lại chỉnh sửa trước lựa chọn trong phiên. Bấm **Nháp đã giữ** để mở lại bản dự phòng, xem revision/thời gian/X-Y rồi chọn bản cần dùng. Nháp hợp lệ được kiểm tra theo scene; mở nháp chưa ghi vào dự án.

## Dữ liệu và khả năng khôi phục

Trên Windows, worker xuất video tạo Job Object trước khi nạp renderer. Guardian giữ handle của đúng generation worker; worker hoặc guardian bị dừng thì hệ điều hành kết thúc cây tiến trình render. Nếu không tạo được vùng bảo vệ, bản xuất báo lỗi trước khi render. Cơ chế này cần Windows PowerShell và quyền chạy Add-Type; không cần cửa sổ PowerShell hiện trên màn hình. Các nền tảng khác chưa có cùng bảo vệ này. Thay đổi mới cần đóng/mở lại backend sau khi lưu và chờ công việc đang chạy kết thúc.

- `data/projects.sqlite`: nguồn dữ liệu chính của editor, gồm dự án, thứ tự scene, nguồn thoại/audio, chỉnh sửa và lịch sử phiên bản. Ghi trong transaction; revision ngăn cửa sổ khác ghi đè âm thầm.
- `data/media/`: media dùng chung, không còn ghi tài nguyên mới vào public của S01. Ảnh được sao chép theo SHA-256. Phân nhóm nhân vật/pose/face, đạo cụ và nền vẫn lấy từ manifest của kho extract.
- `data/jobs/`: công việc tạo audio. Phiên bị gián đoạn hiển thị lỗi và cho thử lại.
- `data/exports/<id>/`: snapshot bất biến, hash, tiến độ, MP4, log và kết quả kiểm tra số frame/kích thước/audio. Preview toàn phim và export dùng chung `ProjectComposition.tsx`.
- `data/backups/legacy-v1/`: bản sao dữ liệu cũ và `migration-evidence.json` chứa SHA-256 từng file. Migration chạy một lần, giữ nguyên nguồn cũ.
- Local storage giữ nháp chưa đồng bộ và scene/frame đang mở. Nháp cùng revision được phục hồi; nháp cũ xung đột phải được người dùng chọn, không tự ghi đè bản trên máy chủ.
- Sao lưu đầy đủ thư mục `data/` khi server đã dừng (SQLite có WAL khi đang chạy); kho PSD/extract nguồn vẫn nằm ngoài thư mục này và cần sao lưu riêng.

Trong menu dự án, **Sao lưu dữ liệu** tạo bản sao online của SQLite, lịch sử, media và job; có nút kiểm tra lại database, hash và các media tham chiếu. Bản sao lưu trên cùng máy không bảo vệ khỏi hỏng ổ đĩa. Video đã xuất và thư viện PSD/extract bên ngoài không thuộc bản sao này. Phục hồi toàn bộ dùng công cụ riêng sau khi dừng editor. Không thay database thủ công khi server đang chạy.

### Phục hồi bằng giao diện

1. Lưu chỉnh sửa và dừng server editor; chỉ đóng tab không dừng server. Nếu chạy từ cửa sổ lệnh, nhấn Ctrl+C và chờ server dừng.
2. Mở `story_workflow_ui/Mo-phuc-hoi-video.cmd`, rồi truy cập `http://127.0.0.1:3024`.
3. Chọn **Kiểm tra để phục hồi**. Công cụ kiểm tra database, hash và media trước khi cho xác nhận.
4. Xem số dự án/scene, đánh dấu xác nhận rồi bấm **Phục hồi bản đã chọn**. Runtime còn giữ khóa sẽ khiến phục hồi bị từ chối; dữ liệu hiện tại được giữ nguyên.
5. Chờ kết quả, giữ thư mục rollback được hiển thị. Dữ liệu mới hơn và các bản sao cũ nằm trong đó. Đóng công cụ, mở editor và kiểm tra dự án trước khi dọn rollback.

Kết quả được lưu trên đĩa nên tải lại trang vẫn xem được. Gửi lại cùng yêu cầu không phục hồi hai lần. Sau phiên bị gián đoạn, công cụ báo cần kiểm tra và không tự chạy lại phục hồi. Với dữ liệu riêng, đặt `EDITOR_DATA_DIR` trước khi chạy `node visual-editor/recovery-server.mjs`; đổi cổng qua `EDITOR_RECOVERY_PORT`. Công cụ chỉ nghe trên máy cục bộ.

Nếu còn phiên xuất chưa kết thúc, mở editor để kiểm tra/hủy và chờ kết quả trước khi phục hồi. Phục hồi cũng từ chối worker còn sống hoặc chưa xác minh được danh tính, kể cả editor đã đóng. Việc đọc bản sao đang diễn ra phải kết thúc trước khi đổi thư mục; giao diện chỉ báo kết quả cuối sau khi đã ghi kết quả xuống đĩa. Lỗi khóa file tạm thời được thử lại có giới hạn, không xóa dữ liệu hiện tại để ép đổi tên.

Các lệnh CLI chạy từ `D:/Doyin/story_workflow_ui`:

```powershell
node visual-editor/backup-cli.mjs list
node visual-editor/backup-cli.mjs verify --id=<ma-ban-sao>
node visual-editor/backup-cli.mjs restore --id=<ma-ban-sao>
```

`restore` kiểm tra bản sao trước khi thay dữ liệu, từ chối khi runtime còn giữ khóa, và giữ dữ liệu trước phục hồi trong thư mục `data.rollback-<id>`. Đọc kết quả trả về để biết vị trí rollback. Với dữ liệu riêng, thêm `--data-root=<duong-dan-tuyet-doi>` vào từng lệnh. Không xóa rollback cho đến khi đã mở và kiểm tra bản phục hồi.

`visual-editor/saved-edits.json` và workflow episode gốc được giữ làm dữ liệu legacy. Luồng native Studio/QG-2 cũ không tự chuyển sang SQLite; nút xuất của editor dùng pipeline riêng chia sẻ composition với preview. Không coi bản xuất xem thử là phê duyệt hoặc master của episode.

## Giới hạn hiện tại

Đây là editor cục bộ cho video theo thoại, chưa phải bộ dựng đa track tổng quát như Premiere: chưa có ripple trim thoại, mixer audio, transition giữa scene hoặc cộng tác nhiều người. Z sắp lớp trong nhóm CSS, không phải trục sâu 3D. Background mặc định Z=0, phụ đề Z=10000; có thể mở khóa Z khi cần. Chọn hình dựa trên khung chữ nhật gồm cả vùng alpha.

Kho hỗ trợ các tài nguyên đã extract và PSD đã ánh xạ trên máy. Face ghép theo tọa độ PSD, cần kiểm tra tương thích với pose. Chưa hỗ trợ upload PSD tùy ý hoặc tải nguồn yêu cầu đăng nhập. Gemini gợi ý tìm kiếm/đánh giá hình; người dùng chọn tài nguyên cuối cùng.

## Kiểm tra

`npm.cmd run video:edit:check` chạy model, bảo toàn source, persistence, project store, phục hồi nháp và TypeScript. Các test bổ sung: `node --test visual-editor/created-scenes.test.mjs visual-editor/layer-order.test.mjs visual-editor/agent-search.test.mjs visual-editor/discovery.test.mjs`.

Build frontend: `npm.cmd run video:edit:build`. Chạy bản đã build: `npm.cmd run video:edit:start`. Backend HTTP độc lập Vite, mặc định chỉ nghe 127.0.0.1:3022, health tại `/api/health`. Dev/HMR riêng: `npm.cmd run video:edit:dev`. Không chạy dev và runtime cùng thư mục dữ liệu; khóa PID bảo vệ một chủ sở hữu. `EDITOR_DATA_DIR` cho dữ liệu riêng, `EDITOR_PORT` đổi cổng.

Các test chạy với backend riêng trên cổng ngẫu nhiên và dữ liệu tạm; không cần server 3022 đang mở, không ghi EP01.

Runtime giữ quyền sở hữu bằng thư mục `data.lease/owner.json` cạnh thư mục dữ liệu; `data/runtime.lock` là bản metadata tương thích. Gói metadata được chuẩn bị trước và đổi tên nguyên tử vào vị trí chính, tránh khoảng trống khi hai tiến trình cùng thu hồi khóa cũ. PID được đối chiếu với thời điểm khởi động của hệ điều hành. Khóa có chủ còn sống hoặc chưa xác minh được sẽ bị giữ nguyên; không tự xóa khóa lỗi để mở database. Đường dẫn junction/symlink được quy về thư mục thật để không mở cùng dữ liệu dưới hai tên khác nhau.

Dừng sạch sẽ giải phóng cả hai phần khóa. Sau crash hoặc HMR, gói cũ có thể nằm tại `data.lease-stale-<token>` để giữ dấu vết; gói staging bị gián đoạn nằm tại `data.lease-pending-<token>`, không tự trở thành khóa chính. Không xóa `data.lease` hay `runtime.lock` thủ công khi còn phiên hoạt động. Khóa legacy chưa có OS birth vẫn được tôn trọng khi PID còn sống. Journal phục hồi mới cũng có OS birth; journal cũ hoặc danh tính chưa rõ giữ nguyên dữ liệu để kiểm tra.

### Sao lưu và phục hồi nền tảng

Trong `story_workflow_ui`, chạy `node visual-editor/backup-cli.mjs create` để sao lưu online database, media và audio jobs vào `data/backups/<id>/`. SHA-256 từng file và toàn vẹn database được kiểm tra. Exports sinh lại và kho PSD nguồn bên ngoài không được sao lưu; cần giữ riêng mã ứng dụng/kho nguồn.

`node visual-editor/backup-cli.mjs list` liệt kê; `verify --id=<id>` kiểm tra lại. **Đóng editor trước khi** chạy `restore --id=<id>`. Restore chuẩn bị và kiểm tra toàn bộ dữ liệu trước khi đổi thư mục; bản trước được giữ tại `data.rollback-<id>`, receipt ghi đường dẫn. Journal cho phép lần mở tiếp theo phục hồi khi tiến trình chết giữa hai lần đổi tên. Các backup cũ đi cùng thư mục rollback. Có thể dùng `--backup=<đường dẫn thư mục backup>` và `--data-root=<thư mục dữ liệu>`. Giao diện riêng dùng cùng dịch vụ phục hồi với CLI; cổng nghiệm thu toàn nền tảng vẫn đang kiểm chứng.
# Kiểm thử vận hành background jobs

Runtime standalone từ chối công việc mới khi đang dừng. Audio giữ các dòng đã hoàn tất; hết thời gian chờ thì ghi `interrupted`, abort tiến trình/request provider cục bộ và không tự retry kết quả chưa xác định phía dịch vụ. Khởi động lại hoặc callback muộn không được ghi đè lần chạy mới.

Mỗi server chỉ cho xuất một video đồng thời, kể cả hai dự án khác nhau. Yêu cầu hủy được ghi xuống đĩa. Khi đóng server, worker được hủy hợp tác trước; nếu không thoát thì chỉ cây tiến trình do server này tạo mới được dừng cưỡng bức và chờ xác nhận thoát. PID không thuộc server chỉ được quan sát, không dùng làm quyền kill.

Worker được tách khỏi tiến trình cha, ghi log vào file và lưu PID/token cùng thời điểm khởi động lấy từ hệ điều hành. Sau restart, PID có thời điểm khởi động khác được coi là tiến trình khác, không giữ slot của phiên xuất cũ. Nếu thiếu hoặc không đọc được danh tính (gồm bản xuất cũ chưa có trường này), UI báo **Chưa xác minh được phiên xuất**, giữ bản dựng và chặn xuất thêm. Đây không phải quyền dừng cưỡng bức worker của server khác. Bộ đọc danh tính hỗ trợ Windows/Linux; bằng chứng vận hành hiện tại là Windows. Mỗi lần truy vấn Windows có timeout10s, không truy vấn OS cho worker đang được server này quản lý qua child handle.

Xuất video trộn audio thành WAV trước, rồi ghép H.264 và mã hóa AAC trực tiếp vào MP4 để giữ thông tin encoder priming. `snapshot.json`, `job.json` và verification dùng ghi atomic; worker kiểm tra SHA snapshot trước khi dựng. File trung gian nằm trong từng thư mục export và chưa có giao diện dọn dung lượng tự động.

`npm.cmd run video:edit:check` yêu cầu FFmpeg/ffprobe sẵn trong PATH (hoặc `FFMPEG_PATH`/`FFPROBE_PATH`) cho test media thật. QA scene dài là fixture lặp để thử tải, không phải phê duyệt nội dung hay master EP01. Xem `STABILIZATION.md` để biết cổng nào còn chưa được chứng minh.


Nháp đang sửa lưu riêng trong sessionStorage của từng tab; bản dự phòng dùng ID riêng trong localStorage. Lưu ở cửa sổ này không xóa nháp của cửa sổ khác, kể cả khi session của tab mới được sao chép. Nháp cũ được chuyển vào vùng riêng mà không xóa dữ liệu chung; archive cũ vẫn đọc được. Các archive trùng nội dung được gộp thành một dòng hiển thị, dữ liệu vẫn giữ nguyên. Nháp thuộc trình duyệt hiện tại, không nằm trong backup SQLite của server. Xóa dữ liệu trình duyệt hoặc hết dung lượng có thể làm giới hạn phục hồi; cảnh báo bộ nhớ vẫn được hiển thị.

Editor chỉ báo lưu thành công sau khi revision và nội dung phản hồi khớp bản vừa gửi. Nếu server đã lưu nhưng phản hồi bị mất/hỏng, nháp vẫn giữ nguyên; thử lại có thể báo xung đột. Dùng bước đọc bản mới và chọn bản cần giữ để tiếp tục, không tự ghi đè revision mới. Mở scene và khôi phục lịch sử cũng kiểm tra document thuộc scene và keyframe nằm trong thời lượng thực.

Scene đã duyệt và khóa được bảo vệ ở máy chủ. Lỗi này khác xung đột phiên bản: editor giữ nháp và cho giữ bản dự phòng rồi mở lại bản đã khóa; không ghi đè hay tự mở khóa. Nháp đã giữ nằm trong bộ nhớ trình duyệt.

Scene nằm trong phần đã duyệt được mở ở chế độ chỉ xem: có thể chọn đối tượng để xem thông số, phát video và chuyển scene. Các thao tác thay hình ảnh/keyframe/tài nguyên bị vô hiệu hóa. Nháp cũ của scene khóa được giữ riêng, không tự áp dụng khi mở lại. Nếu scene vừa bị khóa trong lúc đang chỉnh, dùng “Giữ nháp và mở lại bản đã khóa” để bảo toàn nháp trước khi tiếp tục điều hướng.

Tạo đoạn có timeout15s cho request máy chủ. Nếu chưa nhận xác nhận tạo audio/scene, nội dung giữ nguyên; kiểm tra công việc trước khi gửi lại. Lỗi tải giọng/nền có nút “Tải lại giọng và nền”. Audio chỉ cho sang chọn nền sau khi dữ liệu và thời lượng hợp lệ; các dòng đã tạo vẫn giữ khi tiếp tục sau lỗi provider.

Nháp tạo đoạn được lưu riêng cho từng cửa sổ. “Nháp tạo đoạn đã giữ” cho mở bản dự phòng thuộc dự án hiện tại; nội dung đang nhập được giữ trước khi thay. Nháp chưa gửi audio sẽ dùng mã mới khi mở ở cửa sổ khác; nháp đã gửi giữ mã công việc để tiếp tục. Danh sách gộp bản trùng khi hiển thị, các record vẫn giữ nguyên trong trình duyệt và không nằm trong serverbackup.

Các phản hồi tạo/dừng/đọc audio và mở đoạn được ràng buộc với dự án, mã nháp, thoại và giọng đang dùng. Chuyển sang nháp khác hoặc rời dự án sẽ bỏ cập nhật từ request cũ; đóng cửa sổ tạo đoạn vẫn cho công việc cùng nháp tiếp tục. Đổi tên đoạn hoặc chọn nền không làm đổi công việc audio.

Khi mở lại nháp ở bước chọn nền, nền được giữ ngay cả khi audio đang tải lại. Editor chờ xác nhận thời lượng trước khi bật “Thêm đoạn & mở editor”; phản hồi lỗi của nháp đã rời không được hiển thị lên nháp mới.

Lỗi lưu trữ khi lưu trả mã riêng `STORAGE_FULL`, `STORAGE_READONLY`, `STORAGE_IO_ERROR`. Giữ nháp, khắc phục dung lượng/quyền hoặc thiết bị rồi thử lại. Kiểm chứng SQLite thật và giới hạn: `evidence/stabilization/storage-fault-verification.json`; chưa thay thế nghiệm thu toàn production.

Audio bị gián đoạn sau khi gửi nhưng chưa lưu kết quả sẽ được đánh dấu chưa xác nhận. Kiểm tra audio trước khi bấm tiếp tục: gửi lại có thể tạo thêm audio ở dịch vụ. Editor không tự gửi lại khi đọc/phục hồi job. Chi tiết kiểm chứng và giới hạn: `evidence/stabilization/audio-uncertainty-verification.json`.

Kiểm thử editor dùng tối đa bốn file test đồng thời để giới hạn số process/PowerShell probe trên Windows. Các tình huống tranh chấp nhiều process bên trong test vẫn chạy đồng thời; kết quả không rõ danh tính tiến trình tiếp tục bị runtime từ chối an toàn.


### Một lệnh kiểm chứng vận hành

Từ `D:/Doyin/story_workflow_ui`, chạy:

```powershell
node visual-editor/test-fixtures/verify-editor.mjs
```

Lệnh chạy tuần tự toàn bộ test editor (tối đa bốn file đồng thời), TypeScript, build thật và smoke launcher trên dữ liệu tạm/cổng ngẫu nhiên. Không cần server3022; không chỉnh EP01 hoặc gọi provider. Launcher kiểm tra reuse, từ chối sai thư mục/phiên bản, restart giữ dự án và dừng IPC giải phóng khóa/cổng. Build cập nhật frontend dùng chung; không tự dừng runtime người dùng. Nếu fingerprint thay đổi, lưu công việc và mở lại editor trước khi sử dụng bản mới.

Mỗi lần chạy giữ `tests.log`, `typescript.log`, `build-launcher.log`, receipt launcher và `report.json` trong một thư mục `evidence/stabilization/operating-<thời-gian>-<id>/`. Lỗi dừng chuỗi và trả exit khác0; log cũ vẫn còn. `operating-verification.json` chỉ trỏ đến lần đạt gần nhất, phải kiểm tra thời gian và source hash trước khi dùng. Kết quả `component-verified` không chứng minh toàn bộ UX, provider, video dài hoặc QG-2. Xem `ACCEPTANCE.md` để rà soát phạm vi. Launcher chờ readiness tối đa khoảng30s; mỗi probe Windows có giới hạn10s và vẫn từ chối khi chưa xác minh được danh tính.
