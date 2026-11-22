# Kịch bản → diễn biến → Studio

## Agent qua MCP

Phạm vi nghiệm thu người dùng xác nhận: Codex. Claude Code là adapter tùy chọn; không yêu cầu cài/đăng nhập Claude để hoàn tất vận hành Codex. Các quy tắc backend, nguồn SQLite và quyền xuất tách riêng áp dụng như nhau.

MCP `studio_capture_image({captureId})` trả nội dung PNG sau khi API xác minh registry, project, scene/frame, hash và inputs hiện hành; không nhận đường dẫn file. GET `/api/preview-evidence/<project>/<captureId>` có cùng kiểm tra. Agent phải xem pixel rồi ghi nhận điều quan sát được; việc tải ảnh không tự tạo review pass.

Fingerprint code của capture/playback dùng phạm vi scene đang kiểm tra trong composition hiện có. `composition-dependencies.mjs` lần theo binding/export bằng AST, giữ mã helper dùng chung và tác động khởi tạo module; không render hoặc thực thi code để tính hash. Với các adapter điều phối/context đã xác minh, sửa Scene3 trong file S01 không tự làm stale capture Scene1; fallback saved-edits không thay document SQLite được truyền rõ vào composition. Adapter/registry không nhận diện được giữ hash toàn đồ thị, không đoán rằng phần bị bỏ là an toàn. Dependency động không xác định được bị từ chối. Import initialization và lockfile vẫn được giữ bảo thủ.

Ảnh/audio legacy được chọn từ khai báo giữ lại. `static-media-values.mjs` phân tích giá trị hữu hạn qua helper, JSX props/default, JSON, map và các phép chuỗi/số được hỗ trợ; không thực thi code ứng dụng. Các nhánh có thể xảy ra được hợp lại, không phải chứng minh mọi nhánh sẽ chạy. Helper cục bộ không được tham chiếu không kéo thêm media. Biểu thức/caller chưa xác định hoặc vượt giới hạn vẫn tạo mẫu rộng. Cả tám scene authored hiện có đã xác định được tập đường dẫn hữu hạn; đây không phải cam kết phân tích được JavaScript tùy ý. Digest và freezeExportMedia dùng cùng bộ chọn. Literal trực tiếp, cue/layer/casting tường minh là bắt buộc; candidate suy ra từ các nhánh chỉ được hash/copy khi tồn tại, vì có thể gồm nhánh không chạy. Thêm/xóa/đổi byte candidate có liên quan vẫn thay digest. cast-<sha>.png phải khớp byte. Không dùng file thiếu như bằng chứng scene đã chạy đúng: capture vẫn phải render composition và verifier phải đạt. Evidence từ định dạng codeVersion cũ có thể cần capture/review lại; không chuyển nhãn thành đạt khi thiếu bằng chứng hiện hành. Cơ chế này không sửa scene, trạng thái khóa hoặc điểm QG-2.

Đăng ký bổ sung qua `POST /api/supplements/<projectId>` hoặc MCP `studio_supplement_register`: `{record,pngBase64,attachments:[{sha256,base64}]}`. Record theo supplemental registry cũ, review.status bắt buộc candidate. Không gửi sourceFile; provenance references/documents/evidence dùng `path:"upload:<sha256>"` trỏ attachment đã gửi, không trỏ file server. Server xác minh hash/giới hạn PNG và attachment, chuẩn bị media và gọi registerSupplement hiện có. ExpectedRevision giữ nguyên nghĩa cũ. Upload không thể đổi project sở hữu của mục đã có hoặc tự nâng lên reviewed; có thể dùng lại catalog entry hiện có. Mục mới xuất hiện trong `/api/library/catalog`, dùng cùng `/prepare` và ảnh hash như các tài nguyên khác. Lưu provenance không chứng minh tài nguyên thích hợp về ngữ nghĩa; vẫn phải xem asset và composition.

