# Sổ tay nghệ thuật — Nhật Thành

Phạm vi: sở thích và phản hồi sáng tạo theo chủ thể/cảnh. Không giữ cursor, chính sách lưu trữ hoặc quy trình duyệt. Quy trình chuẩn: video-system/RESUME.md.

## Ưu tiên sản xuất và hệ thống dùng lại — 2026-10-29

Làm rõ mới nhất: “chỉ cần tương đối đại khái chứ không cần chi tiết hành động”. Chỉ cần biểu đạt đúng ý chính và logic; cắt nhân vật → mục tiêu có thể thay động tác nhìn, không cần ngước đầu/mắt thật. Không coi thiếu vi động tác là blocker. Vẫn phân biệt hiện tại, hồi tưởng, giả định; không bỏ sự kiện chính. Người dùng đã yêu cầu lập kế hoạch và hoàn thành toàn bộ tập2, cho phép mở rộng bản thử theo mức này; chưa có điểm chất lượng/native approval nào được suy ra.

Chỉ dẫn mới nhất của người dùng: không cần quá chỉnh chu; ưu tiên năng suất, hình/hành động đúng ý thoại và logic, đôi khi ngô nghê vẫn chấp nhận; tận dụng triệt để kho. Cắt đổi pose để diễn được phép, không tự đặt điều kiện phải chuyển động cơ thể liên tục hay tinh chỉnh cơ học mới được tiếp tục. Vẫn phải sửa sai chủ thể, trước/sau, vị trí, nhầm chân hoặc bỏ ý quan trọng. Xét lại các blocker quá khắt khe trong review cũ theo chỉ dẫn này, không tự suy ra mọi bản cũ được duyệt. Mục tiêu chính là hệ thống tạo video agent có thể dùng trong các cuộc trò chuyện khác; tập2 chỉ là ca thử. Entry: video-system/RESUME.md và project profile.

## Chia việc để dựng đúng lời kể — 2026-10-29

Người dùng bác bản thử tập2 vì diễn xuất chưa đạt và chưa follow lời kể. Mục đích chia nhỏ là để agent không ngộp, không bỏ sót và dễ quản lý; không phải tăng số nhịp/shot hoặc chia theo dấu câu. Mỗi việc giữ nguyên văn, chủ thể, trước/sau, phụ thuộc, yêu cầu nhìn/nghe và điểm chưa giải quyết. Đủ ký tự không chứng minh đủ diễn biến. Không dùng tường trống hoặc lời đọc để tính một động tác tiếp xúc là đã dựng. Phải chứng minh một chuỗi nhỏ trước khi rút thư viện và mở rộng; thao tác dùng lại phải khai báo giới hạn, và trạng thái sau không xóa được động tác trước còn thiếu. Không suy ra người dùng duyệt lược hành động từ việc họ cho phép thử.

## Bổ sung tài nguyên có giới hạn — 2026-10-28

Người dùng cho phép: “tôi cho phép bạn tạo ảnh thêm để hỗ trợ nhưng phải phù hợp và không được quá phụ thuộc vào gen ảnh”. Áp dụng cho Nhật Thành tập2: dùng kho pose/face làm nguồn chính; chỉ bổ sung ảnh cho khoảng trống cụ thể đã kiểm tra, có reference thật để giữ nhận diện/nét vẽ. Ưu tiên tài nguyên hỗ trợ nhiều nhịp; không tự tạo cả bộ pose hoặc dùng ảnh đẹp thay diễn xuất. Thiếu vẫn phải ghi và đề xuất phương án. Quyền tạo ảnh không phải duyệt ảnh kết quả, lựa chọn lược hành động hoặc quyền render native.

## Diễn theo thoại quan trọng hơn tạo hình — 2026-10-07
Người dùng: “đừng lạm dụng tạo ảnh quá, quan trọng là diễn theo thoại để người xem hiểu chứ không phải tạo hình đẹp, bản chất phim là dùng hình ảnh xấu mà”. Giữ chất hình thô và tài nguyên có sẵn. Không giải quyết shot yếu bằng thêm ảnh đẹp. Ưu tiên hành động có nguyên nhân, eyeline, chuẩn bị, tiếp xúc, phản ứng và hậu quả đúng lời đọc. Với S05, dừng tạo thêm ảnh sau ba biến thể đã tạo; chúng chỉ là nguyên liệu chưa được duyệt, không phải kết quả đạo diễn. Dùng timing, cắt cảnh và bố trí để làm rõ ý; không tự diễn giải yêu cầu này thành bắt buộc làm hình xấu hơn.

