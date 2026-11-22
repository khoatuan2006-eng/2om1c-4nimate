# Hợp đồng dựng dùng lại — version 1

Đây là quy trình làm việc của agent trong Studio hiện có. SQLite giữ scene/document đang dựng; tài liệu, plan đầu vào và báo cáo audit là hướng dẫn/bằng chứng, không phải kho scene thứ hai. EP02 là fixture thử nghiệm. Không coi các mẫu diễn là đã được duyệt nghệ thuật chỉ vì kiểm tra điều kiện qua.

## Các bước và đầu ra

| Bước | Đầu vào | Đầu ra phải có | Điều kiện chuyển bước |
|---|---|---|---|
| Tiếp tục | profile, SQLite project/scene, checkpoint | project revision, scene id, document revision hiện tại | đọc đúng bản đang lưu, giữ cảnh khóa |
| Phân rã | nguyên văn và phạm vi nhỏ | task có source span, ai/làm gì, trước/sau, phụ thuộc, tiêu chí nhìn/nghe | không thiếu/trùng ý trong phạm vi; agent đọc kiểm tra nghĩa |
| Chọn cách diễn | task + kho chính + kho bổ sung | recipe id/version, layer bindings, giới hạn và khoảng trống/cách xử lý | recipe đúng điều kiện; không lấy đứng yên thay chạy hoặc đổi pose thay mọi hành động |
| Dựng | cue đã đo + tài nguyên đã chuẩn bị | document/layer/keyframe của editor + production.taskBindings | compile/import và audit dữ liệu qua; không tạo renderer khác |
| Xem preview | bản đã lưu đang mở trong Studio | playback, frame cần xem, lỗi theo task, evidence có hash | chỉ ghi những gì thực sự đã xem; không chấm ý định |
| Sửa hoặc mở rộng | audit hiện tại + review hiện tại | sửa lỗi, hoặc chọn chuỗi nhỏ tiếp theo | canExpand chỉ đúng khi preflight qua, review đúng hash, outcome pass và không còn lỗi chặn nội dung/logic |

Không yêu cầu mỗi task là một shot. Gom các task cùng không gian/hành động nếu dễ hiểu. Chấp nhận cắt pose thô; ưu tiên đúng chủ thể, ý kể, trước/sau, trái/phải và vị trí tiếp xúc. Không mặc định yêu cầu chuyển động cơ thể liên tục hoặc chăm chút cơ học.

## Hợp đồng dữ liệu

Chuỗi tình tiết được lưu ở `document.storyChains` trong scene neo qua `story-chain-cli.mjs`. Skill thực thi: `.agents/skills/studio-storytelling/SKILL.md`; hợp đồng và CLI: references/contract.md của skill. Chuỗi giữ trước → ai tác động tới ai → phản ứng → kết quả, task/layer thật và khoảng trống. Review cần ảnh trước/tác động/sau, ghi nhận playback và fingerprint bản dựng; thiếu, stale hoặc bị bác chưa xử lý thì không mở rộng. API import và production-audit kiểm tra các chain đã đăng ký. Đây là cổng bằng chứng/phiên bản, không nhận dạng ngữ nghĩa hình ảnh; agent vẫn phải xem và ghi nhận trung thực. Mức diễn đại khái không cho phép mất tình tiết. Xuất video chỉ khi người dùng yêu cầu rõ.

Trong phiên chỉ MCP, preview_play/status yêu cầu Player Studio đang mở phát một phạm vi ngắn của đúng bản lưu; không dùng browser tổng quát hay renderer khác. UI không giành thao tác khi người dùng đang sửa hoặc phát thủ công. Trạng thái played-unreviewed chỉ xác nhận timing/range qua server, không xác nhận agent đã xem/nghe/hiểu. Task dài có thể được review qua nhiều phạm vi nối kín và có playbackId hiện hành; không ép chia nhỏ shot để vừa giới hạn phát. Chi tiết API, launcher và kiểm tra giao thức backend ở SCRIPT-PLANS.md.

