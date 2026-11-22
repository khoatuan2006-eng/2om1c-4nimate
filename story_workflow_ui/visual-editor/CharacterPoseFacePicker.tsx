import React, { useEffect, useState } from 'react';

let catalogCache: any[] | null = null;
let catalogPromise: Promise<any[]> | null = null;

export async function getLibraryCatalog(): Promise<any[]> {
  if (catalogCache) return catalogCache;
  if (!catalogPromise) {
    catalogPromise = fetch('/api/library/catalog')
      .then(r => r.json())
      .then(data => {
        catalogCache = data;
        return data;
      })
      .catch(() => {
        catalogPromise = null;
        return [];
      });
  }
  return catalogPromise;
}

export interface CharacterPickerProps {
  layer: any;
  infoLabel?: string;
  disabled?: boolean;
  onSelectPose: (character: any, pose: any, face: any) => void;
  onSelectFace: (character: any, pose: any, face: any) => void;
}

export function CharacterPoseFacePicker({
  layer,
  infoLabel,
  disabled,
  onSelectPose,
  onSelectFace
}: CharacterPickerProps) {
  const [catalog, setCatalog] = useState<any[]>(catalogCache || []);
  const [loading, setLoading] = useState(!catalogCache);
  const [tab, setTab] = useState<'poses' | 'faces'>('poses');
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    let live = true;
    getLibraryCatalog().then(data => {
      if (live) {
        setCatalog(data);
        setLoading(false);
      }
    });
    return () => { live = false; };
  }, []);

  const assetName = layer?.asset?.name || infoLabel || '';
  const charBaseName = assetName.split(' · ')[0]?.trim() || '';

  // Find character set in catalog (e.g. "Nhật Thành", "Canis")
  const character = catalog.find(
    (a: any) => a.type === 'characters' && charBaseName && (
      a.name === charBaseName ||
      a.name.startsWith(charBaseName) ||
      charBaseName.startsWith(a.name) ||
      a.name.toLowerCase().includes(charBaseName.toLowerCase()) ||
      charBaseName.toLowerCase().includes(a.name.toLowerCase()) ||
      a.id === charBaseName
    )
  );

  if (loading && !character && charBaseName) {
    return (
      <div className="char-picker-panel">
        <div className="char-picker-header">
          <div className="char-picker-title-group">
            <span className="char-picker-badge">Nhân vật</span>
            <strong className="char-picker-name">{charBaseName}</strong>
          </div>
          <span className="char-picker-spinner" role="status">Đang tải tư thế…</span>
        </div>
      </div>
    );
  }

  if (!character) {
    return null;
  }

  const poses = character.groups?.poses || [];
  const faces = character.groups?.faces || [];

  const currentPose = poses.find((p: any) => assetName.includes(p.name)) || poses[0];
  const currentFace = faces.find((f: any) => assetName.includes(f.name)) || null;

  const handleChoosePose = async (pose: any) => {
    if (disabled || switching) return;
    setSwitching(true);
    try {
      await onSelectPose(character, pose, currentFace);
    } finally {
      setSwitching(false);
    }
  };

  const handleChooseFace = async (face: any) => {
    if (disabled || switching) return;
    setSwitching(true);
    try {
      await onSelectFace(character, currentPose, face);
    } finally {
      setSwitching(false);
    }
  };

  return (
    <div className="char-picker-panel">
      <div className="char-picker-header">
        <div className="char-picker-title-group">
          <span className="char-picker-badge">Nhân vật</span>
          <strong className="char-picker-name">{character.name}</strong>
        </div>
        {switching && <span className="char-picker-spinner" role="status">Đang đổi…</span>}
      </div>

      <div className="char-picker-current-summary">
        <span title={currentPose?.name}>Tư thế: <strong>{currentPose?.name || 'Mặc định'}</strong></span>
        {faces.length > 0 && (
          <span title={currentFace?.name}>Biểu cảm: <strong>{currentFace?.name || 'Mặc định'}</strong></span>
        )}
      </div>

      <nav className="char-picker-tabs" aria-label="Chọn phần nhân vật">
        <button
          type="button"
          className={tab === 'poses' ? 'active' : ''}
          onClick={() => setTab('poses')}
        >
          Tư thế ({poses.length})
        </button>
        {faces.length > 0 && (
          <button
            type="button"
            className={tab === 'faces' ? 'active' : ''}
            onClick={() => setTab('faces')}
          >
            Biểu cảm ({faces.length})
          </button>
        )}
      </nav>

      {tab === 'poses' && (
        <div className="char-pose-grid" role="group" aria-label="Danh sách tư thế nhân vật">
          {poses.map((p: any) => {
            const isSelected = currentPose?.id === p.id || assetName.includes(p.name);
            return (
              <button
                key={p.id}
                type="button"
                className={'char-pose-card ' + (isSelected ? 'selected' : '')}
                disabled={disabled || switching}
                onClick={() => handleChoosePose(p)}
                title={`Chọn tư thế ${p.name}`}
              >
                <div className="char-pose-thumb">
                  {p.url ? <img src={p.url} alt="" loading="lazy" /> : <span>{p.name}</span>}
                </div>
                <span className="char-pose-label">{p.name}</span>
                {isSelected && <span className="char-selected-mark">✓</span>}
              </button>
            );
          })}
        </div>
      )}

      {tab === 'faces' && faces.length > 0 && (
        <div className="char-face-grid" role="group" aria-label="Danh sách biểu cảm nhân vật">
          <button
            type="button"
            className={'char-face-pill ' + (!currentFace ? 'selected' : '')}
            disabled={disabled || switching}
            onClick={() => handleChooseFace(null)}
          >
            <span>Mặc định</span>
            {!currentFace && <span className="char-selected-mark">✓</span>}
          </button>
          {faces.map((f: any) => {
            const isSelected = currentFace?.id === f.id || assetName.includes(f.name);
            return (
              <button
                key={f.id}
                type="button"
                className={'char-face-pill ' + (isSelected ? 'selected' : '')}
                disabled={disabled || switching}
                onClick={() => handleChooseFace(f)}
                title={`Chọn biểu cảm ${f.name}`}
              >
                {f.url && <img className="char-face-mini-thumb" src={f.url} alt="" loading="lazy" />}
                <span>{f.name}</span>
                {isSelected && <span className="char-selected-mark">✓</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
