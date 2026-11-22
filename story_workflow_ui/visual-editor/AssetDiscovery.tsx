import React, { useEffect, useRef, useState } from "react";
async function request(path: string, options?: any) {
  const r = await fetch("/api/library/discovery/" + path, options),
    data = await r.json();
  if (!r.ok) throw Error(data.error ?? "Không kết nối được kho");
  return data;
}
export function AssetDiscovery({ onChoose, onQuickAdd, adding, context, onJobChange, queueOnly = false }: any) {
  const [query, setQuery] = useState(""),
    [type, setType] = useState("characters"),
    [ai, setAI] = useState(true),
    [configured, setConfigured] = useState(false),
    [connectionLoading, setConnectionLoading] = useState(true),
    [items, setItems] = useState<any[]>([]),
    [terms, setTerms] = useState<string[]>([]),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [job, setJob] = useState<any>(null),
    [searched, setSearched] = useState(false);
  const generation = useRef(0);
  const [analysis, setAnalysis] = useState<any>(null);
  useEffect(() => { onJobChange?.(job); }, [job, onJobChange]);
  useEffect(() => {
    request("status")
      .then((d) => setConfigured(d.geminiConfigured))
      .catch(() =>
        setMessage("Chưa kiểm tra được Gemini; có thể tìm bằng từ khóa."),
      )
      .finally(() => setConnectionLoading(false));
  }, []);
  useEffect(() => {
    if (!job) return;
    let stopped = false,
      timer: any;
    const poll = async () => {
      try {
        const d = await request("job?id=" + job.id);
        if (stopped) return;
        if (d.status === "ready") {
          setJob(null);
          onChoose(d.assetId);
          return;
        }
        if (d.status === "failed") {
          setMessage(d.error);
          setJob(null);
          return;
        }
        timer = setTimeout(poll, 1500);
      } catch (e) {
        if (!stopped) {
          setMessage((e as Error).message);
          setJob(null);
        }
      }
    };
    poll();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [job]);
  const search = async (e: any) => {
    e.preventDefault();
    const n = ++generation.current;
    setBusy(true);
    setMessage("");
    setSearched(true);
    setItems([]);
    setAnalysis(null);
    setTerms([]);
    try {
      const d = await request("search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, type, ai: ai && configured, context }),
      });
      if (n === generation.current) {
        setItems(d.items);
        setAnalysis(d);
        setTerms(d.terms);
        setMessage(d.warning ?? "");
      }
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      if (n === generation.current) setBusy(false);
    }
  };
  const extract = async (item: any) => {
    setMessage("");
    try {
      const d = await request(
        "import?token=" + encodeURIComponent(item.token),
        { method: "POST" },
      );
      setJob({ ...d, name: item.name });
    } catch (e) {
      setMessage((e as Error).message);
    }
  };
  return (
    <section className="discovery-panel">
      <div hidden={queueOnly} className="discovery-search-content">
      <form className="discovery-controls" onSubmit={search}>
        <div className="discovery-search-row">
          <select
            aria-label="Loại cần tìm"
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            <option value="characters">Nhân vật</option>
            <option value="props">Đạo cụ</option>
            <option value="backgrounds">Bối cảnh</option>
          </select>
          <textarea
            aria-label="Mô tả tài nguyên"
            placeholder="Ví dụ: thuyền trưởng hải tặc trung niên, râu dài…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            maxLength={500}
          />
          <button
            className="primary-action"
            disabled={connectionLoading || busy || !query.trim()}
          >
            {busy ? "AI…" : "Tìm"}
          </button>
        </div>
        <label className="ai-toggle">
          <input
            type="checkbox"
            checked={ai}
            disabled={!configured}
            onChange={(e) => setAI(e.target.checked)}
          />{" "}
          Gemini{" "}
          <small>
            {connectionLoading
              ? "Đang kiểm tra…"
              : configured
                ? "Đã kết nối"
                : "Chưa cấu hình key"}
          </small>
        </label>
      </form>
      <div className="suggestion-chips">
        {["Hải tặc", "Thiếu niên cổ trang", "Ông lão"].map((t) => (
          <button key={t} onClick={() => setQuery(t)}>
            {t}
          </button>
        ))}
      </div>
      {analysis?.plan && (
        <details className="agent-context">
          <summary>
            {analysis.plan.namedEntity
              ? `Đang tìm: ${analysis.plan.namedEntity}`
              : "AI hiểu yêu cầu"}{" "}
            · {analysis.context?.scene ?? "Không dùng scene"}
          </summary>
          <p>{analysis.plan.intent}</p>
          <p>{analysis.plan.requiredTraits.join(" · ")}</p>
          <small>
            Ngữ cảnh frame {analysis.context?.frame} · {analysis.referenceCount}{" "}
            ảnh tài nguyên trong scene
          </small>
          <ol>
            {analysis.trace.map((t: any, i: number) => (
              <li key={i}>{t.detail}</li>
            ))}
          </ol>
        </details>
      )}
      {analysis?.lowMatch && (
        <p className="match-summary">
          Chưa tìm được ứng viên đạt 70%. Các hình dưới đây là phương án tham
          khảo.
        </p>
      )}
      {terms.length > 0 && (
        <details className="search-details">
          <summary>Từ khóa tìm kiếm</summary>
          <p>{terms.join(" · ")}</p>
        </details>
      )}
      </div>
      {queueOnly && !job && <p className="empty-library">Không có tác vụ extract đang theo dõi trong phiên này. Mở “Tìm PSD mới” để tìm và chuẩn bị tài nguyên.</p>}
      {job && (
        <div className="discovery-status" role="status">
          Đang extract {job.name}… Bạn có thể tiếp tục chỉnh video.
        </div>
      )}
      {message && (
        <p className="discovery-status" role="status">
          {message}
        </p>
      )}
      <div hidden={queueOnly} className="discovery-result-content">
      <div className="discovery-result-heading">
        <strong>
          {busy
            ? "Đọc ngữ cảnh → tìm → xem ảnh…"
            : `Ứng viên${searched ? ` · ${items.length}` : ""}`}
        </strong>
      </div>
      <div className="discovery-results">
        {items.map((item) => (
          <article key={item.token}>
            <div className="candidate-image">
              {item.image ? (
                <img loading="lazy" src={item.image} alt={item.name} />
              ) : (
                <span>Chưa có ảnh xem trước</span>
              )}
            </div>
            <div className="candidate-info">
              <div className="candidate-title">
                <strong>{item.name}</strong>
                <span
                  className={
                    "match-score " + (item.audit?.score >= 70 ? "high" : "low")
                  }
                  title="Điểm tương đồng do AI đánh giá, không phải xác suất đúng"
                >
                  {item.audit ? `${item.audit.score}%` : "Chưa chấm"}
                </span>
              </div>
              {item.audit && (
                <details className="candidate-audit">
                  <summary>
                    {item.audit.match === "exact"
                      ? "Khớp đặc điểm"
                      : item.audit.match === "approximate"
                        ? "Gần giống"
                        : "Không khớp"}
                  </summary>
                  <p>{item.audit.reason}</p>
                  <p>
                    Ngoại hình {item.audit.scores.appearance} · Phong cách{" "}
                    {item.audit.scores.style} · Ngữ cảnh{" "}
                    {item.audit.scores.scene}
                  </p>
                  {item.audit.missing.length > 0 && (
                    <p>Chưa khớp: {item.audit.missing.join("; ")}</p>
                  )}
                </details>
              )}

              <small>
                {item.readyId
                  ? "Đã extract · dùng ngay"
                  : item.canExtract
                    ? "Có PSD trên máy"
                    : "Chưa có PSD trên máy"}
              </small>
              {item.readyId && (
                <button
                  className="primary-action"
                  disabled={!!job || adding}
                  onClick={() => onQuickAdd(item.readyId)}
                >
                  {adding ? 'Đang thêm…' : '＋ Thêm ngay'}
                </button>
              )}
              <button
                disabled={(!!job && !item.readyId) || (!item.readyId && !item.canExtract && !item.sourceUrl)}
                onClick={() =>
                  item.readyId
                    ? onChoose(item.readyId)
                    : item.canExtract
                      ? extract(item)
                      : item.sourceUrl &&
                        window.open(
                          item.sourceUrl,
                          "_blank",
                          "noopener,noreferrer",
                        )
                }
              >
                {item.readyId
                  ? "Tư thế / biểu cảm"
                  : item.canExtract
                    ? "Extract & chọn"
                    : item.sourceUrl
                      ? "Mở nguồn ngoài ↗"
                      : "Chưa có PSD trên máy"}
              </button>
            </div>
          </article>
        ))}
      </div>
      {!busy && !items.length && !message && (
        <p className="empty-library">
          {searched
            ? "Chưa có kết quả. Thử mô tả khác."
            : "Nhập mô tả để tìm nhân vật, đạo cụ hoặc nền."}
        </p>
      )}
      <details className="discovery-help">
        <summary>Cách thêm · ý nghĩa điểm %</summary>
        <p>
          Điểm % là tương đồng ngoại hình (60%), phong cách (20%), ngữ cảnh
          (20%), không phải xác suất đúng. Chưa xem được ảnh sẽ không có điểm.
          Đã extract: chọn pose / face và kéo vào video. Có PSD trên máy: bấm
          Extract & chọn. Tài nguyên mới nằm trong kho Mới extract.
        </p>
      </details>
      </div>
    </section>
  );
}