Plan: `version`, `id`, `title`, `sourceText`, `identityAliases`, `cues`, `tasks`, `shots`, `document`.

Task: `id`, `source:{start,end,quote}`, `actor`, `action`, `before`, `after`, `dependsOn`, `cueId`, `from/to`, `layerIds`, `visibleRequirements`, `gaps`. Gap ghi thiếu gì, giải pháp cụ thể và trạng thái; không âm thầm bỏ ý.

Storyboard trong Studio là bàn làm việc cho các bước này; kế hoạch chỉnh từng việc nằm trong document.storyboard (version1/tasks), cùng revision/history của editor. Lời đọc/cách diễn đề xuất chưa được thực hiện phải giữ nhãn dự thảo, không coi lưu kế hoạch là đã dựng xong. Xem API ở visual-editor/SCRIPT-PLANS.md.

Document bổ sung `production:{version:1,taskBindings}`. Mỗi binding giữ recipeId/recipeVersion và acceptedLimits đúng registry. Các recipe yêu cầu thêm target/approximation, contacts hoặc poseFacts khi phù hợp. Các giá trị khai báo này là điều cần kiểm tra trực quan, không phải bằng chứng đã diễn được. Không suy ra sự thật về cơ thể từ tên file hoặc lời mô tả do agent tự viết.

API nhập plan mới yêu cầu production contract; scene cũ vẫn mở/chỉnh được. Compiler dùng model của editor, không có bộ nội suy khác. Chỉnh sửa dở dang được phép lưu; trước mở rộng phải chạy audit trên bản SQLite mới nhất. Không nhập lại baseline để đè chỉnh sửa đã lưu.

## Thư viện mẫu diễn

Nguồn chuẩn: `story_workflow_ui/visual-editor/performance-recipes.json`. Version1 có7mẫu: xác lập không gian, chuyển chú ý, giữ pose có ngữ cảnh, dịch pose, cắt đổi hướng, cắt trạng thái hành động, giữ tiếp xúc. Mỗi mẫu có requires, limitations và review. Requires chỉ áp dụng cho mẫu đã chọn. direction-cut v1 là kỹ thuật lật nền/nhân vật đồng mốc, không phải luật bắt mọi khúc rẽ phải lật nền; cách khác cần recipe/version phù hợp. Điều kiện có thể kiểm tra bằng layer/track được kiểm tra bằng code; hướng mắt, nhận diện và tiếp xúc thật vẫn cần xem hình.

Giữ version cũ khi thay hợp đồng recipe; thêm version mới thay vì âm thầm đổi nghĩa mẫu đang dùng. Mẫu chỉ là cách thực hiện có giới hạn, không là công thức camera bắt buộc. Chưa có bằng chứng nhiều cảnh nên cả thư viện hiện ở giai đoạn thử nghiệm.

## Tài nguyên thiếu

Tìm kho chính và catalog bổ sung → chọn pose/face gần nghĩa → đổi bố trí/cắt trạng thái/cận chi tiết để giữ ý → nếu vẫn thiếu, ghi phương án hỗ trợ tối thiểu với reference thật. Chỉ gen để giải quyết khoảng trống cụ thể; ghi chính xác công cụ/model được biết, prompt, tham chiếu, hash, mục đích và hạn chế. Nếu cách thay thế làm mất ý hoặc có lựa chọn quan trọng chưa giải quyết, ghi needs-decision và tiếp tục phần độc lập; không tự gọi là đã đạt.

## Catalog bổ sung trong cùng Studio

`visual-editor/data/media/supplemental/records/<image-hash>.json` giữ metadata và revision; `history/` giữ bản trước; `provenance/<hash>.bin` giữ byte nguồn prompt/reference được lưu trữ. Ảnh ở `media/library-assets/<image-hash>.png`, được chuẩn bị bằng prepared-media hiện có. Các tệp trong media được đưa vào bản backup editor hiện có; không phải một kho ảnh/preview riêng. Nguồn stock lớn ngoài media vẫn phải sao lưu riêng như README editor quy định.