Launcher Codex sản xuất trên Windows: `node visual-editor/production-client.mjs --project=<id> --task-file=<absolute-text>`. Mặc định chỉ chuẩn bị invocation, chưa gửi task tới model. Thêm `--run` để chạy. Launcher kiểm protocol/canary, pin sandbox và MCP theo phần hướng dẫn vận hành bên dưới. Model Codex thật đã được kiểm đọc/sửa/xem ảnh/replay và tiếp tục qua chat mới trên fixture cô lập; đây chưa là nghiệm thu mọi bề mặt công cụ hoặc review nghe/nhìn toàn cảnh. Cấu hình MCP mẫu riêng bên dưới tự nó không tạo sandbox.

Người dùng xác nhận chưa cài Claude Code. Đã kiểm CLI chính thức từ npm cache bằng launcher hạn chế công cụ, chưa cài global hoặc đăng nhập tài khoản. Tài liệu sandbox chính thức nói shell sandbox native Windows không được hỗ trợ, dùng WSL2 cho built-in sandbox; file tools/MCP/hooks có giới hạn riêng. Không coi deny rule, hướng dẫn CLAUDE.md hoặc việc loại tool là cách ly OS. Nguồn: [Codex permissions](https://learn.chatgpt.com/docs/permissions), [Windows sandbox](https://learn.chatgpt.com/docs/windows/windows-sandbox), [Claude sandbox](https://code.claude.com/docs/en/sandboxing).

`studio-mcp.mjs` là adapter stdio dùng SDK MCP, chỉ gọi API Studio qua HTTP loopback. Khởi chạy với STUDIO_URL và STUDIO_PROJECT_ID bắt buộc trỏ đúng project (URL mặc định http://127.0.0.1:3022). Adapter không đọc DB, không mở shell, không dựng hình riêng và không tự khởi động Studio. Khi Studio bật mật khẩu, STUDIO_SESSION_COOKIE có thể truyền session hiện có qua môi trường riêng của tiến trình; không ghi cookie vào repo hay log. Chưa có luồng đăng nhập agent riêng.

Các công cụ gồm state/scene read, operations, catalog search/details/image/sheet/character preview/prepare, plan import, authoring batch (dryRun=true mặc định), document draft save, episode read/save/build, production transition, preview capture và địa chỉ preview. Backend giữ kiểm tra revision/lock/gate. Preview location chỉ trả đường dẫn và bản lưu, không xem playback hoặc tạo evidence. Capture gọi POST /api/preview-evidence/<projectId> với sceneId/documentRevision/frames: server dùng composition hiện có, trả captureId và hash ảnh. Runtime gate yêu cầu capture registry của server; phải giữ captureId cùng path/sha256/sceneId/frame khi ghi review. MCP đã có gửi/replay yêu cầu xuất nhưng không cấp grant; đăng ký supplement qua MCP dùng uploaded bytes và giữ candidate. Không suy diễn quyền xuất từ transition complete.

Ví dụ cấu hình Codex (đặt trong cấu hình MCP phù hợp của client):

```toml
[mcp_servers.studio]
command = "node"
args = ["D:/Doyin/story_workflow_ui/visual-editor/studio-mcp.mjs"]
env = { STUDIO_URL = "http://127.0.0.1:3022", STUDIO_PROJECT_ID = "PROJECT_ID_FROM_API" }
```

Ví dụ cấu hình Claude Code:

```json
{"mcpServers":{"studio":{"command":"node","args":["D:/Doyin/story_workflow_ui/visual-editor/studio-mcp.mjs"],"env":{"STUDIO_URL":"http://127.0.0.1:3022","STUDIO_PROJECT_ID":"PROJECT_ID_FROM_API"}}}}
```

Thay PROJECT_ID_FROM_API bằng project thực trước khi kết nối. Hai client dùng cùng adapter và cùng workflow; instruction gốc của cả hai dẫn về video-system/RESUME.md. Các ví dụ cấu hình MCP này chưa hạn chế quyền shell/filesystem. Không dùng chúng riêng lẻ như một phiên sản xuất đã cách ly.

`studio_state` trả cursor gọn: project revision, sceneOrder/lockedPrefix, documentRevision và task/chain IDs của từng cảnh, production gate và revision/row IDs của episode draft. Project rỗng trả nextAction import-first-scene-or-build-episode-draft; chưa cần receipt để nhập bản nháp cảnh đầu. Không trả lặp layers/cues/toàn project trong episode. Đọc nguyên văn/document bằng `studio_scene_read`; dùng `studio_episode_read` khi cần sửa draft. Không suy ra active scene từ checkpoint lịch sử.

Launcher sản xuất tách khỏi phiên phát triển, chạy từ `story_workflow_ui`:

```powershell
node visual-editor/production-client.mjs --project=<id> --task-file=<absolute-task.txt>
node visual-editor/production-claude-client.mjs --project=<id> --task-file=<absolute-task.txt>
```

Mặc định chỉ chuẩn bị cấu hình; `--url` chọn loopback Studio, không chấp nhận remote origin. Cả hai launcher kiểm health/agentProtocol v1 trước khi gọi model; mọi MCP tool cũng kiểm giao thức trước khi gọi API. Runtime cũ thiếu các cổng bắt buộc bị từ chối, không fallback sang checkpoint hoặc tự tạo renderer/DB khác. `/api/health` công bố `{agentProtocol:{name:"doyin-studio-production",version:1}}`; đây là năng lực backend, không phải review/approval. Runtime đang chạy từ trước khi nâng code phải được chủ Studio lưu công việc, đóng rồi mở lại bằng launch-editor hiện có.

Codex `--run` kiểm canary MXC filesystem/SQLite/descendants và canary loopback network trước khi khởi động ở cwd tạm, read-only/never approval, bỏ user config/rules, tắt apps/plugins/browser/imagegen/web search và một số công cụ không cần cho sản xuất. CLI vẫn có thể cung cấp generic file/shell/resource/collaboration tools; không suy ra chúng đã bị loại chỉ vì feature flag. Danh sách25 `productionStudioTools` được pin bằng enabled_tools; từng tool có approval_mode approve, ngoài danh sách mặc định prompt/bị chặn. Nhờ vậy các thao tác Studio được phép chạy trong khi shell/file vẫn bị khóa; không cấp chung quyền approve cho server hoặc tools tương lai. Cookie Studio nếu dùng được chuyển qua env_vars, không đặt giá trị cookie trong argv. Kiểm chứng thực tế ngày 2026-11-05 trên Codex 0.166.0-alpha.6: apply_patch/PowerShell ghi file mồi bị từ chối và HTTP POST tới canary localhost bị EACCES; host xác minh file không đổi/server không nhận POST. Không thử ghi DB hay engine thật. Nếu status CLI không truy cập được HTTP trong shell bị hạn chế, dùng state từ MCP đã bound làm nguồn API; không đổi project hoặc mở server khác.

Claude launcher dùng `--restricted`, `--tools ""`, `--strict-mcp-config`, settings riêng, không tải user/project/local settings, không hooks/skills/Chrome, chỉ tự cho phép danh sách cụ thể25 `mcp__studio__<tool>` tương ứng productionStudioTools. Host đọc quy trình/skill/style từ tệp chuẩn và truyền snapshot chỉ dẫn vào phiên; cursor vẫn đọc API. Không bật `--bare` vì chế độ đó bỏ subscription login và cần API/provider credentials riêng. Đây là hạn chế capability của client, không phải sandbox shell native Windows. `--check` kiểm health/protocol/version/flags/auth và không gọi model; `--run` dừng nếu preflight không đạt. Có thể đặt `CLAUDE_CLI` tới executable chính thức nếu chưa có trong PATH. CLI 2.1.318 đã parse cấu hình; model Claude thật chưa đăng nhập/kiểm thử. Không dùng bypassPermissions.

CLI Claude thật cũng được kiểm qua máy chủ model giả lập trên localhost bằng `scripts/verify-claude-production-client.mjs`: init chỉ có23 công cụ Studio (trước khi thêm studio_asset_sheet), đọc cùng revision4, backend từ chối complete và CLI từ chối tool Write không khả dụng; host xác nhận canary không đổi. Script chỉ nhận manifest của fixture `story-acceptance`, kiểm runtime identity đúng data tạm trước khi chạy. Không có model/khóa thật, suy luận hay review sáng tạo trong test này. `DeferredToolPlaceholder` trong giao thức model là metadata deferred-loading theo tài liệu Claude, không phải file tool; kiểm inventory lấy từ init thực và kiểm Write bị từ chối.

Cả hai launcher có điều khiển phát giới hạn qua Studio UI hiện có (chi tiết bên dưới), không cấp browser tổng quát. Codex thật đã kiểm cả sửa scene có sẵn và bắt đầu project trống: tự tìm/xem/prepare catalog, nhập source-backed plan, dry-run/apply, lưu chain, thấy/sửa crop fault có nhãn, replay và tiếp tục bằng client mới. Ca này còn phát hiện hộp subtitle rỗng; phiên phát triển sửa renderer/kiểm pixel, sau đó client sản xuất mới chụp lại và giữ review chưa đạt vì thiếu nghe/nhìn đầy đủ. Capture ảnh và playback telemetry vẫn không thay việc xem/nghe trọn cảnh. Khi chưa quan sát đủ, phải giữ review chưa xác nhận và báo khoảng trống; không ghi watched/pass để vượt gate. Bằng chứng và giới hạn nghiệm thu: `video-system/reviews/agent-workflow-implementation-2026-11-04.md` từ workspace root.

## Thư viện thao tác dựng dùng lại

Các entry point cũ `story-scene-builder.upsertStoryScene` và `renderSceneCV` đã bị vô hiệu hóa: chúng từng ghi DB ngoài versioned API và dựng ảnh bằng bộ nội suy khác. Script gọi chúng phải chuyển sang import plan / authoring batch bên dưới và preview ProjectComposition. Không bật lại đường ghi trực tiếp để tránh lỗi revision hoặc dùng ảnh Pillow làm bằng chứng Studio.

`authoring-operations.mjs` dùng model/keyframe hiện có, không tạo renderer mới. `GET /api/authoring/operations` liệt kê thao tác. `POST /api/authoring/projects/<project>/scenes/<scene>/batch` nhận `{id,revision,assets,commands,dryRun}`. assets ánh xạ tên sang `{catalogId,itemIds}` trong kho chung; nhân vật chọn một pose và tối đa một face cùng bộ. Không nhận đường dẫn ảnh tùy ý.

Chạy từ story_workflow_ui:

```powershell
node visual-editor/authoring-cli.mjs --project=<id> --scene=<id> --file=<batch.json> --dry-run=true --out=<receipt.json>
```

Ví dụ chạy kiểm tra: `script-analysis/EP02/authoring-batch-example.json`. Khi áp dụng thật, bỏ dryRun trong file và cờ CLI; giữ revision vừa đọc từ API. Batch lưu một revision/history, lỗi không lưu một phần. Cùng id/nội dung được gửi lại sẽ không nhân đôi thao tác (giữ tối đa100 receipt); dùng id mới cho lần chỉnh tiếp. Revision cũ, scene khóa và project sai bị chặn. Dry-run không lưu scene nhưng có thể chuẩn bị ảnh bất biến vào cache.

| op | Tham số chính | Điều kiện |
|---|---|---|
| add-character / add-asset | id, asset, from, to, placement?, taskIds? | asset là tên trong assets; gắn task cần phủ thời gian task |
| set-pose-face / replace-asset | layerId, asset | giữ timing/transform/keyframe; cần xem lại fit và tiếp xúc |
| place | layerId, placement:{x,y,height?,anchor?,flipX?,z?} | anchor bottom-center/center/top-left; không dùng khi có key vị trí/scale hoặc xoay |
| layout | preset, layerIds, overrides? | solo/dialogue/pursuit; điểm khởi đầu có thể ghi đè từng slot |
| move | layerId, from, to, delta:{x,y}, easing?, replaceKeys? | dùng model cũ; key có sẵn cần replaceKeys:true rõ ràng |
| pose-sequence | states:[{layerId,from,to,asset}] | các layer trạng thái riêng đã có, liền thời gian; không tự sinh chuyển động trung gian |
| anchor | layerId, local:{x,y}, target:{x,y}, frame? | điểm trong container; không xoay/lật hoặc key vị trí/scale |
| transform | layerId, values, frame?, easing?, replaceKeys? | chỉ thuộc tính model đã có; base không ghi đè track; key trùng cần replaceKeys:true |
| set-range | layerId, from, to | đổi thời gian xuất hiện; phải kiểm tra lại coverage/ngữ nghĩa task |
| replace-from-layer | layerId, sourceLayerId | tái dùng ảnh từ layer cùng loại trong document, giữ khung/timing đích |

`attention-cut.mjs` biên dịch mẫu chú ý: nhân vật trung tính → mục tiêu đã chọn theo thứ tự. Đầu vào là layer, khoảng frame, thời điểm cắt và điểm chuẩn hóa trên ảnh; không chứa danh tính/tập. Điểm crop được chặn trong biên ảnh để không lộ nền đen. Mẫu này không chứng minh mắt/đầu thực sự ngước; phải khai báo hạn chế và xem preview. Ca thử EP02: `attention-cut-batch-v2.json`; không chạy lại như batch mới trên revision khác khi chưa đọc trạng thái hiện hành.

`stage-authoring.mjs` gom các trạng thái được tác giả chọn thành document bằng chính add/place/transform/move; mỗi stage giữ sprites và khoảng frame liền nhau. Lựa chọn truyện/nhân vật nằm ở fixture hoặc plan, không nằm trong thư viện. Task có thể có `screenText` (text thuần tối đa1000ký tự) để hiện thông tin truyện như chỉ số kỹ năng/hồi tưởng; cùng CreatedScene cho preview và export. Phụ đề dài được chia thành phần ngắn trong khoảng task; thời gian ước lượng trong cue không phải căn chỉnh ASR.

`narration-cache.mjs` gọi voice dispatcher hiện có với voiceId được chọn, đo bằng ffprobe, xuất audio bất biến theo hash và giữ request receipt ở cùng media/narration-cache. Request running/uncertain không được gửi lại mù quáng; complete phải đúng hash mới tái dùng. Không tự đổi voice/provider khi lỗi. Đây là adapter/cache cho engine có sẵn, không phải dịch vụ TTS mới.

Tối đa200 lệnh/batch. Thư viện thực hiện thao tác hình học; agent vẫn phải đối chiếu lời kể và xem playback. Không tự suy luận diễn xuất, sinh ảnh, TTS hay duyệt nội dung. Kho nhập cache theo phiên bản manifest; lần đầu đọc/băm ảnh, lần sau tái sử dụng. Thay manifest hoặc phát hiện hash ảnh sai sẽ làm mất cache. Đo core tách riêng khỏi thời gian tải kho, HTTP và preview.

Mỗi đơn vị nội dung giữ nguyên văn/source span, actor/action, before/after, dependency, cue, frame range, recipe, visibleRequirements, layerIds và gaps (thiếu gì, cách xử lý, trạng thái). Đây là việc nhỏ để quản lý; nhiều việc được ghép vào một shot. Đổi pose thô được phép. Agent vẫn phải xem hình và đọc truyện để đánh giá ý nghĩa.

`compileScriptPlan` dùng `model.validateDocument` hiện có. Chặn nguồn stale, bỏ sót ký tự có nghĩa trong cue, task trùng/sai thứ tự, phụ thuộc tương lai, cue sai nguồn/thời gian, lời đọc sai nguyên văn/identityAliases, task không có layer phủ thời gian, shot thiếu/trùng task, gap không có phương án, đường dẫn media không hợp lệ. Các kiểm tra cấu trúc không chứng minh ảnh đúng động tác, nhân vật hay vị trí tiếp xúc.

API POST `/api/script-plans/import` nhận `{projectId, revision, plan}`; chỉ local Origin. Kiểm tra hash media đã chuẩn bị trước khi ghi qua ProjectStore. Nhập lại cùng id/digest trả scene cũ, giữ nguyên chỉnh sửa sau nhập. Plan khác cùng id bị chặn; dùng id phiên bản mới. Project revision sai bị chặn. Không ghi SQLite trực tiếp.

Ảnh dùng `prepared-media.prepareLibraryImage` hoặc `/api/library/prepare`; audio dùng cache đã đo, xác minh hash rồi xuất bản bất biến qua atomic-write. Plan chỉ tham chiếu `library-assets/<hash>.png` và `audio/<hash>.mp3`. Source text và thông tin task được giữ trong source scene của SQLite, không lưu một kho scene riêng.

CLI, chạy tại story_workflow_ui:

```
node visual-editor/import-script-plan.mjs --plan=<absolute-json> --project=<project-id> --receipt=<absolute-json>
```

`--title=<title>` thay `--project` để tạo/mở dự án theo tên; nếu trùng tên phải dùng id. Đọc lỗi trước khi tiếp tục; một dự án mới có thể còn rỗng nếu media/import thất bại. Ưu tiên dùng id dự án đã xác định. Không nhập lại plan để đè sửa tay: scene/document trong SQLite là nguồn đang dựng.

Studio có **Nguồn và diễn biến** bên trên preview (cả cửa sổ hẹp). Chọn task để seek tới đúng frame; xem nguyên văn, trạng thái trước/sau, cue, layer, tiêu chí nhìn thấy và cách xử lý thiếu tài nguyên. Trong sidebar Scene cũng có bảng này. Phụ đề theo đơn vị nội dung; audio vẫn giữ cue đã đo, cùng composition preview/export cũ.

Fixture EP02: `script-analysis/EP02/build-studio-plan.mjs` chuẩn bị tài nguyên cũ, tạo plan; `studio-import.json` giữ project/scene/digest ban đầu; `studio-review.md` ghi review. Generator này chứa lựa chọn riêng của đoạn thử, không phải bộ dựng mọi kịch bản. Bộ chuyển đổi và API độc lập nhân vật/tập; identityAliases do plan cung cấp.

Sau nhập, chỉnh layer qua editor/versioned edits API, xem playback, ghi phát hiện và cách sửa. Không suy ra duyệt từ compiler, test hoặc import. Không gọi export/native để kiểm tra vị trí. Native vẫn theo authorization/policy riêng.

## Hợp đồng sản xuất v1

Quyền xuất là bước riêng với receipt complete: trusted host của Studio cấp grant cho đúng `{projectId,revision,fingerprint,requestId,scale}`, hiệu lực 10 phút, tiêu thụ sau khi job reservation được lưu. Không có HTTP/MCP cấp grant. Host API `app.authorizeExport(input)` dành cho bên sở hữu runtime. Khi chạy runtime CLI trong terminal chủ Studio, bật `EDITOR_OWNER_CONSOLE=1` để nhận một JSON line có `command:"authorize-export"` qua stdin của tiến trình máy chủ; terminal/stream này phải còn mở. Handler chung là export-owner-console.mjs. Export dialog có phần chuẩn bị/sao chép yêu cầu: GET kiểm gate rồi POST complete để backend kiểm lại và ghi receipt; chỉ sau thành công mới hiện JSON đúng revision/fingerprint. Bước này không cấp quyền xuất. Chủ Studio kiểm tra thông tin trước khi nhập ở terminal, sau đó UI hoặc MCP gửi lại cùng requestId. Đây là quyền xuất preview Studio, không cấp quyền native/QG-2. MCP studio_export_request chỉ gửi/replay, studio_export_jobs chỉ đọc. Replay reservation có sẵn không cần grant mới và không chạy lại worker. Agent sản xuất không được giữ stdin/IPC của trusted host hoặc quyền ghi DB; chỉ readonly shell tự nó chưa chứng minh mọi tool surface được cách ly.

Playback của scene đã lưu trong editor được reporter nối vào play/frameupdate/pause/ended. Chỉ ghi nhận khi document đang xem khớp bản project đã lưu; unsaved changes không được dùng làm playback của bản lưu. Server `/api/preview-playback/<projectId>` tạo playbackId, đối chiếu timestamp/frame, giới hạn tốc độ và khoảng gián đoạn; tua nhảy làm đóng phiên. GET trả các phạm vi đã ghi. Review giữ `{sceneId,from,to,playbackId}` ở mỗi playback.ranges; runtime gate kiểm ID server đúng project/scene và fingerprint/media/code hiện hành. MCP studio_playback_records đọc các ID này, không có công cụ tự khai báo đã xem. Ghi nhận này chỉ chứng minh dữ liệu timing do player báo khớp điều kiện server, không chứng minh người xem đã chú ý/hiểu; HTTP client có quyền vẫn có thể mô phỏng báo cáo theo thời gian thực, nên quyền agent/OS vẫn phải được hạn chế. Hiện reporter mới nối scene mode editor, chưa nối full-film hoặc player trong builder.

Điều khiển có giới hạn dùng cùng namespace `/api/preview-playback/<project>/requests`. MCP `studio_preview_play({sceneId,documentRevision,from,to})` xếp yêu cầu2–300 frame; `studio_preview_status({requestId})` đọc lại. Chỉ một yêu cầu chờ/chạy mỗi project, hết hạn nếu không có UI nhận. Mở đúng project trong Studio trước; UI không chiếm player đang phát thủ công, không tự lưu/ghi đè draft, không chạy khi có modal/gesture/save/conflict. Nếu đang xem bản lưu cũ mà không có nháp, UI đọc lại bản hiện hành rồi mới phát. Player dừng tại to-1. Claim/bind/finish là đường UI nội bộ, không có MCP tương ứng; backend yêu cầu playbackId server khớp scene/revision/fingerprint/range và đã dừng. Trạng thái `played-unreviewed` tuyệt đối không là watched/pass. Đổi/xóa scene làm request cũ fail. Chuỗi yêu cầu ngắn có thể phủ một task dài nếu các range có playbackId hợp lệ nối kín, không có khoảng trống; không cần chia lại task/shot chỉ để phát.

API `GET /api/production-workflows/<projectId>` đánh giá contract, task coverage và các causal review đã lưu. `POST` cùng đường dẫn nhận `{revision,action:"expand"|"complete"}`; backend tự kiểm tra và ghi receipt trong meta SQLite, không nhận kết quả pass từ caller. Store singleton của runtime bật productionMode: cảnh đầu được lưu nháp; thêm cảnh tiếp theo qua addScene cần receipt expand khớp snapshot hiện tại và tiêu thụ receipt khi thêm. Export POST cần receipt complete. Các thao tác chỉnh sửa/lưu nháp vẫn hoạt động. Receipt chưa thay thế authorization xuất/native. Evidence phải có captureId server do ProjectComposition phát hành và còn khớp scene/media/code; runtime không công nhận ảnh caller tự khai. ProjectStore không bật productionMode mặc định khi được tạo trực tiếp cho fixture; đó không phải cơ chế cách ly OS.

Plan mới qua API cần document.production và recipe conditions hợp lệ. Xem D:/Doyin/video-system/PRODUCTION-WORKFLOW.md. Scene cũ vẫn chỉnh được. production-audit và story-chain-cli đọc kết luận từ `/api/production-workflows` của đúng snapshot SQLite; không tự quyết định canExpand từ file review/hash ảnh local. Flag --review cũ của audit chỉ là migration hint. Story-chain review lưu nhận xét trước rồi báo kết quả verifier server, không tạo quyền chuyển bước. Inspector thiếu verifier capture/playback hoặc verifier không trả true luôn từ chối; script-plan import cũng dùng verifier thật. canExpand không là quyền render hoặc khóa UI. Catalog bổ sung tích hợp cùng /api/library/catalog và /prepare, không là kho preview khác.

## Storyboard trung tâm

Nút Storyboard trong Studio đọc toàn bộ project đã lưu, nhóm task theo shot, cho tìm kiếm/lọc ghi chú tài nguyên và xem preview bằng ProjectComposition hiện có. Chọn task để tới đúng frame. Cảnh authored chưa có scriptPlan vẫn xem được; không tự sinh nguyên văn/task giả.

PATCH /api/projects/<project>/scenes/<scene>/storyboard nhận {revision,taskId,changes}. changes chỉ có intent, narrationDraft, resourceRequest, notes, status (todo/needs-resource/ready-for-preview). Lưu vào document.storyboard.version1/tasks, dùng cùng saveEdits/history và khóa scene; không sửa source/cue/audio/layer. Conflict409 giữ bản đề xuất trên màn hình. Lời đọc đề xuất chưa tạo audio sẽ được báo rõ và không qua preflight. Đổi kế hoạch làm review cũ stale; trạng thái kế hoạch không phải duyệt phim.

Trong tài nguyên của task, Thay tài nguyên này mở kho với đúng layer đích. Ảnh mới đi qua prepare media; thay đúng một layer cùng loại, giữ thời gian, transform và keyframe, fit theo cùng khung và cần xem lại tiếp xúc. Có thể hủy chế độ thay để thêm mới. Không tự gen ảnh hoặc TTS khi bấm mở kho/lưu đề xuất. Tạo lại audio và tự động áp phương án diễn vẫn là bước tiếp theo, chưa được nút lưu đề xuất thực hiện.


## Opacity, preset chuyển động, chuyển cảnh và hiệu ứng

- **Opacity** là trường thứ 8 của layer (`base.opacity` và keyframe, 0–1). Opacity của layer cha nhân vào layer con (các layer là phần tử ngang hàng, cha chỉ là ma trận). Layer chưa đặt opacity thì renderer không đụng tới.
- **Op mới trong `studio_author_batch`** (biên dịch ra keyframe thường, cùng nội suy): `fade {layerId,from,to,opacity:[a,b]}`, `pop-in {layerId,from?,frames?:8}`, `shake {layerId,from,to,amplitude?:14,step?:2}`, `transition {side:'in'|'out',type,frames}` (`remove:true` để bỏ), `effect {id,asset,from,to,inFrames?:2,outFrames?:6,placement?,z?:300}`. Có keyframe sẵn trong khoảng thì cần `replaceKeys:true`.
- **Chuyển cảnh** (`document.transitions`: `fade-black`, `fade-white`, `wipe-left`, `wipe-right`, `flash`, tối đa 90 frame) được vẽ như lớp phủ **bên trong các frame của chính cảnh**, trên cả phụ đề. Không dùng `@remotion/transitions` vì nó chồng hai cảnh lên nhau, trái bất biến "thời lượng cảnh lấy từ audio".
- **Hiệu ứng** dùng kho `effects` (Nhát chém, Máu bắn, Hiệu ứng va chạm…): ảnh tĩnh toàn khung đặt ở z=300 với đường bao opacity. Mặc định phủ cả khung; nhiều hiệu ứng (như Nhát chém) có vùng tối đặc nên che hết nhân vật, dùng cho khung "impact" ngắn hoặc truyền `placement` nhỏ hơn.
- `ProjectComposition.tsx` và `Editable.tsx` là adapter được ghim hash trong `composition-dependencies.mjs`; sửa chúng phải xem lại và cập nhật hash.