Đây là bộ nhớ sáng tạo từ phản hồi của người dùng, không phải bảng điểm QG-2 hay công thức bắt buộc. Chọn cách biểu đạt theo nội dung, tài nguyên và cảm xúc của từng shot.

## Cách tiếp nối ở cuộc trò chuyện mới

1. Đọc RESUME.md và checkpoint đang hoạt động; xác minh file/server còn tồn tại.
2. Xem ảnh mẫu và feedback.json để hiểu người dùng thích gì, ở phiên bản nào.
3. Đọc quy định của dự án khi workflow yêu cầu. Sổ tay không thay thế AGENTS.md, scene capsule hoặc episode cursor.
4. Chỉ thay phần người dùng yêu cầu; kiểm tra bằng mắt trong preview. Không coi code/build thành công là bằng chứng nghệ thuật.

## Ngôn ngữ hình ảnh đã được khen

### Đối đầu — nhiều người, hai phe, áp lực ở giữa

Người dẫn đầu ở tiền cảnh, đồng phe xếp nhiều lớp phía sau. Hai nhóm hướng vào nhau. Mihawk gần Kizaru. Nền xanh–đỏ và ranh giới zigzag như tia sét tạo sự đối lập. Chữ nằm trên lớp nhân vật. Người dùng đã yêu cầu bỏ khung chữ nhật: không quay lại hai ô cận mặt độc lập.

Ảnh mẫu: ![Đối đầu](examples/lightning-boundary-review.png)

### Aura — sức mạnh được thể hiện quanh người

Năng lượng bộc phát từ layer PSD có sẵn, bật một nhịp rồi dịu; khuôn mặt vẫn rõ. Khi trở nên mạnh mẽ, nhân vật nghiêm và tập trung; không thay ý nghĩa này bằng cây kiếm đơn lẻ hoặc chữ lớn. Không mặc định mọi cảnh đều có aura.

Ảnh mẫu: ![Aura](examples/upgraded-aura.png)

### Pháo và nổ — hành động dẫn chuyển cảnh

Hai tàu tiến đối hướng; pháo giật lùi; nổ lan che màn hình rồi hé lộ shot kế. Chỉ giữ lần nổ ở cảnh tàu. Lần nổ thứ hai sang Nhật Thành bị người dùng nhận xét dư thừa và đã bỏ.

Ảnh mẫu: ![Nổ](examples/explosion-transition.png)

### Người dân — kể sự đe dọa bằng không gian

Người dân nhỏ giữa phố; nhiều bóng đe dọa phủ tới từ hai phía, xuất hiện lệch nhịp. Giữ chủ thể đọc được, không phủ tối đến mất hành động. Ảnh lưu hiện là bản trước khi thêm nhiều bóng; cần cập nhật bằng chứng đúng phiên bản khi kiểm tra tiếp.

## Điều đã sửa và cần tránh

- Không để người bên phải quay ra ngoài khi đang đối đầu.
- Không để chữ bị nhân vật che hoặc chìm vào nền.
- Không biến tất cả shot thành người bên trái, bảng chữ bên phải.
- Không thêm nổ/giật/chớp chỉ để tăng số hiệu ứng.
- Không tự vẽ đạo cụ xấu khi kho đã có tài nguyên phù hợp.
- Không bịa tên pose/face; chọn đúng layer và giữ nhận diện.
- Không nhầm Canis với Cabaji. Canis dùng nhân vật phụ đã duyệt.
- Không tự đặt tên phim chính thức: Nhật Thành là tên nhân vật đã duyệt; tiêu đề cuối hiện dùng tên nhân vật.

## Kiểm tra bong bóng thoại trước khi báo kết quả

Phản hồi người dùng ngày 2026-10-06: “bong bóng thoại bị lệch, tôi nghĩ bạn cần phải ghi nhận là bạn phải check và sửa ở các file md để không để sai mãi như này”.

- Sau mỗi thay đổi pose, face, vị trí, flip hoặc camera, kiểm tra lại bong bóng trong Preview Studio; không coi việc thêm code là đã sửa xong.
- Đuôi thoại phải hướng tới miệng người nói theo ảnh thực tế đã hiển thị. Không tái dùng offset của pose cũ khi silhouette hoặc crop khác.
- Xem câu ngắn và câu dài nhất, đầu/giữa/cuối mỗi lượt thoại. Chữ phải nằm trong bong bóng, không che mặt hoặc đè phụ đề.
- So sánh khung cuối đoạn trước với đầu đoạn mới; rồi phát thử đoạn nối. Sửa lỗi nhìn thấy và xem lại sau sửa trước khi báo cho người dùng.
- Lưu ảnh đúng phiên bản và ghi lỗi còn mở vào checkpoint. Nếu chưa kiểm tra đủ, nói rõ phần chưa kiểm tra; không ghi “đã đồng bộ” dựa vào code.
- Lời dẫn chỉ dùng phụ đề; thoại có bong bóng và phụ đề theo yêu cầu hiện tại.