Phân biệt generated / stock-composite / derived / unknown. Candidate được dùng thử và có nhãn chưa duyệt; reviewed cần bằng chứng/nguồn hợp lệ và chỉ nói đã kiểm tra tài nguyên, không phải duyệt phim/native; rejected không xuất hiện trong lựa chọn thông thường. File/hash lỗi được cô lập thành mục không khả dụng, không làm sập toàn kho. Không sửa JSON catalog trực tiếp; đăng ký bằng supplemental-cli, cập nhật có expectedRevision.

```
node visual-editor/supplemental-cli.mjs --file=<absolute-record-input.json>
```

Hồ sơ đầu vào mẫu có thật: `script-analysis/EP02/register-supplements.mjs`. Hồ sơ giữ identity/project scope, tags, capabilities, purpose, limitations, review và provenance. Chọn nguồn **Tài nguyên bổ sung** trong Kho để tìm theo tên/tag. Không áp tài nguyên mang danh tính Nhật Thành cho nhân vật khác chỉ vì tìm thấy trong kho chung.

## Kiểm tra khi đổi cuộc trò chuyện

Từ `D:/Doyin` chạy status; đọc profile và checkpoint lịch sử cùng liveWorkflow. Chạy production.auditCommand do status sinh từ profile từ `story_workflow_ui`. Audit đọc project và `/api/production-workflows/<id>` qua API, đối chiếu fingerprint để không ghép hai snapshot khác nhau. Server xác minh capture registry, input/media/code và playback hiện hành. CLI không tự duyệt từ hash ảnh/file review trên máy. Chỉ đổi metadata/revision mà hình/thoại/recipe không đổi không nhất thiết làm mất review.

```
node visual-editor/production-audit.mjs --project=<id> --scene=<id> --out=<audit.json>
```

Review lưu ở story chain trong SQLite qua Studio/MCP hoặc `story-chain-cli --mode=review`; dùng fingerprint hiện hành, nhận xét từng tình tiết, issues[], captureId của trước/tác động/sau và phạm vi playbackId. Nhận xét của reviewer chưa phải kết luận server. CLI cho lưu nhận xét chưa đủ bằng chứng để tiếp tục sửa, rồi báo đúng kết quả server; không tạo receipt hoặc tự nâng thành đạt. Lỗi sai ý kể/chủ thể/thứ tự/vị trí là blocking; trau chuốt tùy chọn có thể ghi blocking:false. Không tự hạ lỗi nội dung thành trau chuốt để qua cổng. Không có review hiện tại thì bước tiếp theo là xem preview. Flag `--review=<file>` cũ của production-audit chỉ còn là chỉ dẫn di chuyển dữ liệu, không đọc file/ảnh hoặc quyết định canExpand. File audit là báo cáo dẫn xuất, không thay SQLite.

Runtime bổ sung cổng project tại `/api/production-workflows/<projectId>`: backend tự đánh giá toàn bộ task/chain, POST expand/complete ghi receipt khớp snapshot vào SQLite. Store runtime kiểm tra receipt khi thêm cảnh tiếp theo, export kiểm tra receipt complete và grant riêng từ trusted host. Cảnh đầu và chỉnh sửa dở vẫn lưu được. Project cũ thiếu source/task contract cần bổ sung bằng đường workflow hợp lệ trước khi mở rộng/xuất; không lấy metadata pass giả để vượt lỗi. CaptureId phải do composition Studio phát hành; runtime kiểm registry, hash ảnh và input hiện hành. PlaybackId chỉ chứng minh telemetry/timing của player, không chứng minh sự chú ý hoặc hiểu nội dung. Launcher/cách cấu hình client ở SCRIPT-PLANS.md; chưa nghiệm thu tự động hóa hai client hoặc review nghe/nhìn đầy đủ chỉ từ các cổng dữ liệu này.

Native rendering và QG-2 giữ authorization/policy riêng; canExpand không cấp quyền render, không cho điểm và không duyệt master.
