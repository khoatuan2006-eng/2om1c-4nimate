# Kho tài nguyên trong trình chỉnh video

Mở http://127.0.0.1:3022 → Kho tài nguyên.

- **Có sẵn**: chọn kho, loại, bộ tài nguyên bằng ảnh; chọn biểu cảm bằng thumbnail; kéo pose vào preview hoặc bấm Thêm. Tài nguyên xuất hiện từ frame hiện tại đến cuối shot, có thể sửa trên timeline.
- **Tìm từ mô tả**: nhập tiếng Việt và bật Gemini để sinh từ khóa tiếng Trung. Kết quả lấy từ kho local hoặc nguồn tìm kiếm mở rộng (nạp qua adapter cục bộ bị `.gitignore`), không phải ảnh do AI tạo. Tắt Gemini để tìm trực tiếp bằng từ khóa.
- **Đã extract**: mở bộ pose/face ngay. **Có PSD trên máy**: extract qua pipeline có kiểm tra và xuất bản nguyên tử, sau đó mở bộ mới. **Chưa có PSD**: mở trang nguồn (nếu có); chưa hỗ trợ tải PSD có yêu cầu đăng nhập hoặc upload PSD từ giao diện này.
- Key dùng cấu hình Gemini hiện có phía server (`keys.txt`/`GEMINI_API_KEY`). Không đưa key xuống trình duyệt.
- Tài nguyên nhập mới và chỉ mục `editor-index.json` lưu cục bộ trong thư mục dữ liệu / preproduction (bị `.gitignore`).
- Trạng thái tác vụ chạy trong tiến trình server; khởi động lại server sẽ mất trạng thái tác vụ đang chạy, nhưng tài nguyên đã xuất bản vẫn nằm trong kho Mới extract.

Kiểm chứng: luồng discovery + extract có kiểm tra origin/token, TypeScript/build và bộ test `discovery.test.mjs` / `agent-search.test.mjs` đạt. Không render video native.

## Chỉ mục tìm kiếm tài nguyên (asset-index)

`data/asset-index.sqlite` là CSDL **dẫn xuất, dựng lại được** từ catalog; không phải nguồn sự thật. Nó thêm mô tả tiếng Việt/tag tiếng Anh cho tên ảnh (phần lớn tên gốc là tiếng Trung) và tìm bằng FTS5, nên agent tìm được "bo chay", "nghe điện thoại", "passerby sitting".

```
node visual-editor/asset-index-cli.mjs sync        # đọc catalog, giữ nguyên mô tả đã có
node visual-editor/asset-index-cli.mjs translate   # áp asset-name-translations.txt
node visual-editor/asset-index-cli.mjs search "bo chay" --type=characters
```

- Bản dịch tên nằm ở `asset-name-translations.txt` (`tên=tiếng Việt|tag,tag`); tên chưa có bản dịch (ví dụ `图层 N`, `元件 N`) được liệt kê, không đoán.
- Mỗi mô tả có `source` (`name-translation`, `vision:<model>`, `manual`) và `lang`; nguồn mới không ghi đè nguồn cũ.
- API: `GET /api/library/search?q=&type=&kind=&limit=&offset=`. Chỉ mục tự tạo khi gọi lần đầu và tự thêm mục catalog mới trước mỗi lần tìm; xóa/đổi tên cần `sync`. MCP `studio_catalog_search` trả `id` (asset) và `imageId` (ảnh khớp).
- Bản dịch là nhãn phụ cho người dùng. Agent nên tìm bằng tên gốc tiếng Trung (ví dụ 逃跑, 接电话) rồi duyệt bằng mắt.
- Chưa làm: mô tả bằng vision cho ~50 ảnh tên vô nghĩa, và tìm theo embedding.

## Duyệt bằng mắt: tờ ảnh lưới (contact sheet)

`GET /api/library/sheet?asset=<catalogId>&kind=poses|faces|props|layers&offset=&limit=` trả một PNG lưới tối đa 36 ô, mỗi ô có số thứ tự và tên gốc; header `X-Sheet-Cells` ánh xạ số → image id. MCP `studio_asset_sheet` trả ảnh + bảng ánh xạ trong một lần gọi.

## Xem trước pose + face ghép

`GET /api/library/combo?asset=<catalogId>&poses=19,23&faces=1,4,12` (số ô trên tờ ảnh, đếm từ 1, hoặc image id) trả lưới tối đa 36 tổ hợp pose×face, ghép đúng như Studio: face đặt tại vị trí bbox trên khung PSD, phủ lên pose không mặt. Không truyền faces thì chỉ hiện pose. Từ 4 tổ hợp trở xuống ô ảnh to hơn (420px). MCP: `studio_character_preview({catalogId,poses,faces})`; phần text ánh xạ ô → poseId/faceId.

Luồng cho agent: tìm (tiếng Trung) → `studio_asset_sheet` xem pose → xem faces theo trang → `studio_character_preview` so vài biểu cảm trên pose đã chọn → prepare/dựng với poseId+faceId → `studio_preview_capture` kiểm tra tỉ lệ, lật, tiếp xúc trong cảnh. Ảnh ghép chỉ kiểm tra mặt khớp đầu, không thay capture cảnh.

## Cấu trúc PSD và nhãn catalog

Nhân vật là con rối "pose liền khối + mặt đặt lên": nhóm `动作` (28 hoặc 52 pose, mỗi pose một smart object cả thân không mặt), cùng 1–2 nhóm mặt: `表情豆豆眼` (mặt hạt đậu, mắt + miệng) và `表情` (mặt chi tiết, mắt màu, lông mày). Hai nhóm mặt có cùng tên mặt (感动, 皱眉…) nên **phải chọn một kiểu cho mỗi nhân vật và giữ cả tập**.

`catalog-annotations.json` (sinh bằng `python -I visual-editor/scripts/build-catalog-annotations.py`, chạy lại khi tách thêm PSD) ghi theo tên file PSD: `frameSet` (`base-28` / `extended-52`) và các nhóm mặt (`style`: `bean` | `detailed` | `generic`). Catalog trả thêm `asset.frameSet`, `asset.faceStyles`, `face.style`. Thứ tự nhóm trong PSD có thể đảo (có file `表情` đứng trước `表情豆豆眼`), nên nhãn lấy theo tên nhóm, không theo vị trí. Tờ ảnh `studio_asset_sheet` đánh dấu mặt B (bean) / D (detailed) và lọc được bằng `style`; số ô luôn là vị trí trong cả nhóm nên khớp với `studio_character_preview`.

Tên đạo cụ `元件 N` được đặt từ ảnh thật trong `asset-name-translations.txt` theo khóa có phạm vi `<tên asset>::<tên mục>`.