## Tài nguyên và giới hạn

Ưu tiên tài nguyên local đã duyệt, tách từng layer PSD, loại background, lưu nguồn/layer/bbox. Khi thiếu, ghi khoảng trống và phương án theo PRODUCTION-WORKFLOW.md; tận dụng quyền tạo ảnh hỗ trợ đã có trong phạm vi được phép, không hỏi lại mặc định. Giữ nét vẽ/nhận diện và không lạm dụng. Ảnh Nhật Thành trang phục đã gộp nên không swap face PSD sạch trực tiếp.

## Ghi nhận lời khen từ nay

Khi người dùng khen: ghi nguyên văn câu khen, ngày, shot/phần cụ thể, phiên bản hoặc bằng chứng hiện có, và điều thực sự được thích. Phân biệt lời khen, duyệt tài nguyên và duyệt bản xuất. Không biến “ổn hơn” thành “hoàn hảo” hoặc điểm số. Nếu phạm vi chưa rõ, ghi chưa rõ; không suy diễn. Cập nhật feedback.json và bổ sung nguyên tắc có thể tái dùng vào sổ tay. Nếu phản hồi sau phủ định kết quả trước, giữ lịch sử và đánh dấu mẫu cũ đã bị thay thế.


## Kiểm tra frame và đánh giá trước/sau sửa — 2026-10-06
Người dùng nhắc việc thiếu kiểm tra frame. Mỗi lượt sửa phải có danh sách frame thực tế đã xem, lỗi nhìn thấy, thay đổi để xử lý và frame kiểm tra lại. Xem điểm nối, đầu/giữa/cuối diễn xuất và thoại; phát toàn cảnh rồi ghi FPS/hạn chế quan sát. Không coi playback đã bật là xem liên tục hoặc chứng nhận full-speed. Nếu asset nạp chậm, chụp lại khi hình ổn định trước kết luận.


## Canis — âm mưu có aura riêng
2026-10-06 người dùng khen rất tốt cho aura đen–tím–xanh và tròng mắt đỏ ở S02E v12. Giữ mặt/eyelid/pupil đọc được; aura phía sau người, dịu trước shot nhóm. Đây là lựa chọn riêng cho ý đồ Canis, không bắt buộc aura ở nhân vật khác. Evidence EP01/S02/review-E-red-eyes-v12.jpg; preview only.


## Hệ thống trong cảnh hành động
Phản hồi2026-10-06: S03 bảng quá nhiều chữ, như đọc văn bản, mất ngữ cảnh. Tránh bảng hồ sơ dài; chia thông tin thành nhịp ngắn đúng lời đọc, giữ áp lực nhóm theo sau và trở lại nhân vật sau HUD. Không coi bảng đầy đủ số liệu là dựng phim rõ ràng.


2026-10-06 follow-up: user specifically wants system information illustrated with pictures, not text cards. Prefer visual motifs for each ability and very short labels; keep pursuit staging coherent across the previous scene. V2 text-card screenshots superseded by V3 illustrated HUD.


S03V1–V3 bị người dùng chê lặp/nhàm chán/rất tệ. Không coi thay HUD/icon trên một khung cố định là diễn biến phim. Mỗi shot phải thêm hành động, đối tượng quan sát hoặc thay đổi tâm thế; rút lời đọc liệt kê khi cần. V4 mới chỉ là bản dựng lại chờ xem, không tự đánh giá thành công từ code/screenshot.


## Cửa và kiến trúc — sửa S04 ngày 2026-10-07
Người dùng yêu cầu: 'khung này bỏ đi, bớt lạm dụng việc tạo bằng code và check các frame lại trước khi báo cáo'. Không phủ hình chữ nhật phẳng lên cửa để giả cửa mở. Ưu tiên artwork từ kho; nếu cần biến thể cửa mở, kiểm tra tài nguyên phù hợp và bố cục thực tế. V17 bỏ hai patch tối, kiểm tra Studio420/430/452; đây là sửa preview, không phải duyệt chất lượng.


## Casting and fight blocking — S05 feedback 2026-10-07
User rejected missing identifiable deputy and poor staging, asking to use other characters from the large resource library. Before casting, compare source candidates visually; do not relabel an established henchman as a new officer without distinguishing the role. Match actual exported pose, not its presumed index. For fights verify grip, weapon reach, first contact, recoil, counter and retreat in Studio; avoid distant standing sprites with rotating swords. R8 is an unapproved revision, not evidence that this preference has been satisfied.

