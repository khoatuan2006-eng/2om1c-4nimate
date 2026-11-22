# Kiến trúc editor và quy tắc mở rộng

Editor chạy cục bộ trên Windows, dành cho video lấy thời lượng từ thoại. React quản lý phiên chỉnh sửa; HTTP backend giữ dữ liệu và công việc bền vững. Một runtime sở hữu một thư mục dữ liệu. Không dùng trạng thái React hoặc nháp trình duyệt làm bằng chứng đã lưu.

## Các ranh giới

| Thành phần | Mã chính | Trách nhiệm |
| --- | --- | --- |
| Khởi động và HTTP | `launch-editor.mjs`, `runtime-server.mjs`, `editor-api.mjs` | Build, readiness/version, loopback, lắp route và dừng dịch vụ |
| Dữ liệu và quyền sở hữu | `project-store.mjs`, `data-lease.mjs`, `process-identity.mjs` | SQLite transaction/history/revision, khóa canonical root, nhận diện generation tiến trình |
| Phiên chỉnh sửa | `App.tsx`, `edit-session.mjs`, `draft-store.mjs` | Chống callback sai scene/project, giữ nháp mỗi cửa sổ, kiểm tra receipt trước báo đã lưu |
| Tạo đoạn | `CreateSceneDialog.tsx`, `create-request-scope.mjs`, `audio-jobs.mjs`, `audio-draft.mjs` | Sub → job audio → thời lượng đo → nền → scene; phục hồi và kiểm tra audio theo nháp |
| Tài nguyên | `library-server.mjs`, `prepared-media.mjs`, `AssetLibrary.tsx` | Đọc kho extract, chuẩn bị media theo hash, lựa chọn pose/face và thêm layer |
| Xuất | `ExportDialog.tsx`, `export-server.mjs`, `export-submission.mjs`, `export-media.mjs` | Mã yêu cầu bền vững, snapshot/media bất biến, progress/cancel/retry, provenance |
| Phục hồi dữ liệu | `backup-service.mjs`, `recovery-server.mjs`, `restore-journal.mjs` | Backup online, verify, restore offline, journal và rollback |
| Dựng hình | `ProjectComposition.tsx`, model và renderer xuất | Preview và export dùng chung composition; verification kỹ thuật tách khỏi duyệt sáng tạo |

## Bất biến cần giữ

1. Thời lượng scene lấy từ audio đã xác minh; trim tài nguyên và keyframe không thay thoại/audio ngầm. Frame nguồn dùng mốc cuối không bao gồm; UI thời gian xuất hiện có thể hiển thị frame cuối bao gồm.
2. Mọi sửa scene thuộc đúng project/scene và revision đã đọc. Thay đổi phải qua store transaction và giữ lịch sử. Scene khóa không được tự mở khóa hoặc ghi đè từ UI, API hay phục hồi nháp.
3. Đổi scene/project hoặc đóng hộp thoại làm callback cũ mất quyền cập nhật phiên mới. Response thiếu/sai identity hoặc nội dung không được diễn giải thành lưu thành công.
4. Browser nháp có thể thất bại vì quota/quyền. Giữ nháp hiện tại trước khi thay bằng bản khác; thất bại phải giữ nguyên nội dung. Browser draft không thuộc backup SQLite.
5. Job audio chưa rõ kết quả phía provider không tự gửi lại. Retry là quyết định có thể gọi provider lần nữa; đọc trạng thái và phục hồi không được gọi provider.
6. Request xuất phải có reservation trước chuẩn bị media. Cùng requestId trả cùng job; không dựa vào timeout hoặc danh sách tạm trống để tạo job thứ hai.
7. Export dùng snapshot và byte media đã cố định, không đọc asset đang thay đổi làm nguồn dựng. Receipt kỹ thuật không phải phê duyệt native/QG-2.
8. PID đơn lẻ không đủ quyền kill/reclaim. Owner còn sống hoặc chưa xác minh phải được giữ; chỉ dừng cây tiến trình thuộc quyền sở hữu đã kiểm chứng.
9. Restore kiểm tra toàn backup trước đổi dữ liệu, yêu cầu editor/job đã dừng, giữ rollback và journal. Không ép xóa khóa hoặc dữ liệu để vượt lỗi.

## Khi mở rộng

- Thêm provider qua adapter audio hiện có; giữ metadata voice/settings, thời lượng đo, cancellation và trạng thái kết quả chưa xác nhận. Kiểm thử lỗi/late callback trước bật cho UI.
- Thêm loại tài nguyên qua catalog/preparation/model/composition; media phải có đường dẫn local đã kiểm tra và hash. Không đưa đường dẫn PSD tùy ý trực tiếp vào renderer.
- Thêm thuộc tính layer ở model/validation và composition trước, sau đó inspector/keyframe. Kiểm tra interpolation, scope và snapshot để preview/export có cùng nghĩa.
- Thay schema phải tăng version, có migration kiểm thử và backup trước chuyển. Không chạy migration mới bằng cách sửa trực tiếp database đang mở.
- Chuyển dữ liệu sang native cần một bước chuyển riêng, có đối chiếu nguồn và bảo vệ prefix đã duyệt. Chưa có cầu nối được nghiệm thu; xem `SOURCE-AUTHORITY.md`.

Đây là các ranh giới đang có trong mã, không phải cam kết plugin API ổn định. `App.tsx` vẫn điều phối nhiều thao tác; khi thêm workflow lớn nên tách controller theo use case và giữ `EditSession` làm ranh giới, tránh mở rộng thêm state/callback đan xen. Chưa có mixer đa track, ripple thoại, transition hay cộng tác nhiều người.
