import React, { useEffect, useRef, useState } from 'react';

const ARCHIVE_TYPES: Array<{ value: string; label: string }> = [
  { value: '', label: 'Tất cả' },
  { value: 'characters', label: 'Nhân vật' },
  { value: 'backgrounds', label: 'Bối cảnh' },
  { value: 'props', label: 'Đạo cụ' },
  { value: 'effects', label: 'Hiệu ứng' },
];

export interface PsdArchiveBrowserProps {
  active: boolean;
  onOpenExtracted: (catalogId: string) => void;
  onQuickAdd?: (catalogId: string) => void;
  adding?: boolean;
}

export function PsdArchiveBrowser({
  active,
  onOpenExtracted,
  onQuickAdd,
  adding,
}: PsdArchiveBrowserProps) {
  const [query, setQuery] = useState('');
  const [type, setType] = useState('');
  const [offset, setOffset] = useState(0);
  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [archiveTotal, setArchiveTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [extractingId, setExtractingId] = useState('');
  const [typeOverrides, setTypeOverrides] = useState<Record<string, string>>({});
  const reqGen = useRef(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      reqGen.current++;
    };
  }, []);

  const fetchArchive = async (q: string, t: string, off: number) => {
    const gen = ++reqGen.current;
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        q,
        limit: '24',
        offset: String(off),
      });
      if (t) params.set('type', t);
      const r = await fetch('/api/library/psd-archive/search?' + params.toString());
      const data = await r.json();
      if (!r.ok) throw Error(data.error ?? 'Không tìm được kho PSD gốc');
      if (mounted.current && gen === reqGen.current) {
        setItems(data.items ?? []);
        setTotal(data.total ?? 0);
        setArchiveTotal(data.archiveTotal ?? 0);
      }
    } catch (e: any) {
      if (mounted.current && gen === reqGen.current) {
        setError(e.message ?? 'Lỗi tải kho PSD gốc');
      }
    } finally {
      if (mounted.current && gen === reqGen.current) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    if (!active) return;
    const delay = query ? 250 : 0;
    const id = setTimeout(() => {
      fetchArchive(query, type, offset);
    }, delay);
    return () => clearTimeout(id);
  }, [active, query, type, offset]);

  const handleExtract = async (item: any) => {
    if (extractingId) return;
    setExtractingId(item.id);
    setError('');
    try {
      const targetType = typeOverrides[item.id] ?? item.guessedType ?? 'characters';
      const r = await fetch('/api/library/psd-archive/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id, type: targetType, label: item.name }),
      });
      const data = await r.json();
      if (!r.ok) throw Error(data.error ?? 'Không trích xuất được PSD');
      if (!mounted.current) return;
      setItems((cur) =>
        cur.map((entry) =>
          entry.id === item.id ? { ...entry, extractedCatalogId: data.catalogId } : entry
        )
      );
      onOpenExtracted(data.catalogId);
    } catch (e: any) {
      if (mounted.current) setError(e.message ?? 'Lỗi khi trích xuất PSD');
    } finally {
      if (mounted.current) setExtractingId('');
    }
  };

  const pageSize = 24;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.floor(offset / pageSize) + 1;

  return (
    <section className="psd-archive-browser" aria-label="Kho PSD gốc">
      <div className="psd-archive-header">
        <strong>Kho gốc ({archiveTotal ? archiveTotal.toLocaleString() : '7,696'} PSD)</strong>
        <small>{total.toLocaleString()} kết quả</small>
      </div>

      <label className="browser-search">
        <span>Tìm trong kho PSD gốc</span>
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOffset(0);
          }}
          placeholder="Tìm PSD gốc (tiếng Việt / Trung / Anh)..."
        />
      </label>

      <nav className="browser-types" aria-label="Lọc loại PSD">
        {ARCHIVE_TYPES.map((opt) => (
          <button
            key={opt.value || 'all'}
            type="button"
            aria-pressed={type === opt.value}
            onClick={() => {
              setType(opt.value);
              setOffset(0);
            }}
          >
            {opt.label}
          </button>
        ))}
      </nav>

      {error && (
        <p role="alert" className="discovery-status">
          {error}
        </p>
      )}

      {loading && <p role="status" className="psd-archive-status">Đang tìm trong kho PSD…</p>}

      {!loading && items.length === 0 && (
        <p className="browser-empty">Chưa thấy file PSD khớp với từ khóa này.</p>
      )}

      <div className="psd-archive-grid">
        {items.map((item) => {
          const isExtracting = extractingId === item.id;
          const chosenType = typeOverrides[item.id] ?? item.guessedType ?? 'characters';
          return (
            <article className="psd-archive-card" key={item.id}>
              <div className="psd-archive-thumb">
                <img src={item.thumbUrl} alt={item.name} loading="lazy" />
              </div>
              <div className="psd-archive-meta">
                <strong title={item.name}>{item.name}</strong>
                <small>
                  {item.folder || 'root'} · {item.sizeMB} MB
                </small>
              </div>
              {item.extractedCatalogId ? (
                <div className="psd-archive-actions">
                  <span className="psd-extracted-badge">✓ Đã trích</span>
                  <button
                    type="button"
                    onClick={() => onOpenExtracted(item.extractedCatalogId)}
                  >
                    Mở bộ
                  </button>
                  {onQuickAdd && (
                    <button
                      type="button"
                      disabled={adding}
                      onClick={() => onQuickAdd(item.extractedCatalogId)}
                    >
                      ＋ Thêm
                    </button>
                  )}
                </div>
              ) : (
                <div className="psd-archive-actions">
                  <select
                    aria-label={`Loại trích cho ${item.name}`}
                    value={chosenType}
                    disabled={isExtracting}
                    onChange={(e) =>
                      setTypeOverrides((cur) => ({ ...cur, [item.id]: e.target.value }))
                    }
                  >
                    <option value="characters">Nhân vật</option>
                    <option value="backgrounds">Bối cảnh</option>
                    <option value="props">Đạo cụ</option>
                    <option value="effects">Hiệu ứng</option>
                  </select>
                  <button
                    type="button"
                    className="primary-action"
                    disabled={!!extractingId}
                    onClick={() => handleExtract(item)}
                  >
                    {isExtracting ? 'Đang trích…' : '⬇ Trích vào kho'}
                  </button>
                </div>
              )}
            </article>
          );
        })}
      </div>

      <nav className="browser-pagination" aria-label="Phân trang kho PSD gốc">
        <small>{total.toLocaleString()} PSD</small>
        <button
          type="button"
          disabled={offset <= 0 || loading}
          onClick={() => setOffset(Math.max(0, offset - pageSize))}
        >
          ←
        </button>
        <span>
          {currentPage} / {pageCount}
        </span>
        <button
          type="button"
          disabled={offset + pageSize >= total || loading}
          onClick={() => setOffset(offset + pageSize)}
        >
          →
        </button>
      </nav>
    </section>
  );
}