## Giữ nguyên hình nhân vật — S05 2026-10-08
Người dùng: 'bạn đang phá vỡ hình ảnh rồi đầy, xa quá rồi, hãy tập trung lại'. R17 tách/xoay tay bị từ chối; đã gỡ và xem lại883. Ưu tiên silhouette nguyên vẹn, pose trong kho và timing; không dùng cắt ghép chi để cưỡng ép diễn xuất. Không coi bản phục hồi là duyệt chất lượng.

2026-10-08 S05: user rejects explosion FX on stab. Match visual FX to action; blade wounds use restrained stock contact/blood/slash assets, no smoke explosion or full-screen burst. Five local PSD candidates collected; only small blood splash used, preview810/883 checked.

## Giới hạn đứng im — 2026-10-08
Người dùng yêu cầu: 'ghi vào quy tắc không đứng im quá 3s'. Áp dụng cho các scene sau và S05 đang sửa: tối đa90frame ở30fps cho một trạng thái/bố cục tĩnh. Trước mốc này cần diễn biến có ý nghĩa: hành động, phản ứng, đổi pose/face hoặc góc nhìn làm rõ câu chuyện. Không coi rung/zoom/FX lặp là thay thế diễn xuất. Giữ silhouette nguyên vẹn; kiểm tra cả playback và các điểm nối trước báo đạt quy tắc.

2026-10-08 S05 user correction: code belongs within physical monitor screen. Camera enlargement must transform background, subject and all occlusion layers together; never scale the bed/patient patch separately. R23 inspected1235/1401/1466/1467, preview only.

## Hệ thống dùng artwork — 2026-10-11
Người dùng: 'scene về bảng hệ thống nhìn rất AI luôn ấy, cả về hình vẽ cũng bằng code'. Tránh dashboard neon, thanh tiến độ và icon hình học vẽ bằng SVG để minh họa năng lực. Ưu tiên artwork raster/PSD trong kho, chữ ngắn, xen phản ứng nhân vật. Code chỉ bố trí và điều khiển chuyển động. Bản S03/S06 thay đổi tại visual-editor/evidence/system-art là preview để xem, chưa được người dùng duyệt chất lượng.



## Bảng hệ thống minh họa diễn biến — 2026-10-11
Người dùng khen S03: “rất tốt nhưng phong chữ lỗi và cần có phong chữ hỗ trợ tiếng Việt, tôt ấn tượng về bảng này, nhớ ghi nhớ lại nhé, rất tốt, 10 điểm”. Điều được khen: bên trong bảng có hình ảnh giải thích năng lực bằng hành động — chuẩn bị/chém kiếm, đọc sách rồi kiến thức đi vào đầu, hiện các nhóm ký ức. Giữ nhãn ngắn, hình và diễn biến là chính; đây là mẫu tham khảo cho bảng năng lực, không ép dùng cho mọi cảnh. Font phải chứa đầy đủ glyph tiếng Việt, nạp ổn định cho preview và xuất. “10 điểm” là lời khen của người dùng, không phải điểm QG-2 hay duyệt bản xuất. Evidence: visual-editor/evidence/system-art/abilities-preview/S03-board.png.


## Giảm tạo hình — sửa S04 2026-10-11
Người dùng: “hơi lạm dụng việc tạo hình rồi ấy, không phải lúc nào cũng tạo nhé, chỉ tạo ảnh cần thiết, để bớt cái tính AI đi”. S04 làm lại bằng pose/face PSD có sẵn, bố cục và cắt cảnh. Không tạo bộ pose mới chỉ để đồng bộ ngoại hình hoặc làm mượt mọi hành động. Khi kho thiếu pose, ưu tiên đổi cách kể/cỡ cảnh, không cưỡng ép tay chân hoặc tạo ảnh hàng loạt. Lời khen S03 chỉ áp dụng cho bảng minh họa ấy.

## Việt hóa chữ trong ảnh — 2026-10-11
Chữ tiếng Trung xuất hiện trong hình phải đổi thành tiếng Việt có đầy đủ dấu. Giữ nguyên minh họa khi chỉ cần sửa chữ; kiểm tra khả năng đọc ở cỡ khung hình thực tế. Không xem việc đổi tên file/layer là đã Việt hóa chữ nằm trong ảnh.

## Bám đuôi S07 — 2026-10-11
Người dùng bác bỏ pose đi bộ tạo mới vì hình và bố cục kém hơn. Với đoạn này dùng PSD gốc; nhóm phía sau tiến gần bằng scale từ điểm tụ, cập nhật vị trí chân và độ giãn ngang tương ứng. Giữ chủ thể tiền cảnh ổn định, tiến/dừng lệch nhịp. Không coi thiếu walk cycle là lý do tự động tạo thêm pose. Bản locomotion bị thay thế, bản scale đang chờ xem.

## Hiệu ứng nhận diện và HUD đo đạc — EP02 S05 (2026-11-01)
Người dùng xác nhận "ok hơn đấy" khi:
- Gỡ bỏ toàn bộ text trang trí, chữ rác giả lập AI và telemetry (như SYSTEM SCAN // MỤC TIÊU, tọa độ COORD, nhãn LIMIT: PASSABLE).
- Tránh đặt text/badge ở góc trên đè vào bong bóng thoại của nhân vật hoặc làm rối bố cục.
- Giữ lại hiệu ứng đồ họa cốt lõi phục vụ đúng lời kể: lưới phối cảnh 3D bám đúng tứ giác bờ tường (tạo cảm giác quét không gian thực), corner brackets ôm nhẹ 4 đỉnh, và mũi tên laser đo đạc kèm badge kích thước rõ ràng (`↕ 2m`).
- Thứ tự hiển thị: lưới phân đoạn nằm sau nhân vật (`z: 5` vs `z: 10`) để không phủ màu lên người; mũi tên đo đạc đặt ở khoảng trống bên cạnh (`u: 0.82`, `z: 15`) để không bị nhân vật che khuất.

## Chuyển thể lời kể & hành động theo kho pose — 2026-11-19
Người dùng chỉ dẫn: “về cốt truyện, do tài nguyên không thể miêu tả hết pose nên cần viết kịch bản lại cho phù hợp nhưng vẫn giữ đúng cốt truyện và tình tiết, hành động thì sửa lại cho phù hợp”.
- Trước khi viết `scene-plan`, đối chiếu hành động trong truyện gốc với kho pose/face thật (`studio_catalog_search` / `studio_asset_sheet`).
- **Được phép viết lại lời kể và điều chỉnh động tác cụ thể** sang những hành động mà kho pose diễn được rõ ràng (ví dụ đổi động tác cơ học phức tạp sang chỉ trỏ, vung đấm, chống nạnh, ôm đầu, bỏ chạy, giơ tay, cắt cận biểu cảm...), thay vì ép pose không hợp hoặc gen thêm ảnh.
- **Bắt buộc giữ nguyên**: cốt truyện, đầy đủ tình tiết chính, danh tính nhân vật, trình tự nguyên nhân–kết quả và cảm xúc của cảnh; không cắt bỏ sự kiện quan trọng.

## Tăng mật độ hiệu ứng motion-comic — 2026-11-19
Người dùng phản hồi về bản cắt nhanh có liên tục không gian: “cũng ok rồi đấy, nhưng thêm nhiều hiệu ứng hơn sẽ đỡ chán hơn”.
- Kết hợp có chủ đích các lớp hiệu ứng motion-comic nhẹ cho từng nhịp hình: aura bám sát nhân vật khi di chuyển, chữ tượng thanh truyện tranh (SFX text), tia sét ranh giới đối đầu, bụi/tia sáng/tàn lửa/vệt gió theo chuyển động, tông màu khí chất (`mood`) và sóng xung kích khi va chạm/bứt tốc.
- Giữ trung tâm khung hình và khuôn mặt nhân vật sạch, đọc rõ biểu cảm; không dùng hiệu ứng che kín màn hình như vụ nổ đá vụn toàn khung khi đang diễn thoại.

## Nhịp cắt, camera & âm thanh motion-comic (Working Layer v2) — 2026-11-19
Người dùng đánh giá bản demo giàu hiệu ứng “hấp dẫn hơn đấy” và yêu cầu học thêm từ mã nguồn mở Remotion phù hợp nhưng vẫn giữ nguyên kiến trúc Studio 3022:
- **Chuyển nhịp & camera có lực**: thêm preset `cutTransition` (`glitch-slam`, `diagonal-wipe`, `energy-burst`, `shutter`), `zoom-punch`, `whip-left`/`whip-right`, và rung máy suy giảm đa tần số (`cameraShake`) cùng vi-chuyển động `breathe`/`float` cho nhân vật khi đứng đối thoại.
- **Tách chủ thể & khung vẽ tay**: hỗ trợ `dof` (mờ nhẹ nền khi cận cảnh), `halftone`, `filmBurn`, `letterbox`, `portalGlow`, hạt nổ mảnh `debris`, khói/mưa tiền cảnh (`smoke`, `rain`), ánh sáng 2D (`sunset`, `night`, `alarm`, `spotlight`, `point`), khung chéo đối đầu (`splitPanel`), chớp tương phản va chạm (`impactFrame`), dư ảnh tốc độ (`actor.trail`), chữ SFX kiểu `glitch` có độ nảy spring, khung bảng/thoại nét vẽ tay (`panel.style: "comic" | "speech" | "system"`), và phụ đề highlight từng từ theo nhịp đọc (`captionStyle: "highlight" | "comic"`).
- **Âm thanh `bgm` + `sfx` tự hạ nhạc nền (`auto-ducking`)**: nhạc nền tự hạ âm lượng khi có câu thoại TTS và đẩy lên ở khoảng nghỉ/hành động; tái sử dụng bộ âm thanh sẵn có trong `motion_intro/public`. Đây là thư viện tùy chọn trong `scene-plan`, không phải bắt buộc cho mọi shot và không thay thế kiểm duyệt hình ảnh thật.

## Đa dạng hiệu ứng nhưng không lạm dụng (Chuẩn tham chiếu `dynamic-cuts-oss-upgraded-720p.mp4`) — 2026-11-20
Người dùng phản hồi khi xem bản dựng mở đầu `001.txt`: “tốt nhưng đang lạm dụng hiệu ứng! tôi chỉ muốn đa dạng chứ không muốn lạm dụng và đến tôi thấy `dynamic-cuts-oss-upgraded-720p.mp4` là ổn nhất ấy”.
- **Không phủ bộ lọc tối/màu hoặc sương khói lên mọi cut**: Tránh đặt `lighting: "sunset" | "spotlight"` hoặc `particles: "smoke"` lặp đi lặp lại trên toàn bộ các nhịp hình khiến video bị tối, đục và mất màu gốc tươi sáng của artwork PSD.
- **Dùng phụ đề sạch (`captionStyle: "classic"`) làm mặc định**: Giữ thanh phụ đề chữ trắng sạch như `dynamic-cuts-oss-upgraded-720p.mp4`; không bật highlight karaoke từng từ trên mọi cảnh.
- **Xen kẽ nhịp thở sạch và điểm nhấn đa dạng theo từng beat**:
  - ~40–50% số cut là **nhịp kể chuyện sạch** (chỉ dùng chuyển động camera, `actor.motion` / `breathe`, và `dof: "soft"` khi cận cảnh hoặc `letterbox` ở nhịp dừng tâm lý).
  - Mỗi beat cao trào chọn **1 tổ hợp hiệu ứng đặc trưng khác nhau** (luân phiên thay vì chồng chất):
    1. *Đòn đánh / Va chạm*: `camera: "zoom-punch"` + `cameraShake` + `impact` + `sfxText` (`style: "impact" | "glitch"`).
    2. *Đối đầu căng thẳng*: `dof: "soft"` + `lightning` phân cách hoặc `lines: "focus"` + `aura` nhẹ sau lưng.
    3. *Bảng Hệ thống (HUD)*: nền sáng tự nhiên có `dof: "soft"` + `portalGlow` xanh lam dịu + `panel` (`style: "system"`) đặt lệch bên trống, tuyệt đối không làm tối đen cả khung hình.
    4. *Bứt tốc / Truy đuổi*: `cutTransition: "energy-burst"` hoặc `"shutter"` + `camera: "whip-right"` + `lines: "speed-horiz"` + `particles: "debris" | "wind"`.

## Cố định nhân vật & vật thể trên cùng bối cảnh (`persistStage` + `focus`) — 2026-11-20
Người dùng chỉ rõ nguyên tắc thiết kế bắt buộc: “vật thể hay nhân vật cần cố định trong một cảnh chứ không phải lúc hiện lúc ẩn... tốt hơn thì nên giữ cố định các đối tượng, nếu cần có thể mờ hay làm chìm các vật thể khác để nhấn mạnh thứ cần nhấn mạnh” (chỉ tách riêng 1 nhân vật khi nhấn mạnh tuyệt đối hoặc đọc thoại nội tâm).
- **Bật `persistStage: true` cho mọi Scene Plan mới**: Trên cùng một bối cảnh (`location`), mọi nhân vật và đạo cụ (như khẩu đại bác `Pháo`, đám hải tặc đứng xung quanh...) sẽ tự động được giữ nguyên vị trí xuyên suốt các beat/cut cho đến khi đổi bối cảnh hoặc có `leave` / `leaveProps` rõ ràng.
- **Nhấn mạnh bằng `focus: "who"` (hoặc `["a", "b"]`) thay vì xóa nhân vật phụ**: Các nhân vật/vật thể không nằm trong `focus` vẫn đứng nguyên vị trí thật trên sân khấu nhưng được làm mờ nhẹ và hạ sáng/bão hòa (`DofStyleOverlay.dimLayerIds`) để nhường toàn bộ sự chú ý cho chủ thể chính.
- **Chỉ dùng `solo: true`** khi cố tình cô lập 1 nhân vật cho cảnh đọc thoại nội tâm hoặc khoảnh khắc nhấn mạnh tuyệt đối.

## Linh hoạt cỡ khung hình (`full` · `bust` · `portrait`) — 2026-11-20 & 2026-11-21
Người dùng nhấn mạnh: “nhiều đoạn nên áp dụng chân dung sẽ hay hơn, vì dễ thấy biểu cảm hơn trong nhiều trường hợp, còn toàn thân vẫn dùng ở những trường hợp cần”.
- **Tự động chân dung cho cận cảnh (`shot: "close"` → tự động `framing: "portrait"`)**: Mọi nhịp cận mặt, phản ứng biểu cảm, thoại nội tâm (`shot: "close"`, không chạy/lao) được trình biên dịch tự động cắt chân dung đầu–vai để gương mặt to, rõ, dễ đọc.
- **Giữ toàn thân (`full`) đúng lúc cần**: Cảnh thiết lập không gian (`shot: "wide"`), chạy đuổi (`run-*`/`dash-*`), dàn hàng hành động hoặc tương tác toàn cơ thể (`shot: "medium"`) vẫn dùng toàn thân; nền biển/bàn họp dùng nửa thân (`bust`). Muốn ép toàn thân trong `shot: "close"` thì ghi rõ `framing: "full"`.

## Diễn xuất sống động khi nói, bong bóng thoại chia nhịp & góc máy đối thoại — 2026-11-21
Người dùng lựa chọn 2 nâng cấp trọng tâm (từ đề xuất trên bản Naruto Tập 01):
- **Nhân vật "sống" đúng lúc đang nói + ký hiệu cảm xúc anime**: Người đang giữ thoại (`speaker` / `actor.speaking`) tự nhún theo nhịp `talk` / `talk-excited`, có thể kèm emote bật nảy cạnh đầu (`shock` `!`, `question` `?`, `anger` `💢`, `sweat` `💧`, `spark` `✦`, `silence` `…`).
- **Bong bóng thoại bám miệng & tự tách lượt khi dài**: Dùng `speech: { who, text, variant: "normal"|"shout"|"thought", maxChars }` để đuôi thoại trỏ về đúng miệng/phía người nói và tránh đè mặt/phụ đề; câu dài tự tách thành 2–3 lượt bong bóng xuất hiện tuần tự đúng nhịp đọc.
- **Đổi góc máy mạnh tay khi đối thoại (`angle`)**: Xen kẽ cảnh rộng với `angle: "ots"` (qua vai làm mờ người nghe ở tiền cảnh, nét người nói), `angle: "reverse"` (cận mặt solo đặt lệch 1/3 kèm phóng nền `dof`), `hero-low`, `dutch-left`/`dutch-right`, mà vẫn giữ nguyên tọa độ sân khấu cho cú quay lại góc rộng (`persistStage`).

## Nhân vật thiếu chuẩn PSD mô-đun (Mặt trống + bộ face kho) — 2026-11-21
Người dùng chỉ dẫn: “tôi nghĩa nên tạo hình jiraiya với các pose như các nhân vật có sẵn và tham chiếu nhân vật có sẵn, và dùng bộ face của bất cứ nhân vật nào sẽ giúp tạo nhân vật ổn hơn”.
- **Tạo pose mặt trống thay vì gen nhân vật có sẵn mặt**: Khi được người dùng cho phép tạo nhân vật chưa có trong kho, tránh gen ảnh đầy đủ mắt/miệng (dễ “rất AI” và không khớp biểu cảm). Tham chiếu trực tiếp tỷ lệ/nét vẽ nhân vật PSD có sẵn trong kho (như `波风水门`) để tạo các pose **mặt trống** (nền `#00FF00`), căn cùng trục đầu trên một canvas tọa độ dương thống nhất (ví dụ `2400×1214`), rồi ghép toàn bộ bộ face PSD thật từ kho (như 122 biểu cảm của `鸣人中期`).
- **Giữ liền mạch trang phục khi cần trạng thái mặt đặc biệt**: Khi nhân vật sẵn có cần khuôn mặt biến trạng thái đặc biệt (ví dụ 6 vệt râu mèo mắt đỏ Cửu Vĩ của Naruto), ưu tiên bổ sung face trực tiếp vào manifest của chính nhân vật đó (`九尾红眼张嘴`, `九尾红眼生气`) thay vì đổi sang bộ nhân vật khác trang phục.
- Ảnh mẫu kiểm tra căn mặt: ![Jiraiya PSD 8 pose](examples/naruto-ch01-v9/jiraiya-v2-check.png)

## Chuẩn tham chiếu đạo diễn & bong bóng thoại (Naruto Tập 01 v9) — 2026-11-21
Người dùng đánh giá bản v9 trên Studio 3022: “hiện tại bản này ổn nhất đấy” (ghi nhận đây là mốc tham khảo preview Studio 3022 theo ngữ cảnh, không suy ra điểm QG-2 hay quyền xuất MP4, và không ép cứng thành công thức duy nhất cho mọi truyện).
- **Bong bóng thoại sạch & thoáng mặt**:
  - Không đặt nhãn tên nhân vật bên trong bong bóng `style: "speech"`.
  - Đuôi thoại dừng ở vành ngoài quanh đầu (`mouthX ± 142`), nới khoảng thoáng vai OTS (`±200`) và cận mặt (`188`) để mũi nhọn không đâm sát vào mặt nhân vật.
  - Phạt điểm ngắt câu rơi vào từ nối/giới từ tiếng Việt (`DANGLING_VN` trong `fx-presets.mjs`); ở cảnh reaction shot mà người nói ở ngoài khung (`noTail`), tự đẩy bong bóng về nửa khung trống đối diện nhân vật đang nghe.
- **4 nguyên tắc đạo diễn tạo khác biệt rõ rệt**:
  1. *Diễn xuất & cung ánh sáng theo tâm lý*: Tắt nét hài khi nội dung chuyển nặng; chuyển ánh sáng theo mạch cảm xúc (tự nhiên → `night` đêm tối → `sunset` hoàng hôn); nhân vật hồi ức đặt trên nền cảnh rộng dùng khung bán thân `bust` để không bị đứng chân lơ lửng lên mái nhà.
  2. *Nhịp dựng linh hoạt & căn `cuts[].ratio` theo mệnh đề*: Không giữ cut nào quá 7 giây (toàn tập 93 cut, `cuts>7s=none`), xen reaction shot vào thoại dài; khi có sự kiện thị giác ở cuối beat (nổ khói phân thân, triệu hồi, hiện Cửu Vĩ), chia `cuts[].ratio` khớp vị trí mệnh đề trong lời đọc để hình bung đúng lúc câu nói tới.
  3. *Cứu các khoảnh khắc đắt giá (golden beats)*: Đạo cụ/sinh vật lớn từ trên trời rơi xuống dùng `enter: "drop-in"` đúng thời điểm lời kể; vẽ prop cel-shaded đồng bộ nét kho (`custom_smoke_poof`) khi cần; ưu tiên cận cảnh biểu cảm (`无声哭泣` + `letterbox`) và cảnh kết cô độc rút hết nhân vật phụ đúng tâm trạng.
  4. *Kiểm chứng tự động + soi bảng ảnh review trước khi báo*: Đối soát nguyên văn thoại (31/31), 0 bong bóng đè mặt/người nghe (95/95), `cuts>7s=none` và xem toàn bộ contact sheet:
     - `examples/naruto-ch01-v9/sheet-v9-NAR-S01.png` .. `examples/naruto-ch01-v9/sheet-v9-NAR-S05.png`.

## Phụ đề sạch kiểu Tập 01 & Thống nhất không gian phong ấn Cửu Vĩ 3/4 — 2026-11-22
Người dùng phản hồi trên Naruto Tập 02: “tốt đấy nhưng không nhất thiết phải để tên dưới phụ đề đâu, phụ đề như tập 1 ấy, và ở scene 1 nên sửa những khúc trò truyện với cửu vĩ nên đưa vào nên bạn vừa tạo thì sẽ đẹp hơn ấy”.
- **Phụ đề sạch, không gắn thẻ tên nhân vật**: Giữ thanh phụ đề chữ trắng đậm sạch như Tập 01 (`classic` white text on dark translucent pill), tách câu thoại `"..."` khỏi dòng lời dẫn truyện (`splitSubtitleSegments`) nhưng không thêm badge tên nhân vật hay đổi màu chữ. Phân biệt thoại vs lời dẫn chủ yếu qua **bong bóng thoại**: chỉ lời trong `"..."` mới hiện bong bóng trỏ tới người nói, lời dẫn chỉ có phụ đề.
- **Thống nhất bối cảnh trò chuyện với Vĩ Thú**: Khi nhân vật nói chuyện trực tiếp với thực thể bị phong ấn như Cửu Vĩ, đưa trọn các khúc đối thoại vào nền không gian phong ấn 3/4 (`custom_mindscape_hall` + `custom_seal_gate` với 3 biến thể `铁门` / `铁门伸爪` / `铁门趴下`), không để Vĩ Thú bay lơ lửng ngoài rừng hay chỉ đứng trong rừng ở các đoạn đối thoại trực diện.





