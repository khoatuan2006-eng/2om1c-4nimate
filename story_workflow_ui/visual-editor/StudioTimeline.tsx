import { trackKeys } from './model.mjs';
import { hierarchy } from './scene-graph.mjs';
import React, { useRef, useState, useEffect, useMemo } from 'react';
import {
  IconDiamond,
  IconImage,
  IconMaximize,
  IconMessage,
  IconMinimize,
  IconScissors,
  IconSparkles,
  IconUser,
} from './StudioIcons';

export interface StoryCue {
  id: string;
  index: number;
  from: number;
  to: number;
  text: string;
  durationSec: number;
}

export interface StudioTimelineProps {
  cues: StoryCue[];
  activeCueId: string | null;
  onSelectCue: (cue: StoryCue) => void;
  layers: Record<string, any>;
  selectedLayerId: string;
  onSelectLayer: (id: string) => void;
  totalFrames: number;
  currentFrame: number;
  onSeek: (frame: number) => void;
  playing: boolean;
  onDragClip?: (e: React.PointerEvent, id: string, type: 'move' | 'from' | 'to') => void;
  disabled?: boolean;
  zoomShot?: boolean;
  onToggleZoom?: () => void;
  shotLabel?: string;
  timeFrom?: number;
  timeTo?: number;
  onSplitAtPlayhead?: () => void;
  onToggleKeyframe?: (targetFrame?: number) => void;
  onSelectKeyframe?: (field: string, frame: number) => void;
  onToggleTrackKeyframe?: (field: string) => void;
  onMoveKeyframe?: (field: string, from: number, to: number) => void;
  chosenKey?: { field: string; frame: number } | null;
  proMode?: boolean;
}

export function StudioTimeline({
  cues,
  activeCueId,
  onSelectCue,
  layers,
  selectedLayerId,
  onSelectLayer,
  totalFrames,
  currentFrame,
  onSeek,
  playing: _playing,
  onDragClip,
  disabled,
  zoomShot,
  onToggleZoom,
  shotLabel,
  timeFrom: propTimeFrom,
  timeTo: propTimeTo,
  onSplitAtPlayhead,
  onToggleKeyframe,
  onSelectKeyframe,
  chosenKey,
  onMoveKeyframe,
  onToggleTrackKeyframe,
  proMode = false,
}: StudioTimelineProps) {
  const keyDragMoved = useRef(false);
  const tracksRef = useRef<HTMLDivElement>(null);
  const [scrollbarWidth, setScrollbarWidth] = useState(0);

  useEffect(() => {
    const node = tracksRef.current;
    if (!node) return;
    const update = () => setScrollbarWidth(node.offsetWidth - node.clientWidth);
    const observer = new ResizeObserver(update);
    observer.observe(node);
    update();
    return () => observer.disconnect();
  }, []);

  const rulerRef = useRef<HTMLDivElement>(null);
  const [collapsedNodes, setCollapsedNodes] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!selectedLayerId || !layers[selectedLayerId]) return;
    const ancestors = hierarchy(layers, selectedLayerId).slice(1);
    setCollapsedNodes((previous) => {
      if (!ancestors.some((id) => previous[id])) return previous;
      const next = { ...previous };
      for (const id of ancestors) next[id] = false;
      return next;
    });
  }, [selectedLayerId, layers]);

  const timeFrom = zoomShot && propTimeFrom !== undefined ? propTimeFrom : 0;
  const timeTo = zoomShot && propTimeTo !== undefined ? propTimeTo : totalFrames;
  const rangeDuration = Math.max(1, timeTo - timeFrom);

  const playheadPercent = Math.max(
    0,
    Math.min(100, ((currentFrame - timeFrom) / rangeDuration) * 100)
  );

  const handleRulerPointer = (e: React.PointerEvent) => {
    if (disabled || !rulerRef.current) return;
    const rect = rulerRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const targetFrame = Math.round(timeFrom + ratio * rangeDuration);
    onSeek(Math.max(0, Math.min(totalFrames - 1, targetFrame)));
  };

  const ticksCount = Math.min(12, Math.max(4, Math.floor(rangeDuration / 30)));
  const ticks = Array.from({ length: ticksCount + 1 }, (_, i) => {
    const frameAtTick = timeFrom + Math.round((i / ticksCount) * rangeDuration);
    const sec = (frameAtTick / 30).toFixed(1);
    const percent = (i / ticksCount) * 100;
    return { frame: frameAtTick, sec, percent };
  });

  const assetEntries = useMemo(() => {
    return Object.entries(layers).filter(([_, l]: any) => l.asset);
  }, [layers]);

  const charEntries = useMemo(() => {
    return assetEntries.filter(([id, layer]: [string, any]) => {
      if (layer.parentId) return false;
      const asset = layer.asset;
      return (
        asset.type === 'characters' ||
        (!asset.type && /\b(char|actor)\b|nhân vật/i.test(asset.name || id))
      );
    });
  }, [assetEntries]);

  const bgEntries = useMemo(() => {
    return assetEntries.filter(([id, layer]: [string, any]) => {
      if (layer.parentId) return false;
      if (charEntries.some(([cId]) => cId === id)) return false;
      const asset = layer.asset;
      return (
        asset.type === 'backgrounds' ||
        (!asset.type && /\bbg\b|background|nền/i.test(asset.name || id))
      );
    });
  }, [assetEntries, charEntries]);

  const propEntries = useMemo(() => {
    return assetEntries.filter(([id, layer]) => {
      if (layer.parentId) return false;
      return (
        !charEntries.some(([cId]) => cId === id) &&
        !bgEntries.some(([bId]) => bId === id)
      );
    });
  }, [assetEntries, charEntries, bgEntries]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (disabled || !selectedLayerId || e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
      const tag = (document.activeElement?.tagName || '').toLowerCase();
      if (
        (document.activeElement as HTMLElement)?.isContentEditable ||
        tag === 'input' ||
        tag === 'textarea' ||
        tag === 'select'
      ) {
        return;
      }
      if (e.key === 's' || e.key === 'S') {
        if (!onSplitAtPlayhead) return;
        e.preventDefault();
        onSplitAtPlayhead();
      } else if (e.key === 'k' || e.key === 'K') {
        if (!onToggleKeyframe) return;
        e.preventDefault();
        onToggleKeyframe(currentFrame);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [disabled, onSplitAtPlayhead, onToggleKeyframe, selectedLayerId, currentFrame]);

  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>(() => ({
    cues: false,
    characters: false,
    backgrounds: assetEntries.length > 5,
    props: assetEntries.length > 7,
  }));

  useEffect(() => {
    if (!selectedLayerId || !layers[selectedLayerId]) return;
    const rootId = hierarchy(layers, selectedLayerId).at(-1);
    if (bgEntries.some(([id]) => id === rootId) && collapsedGroups.backgrounds) {
      setCollapsedGroups((prev) => ({ ...prev, backgrounds: false }));
    } else if (propEntries.some(([id]) => id === rootId) && collapsedGroups.props) {
      setCollapsedGroups((prev) => ({ ...prev, props: false }));
    } else if (charEntries.some(([id]) => id === rootId) && collapsedGroups.characters) {
      setCollapsedGroups((prev) => ({ ...prev, characters: false }));
    }
  }, [selectedLayerId, bgEntries, propEntries, charEntries, collapsedGroups]);

  const toggleGroup = (groupId: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  const allCollapsed =
    collapsedGroups.characters && collapsedGroups.backgrounds && collapsedGroups.props;

  const selectedLayer = selectedLayerId ? layers[selectedLayerId] : null;
  const hasKeyAtPlayhead = Boolean(
    selectedLayer?.keys?.x?.some((k: any) => k.frame === currentFrame) ||
      selectedLayer?.keys?.y?.some((k: any) => k.frame === currentFrame)
  );

  const toggleCollapseAll = () => {
    const nextState = !allCollapsed;
    setCollapsedGroups({
      cues: nextState,
      characters: nextState,
      backgrounds: nextState,
      props: nextState,
    });
  };

  const renderTypeIcon = (groupType: 'char' | 'bg' | 'prop') => {
    if (groupType === 'char') return <IconUser size={12} />;
    if (groupType === 'bg') return <IconImage size={12} />;
    return <IconSparkles size={12} />;
  };

  const renderClipTrack = ([id, layer]: [string, any], groupType: 'char' | 'bg' | 'prop') => {
    const asset = layer.asset;
    const chain = hierarchy(layers, id).map((key) => layers[key].asset);
    const assetFrom = Math.max(timeFrom, ...chain.map((a) => a.from));
    const assetTo = Math.min(timeTo, ...chain.map((a) => a.to));
    if (assetTo <= timeFrom || assetFrom >= timeTo) return null;

    const left = ((assetFrom - timeFrom) / rangeDuration) * 100;
    const width = ((assetTo - assetFrom) / rangeDuration) * 100;
    const isSelected = id === selectedLayerId;
    const isChildOfSelected = selectedLayerId && layer.parentId === selectedLayerId;
    const isParentOfSelected = selectedLayerId && layers[selectedLayerId]?.parentId === id;
    const displayName = (asset.name || id).split(' · ')[0];

    return (
      <div
        key={id}
        className={`studio-track studio-track-${groupType} ${isSelected ? 'selected' : ''} ${
          isChildOfSelected ? 'is-child-highlight' : ''
        } ${isParentOfSelected ? 'is-parent-highlight' : ''}`}
        onClick={(e) => {
          e.stopPropagation();
          onSelectLayer(id);
        }}
      >
        <div
          className="track-header"
          title={asset.name || id}
          style={{ paddingLeft: 8 + 14 * (hierarchy(layers, id).length - 1) }}
        >
          {assetEntries.some(([, child]) => child.parentId === id) ? (
            <button
              className="tree-toggle"
              type="button"
              aria-label={'Thu mở nhóm ' + asset.name}
              aria-expanded={!collapsedNodes[id]}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                setCollapsedNodes((previous) => ({ ...previous, [id]: !previous[id] }));
              }}
            >
              {collapsedNodes[id] ? '▸' : '▾'}
            </button>
          ) : (
            <span className="tree-toggle-placeholder" aria-hidden="true" />
          )}

          <span className="track-icon">{renderTypeIcon(groupType)}</span>
          <span className="track-label">{displayName}</span>

          {layer.parentId && (
            <span
              className="track-parent-tag"
              title={`Đi theo: ${layers[layer.parentId]?.asset?.name || layer.parentId}`}
            >
              ↳ {layers[layer.parentId]?.asset?.name || 'Cha'}
            </span>
          )}

          {isSelected && onToggleKeyframe && (proMode || hasKeyAtPlayhead) && (
            <button
              type="button"
              className={`track-keyframe-toggle ${hasKeyAtPlayhead ? 'active' : ''}`}
              title={
                hasKeyAtPlayhead
                  ? 'Xóa keyframe vị trí tại frame hiện tại'
                  : 'Thêm keyframe vị trí tại frame hiện tại'
              }
              onClick={(e) => {
                e.stopPropagation();
                onToggleKeyframe(currentFrame);
              }}
            >
              {hasKeyAtPlayhead ? '◆' : '◇'}
            </button>
          )}
        </div>

        <div
          className="track-lane"
          onPointerDown={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
            const targetFrame = Math.round(timeFrom + ratio * rangeDuration);
            onSeek(Math.max(0, Math.min(totalFrames - 1, targetFrame)));
            onSelectLayer(id);
          }}
        >
          <div
            className={`studio-clip-block clip-${groupType} ${isSelected ? 'selected' : ''}`}
            style={{ left: `${left}%`, width: `${width}%`, border: 0 }}
            onPointerDown={(e) => onDragClip && onDragClip(e, id, 'move')}
            onDoubleClick={(e) => {
              e.stopPropagation();
              if (disabled || !onToggleKeyframe) return;
              const lane = e.currentTarget.parentElement;
              const rect = lane
                ? lane.getBoundingClientRect()
                : e.currentTarget.getBoundingClientRect();
              const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
              const targetFrame = Math.round(timeFrom + ratio * rangeDuration);
              onSeek(targetFrame);
              onSelectLayer(id);
              onToggleKeyframe(targetFrame);
            }}
            title="Kéo để dời vị trí · Nhấp đúp để đặt keyframe"
          >
            {onDragClip && (
              <button
                type="button"
                className="clip-trim-handle trim-left"
                disabled={disabled}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  onDragClip(e, id, 'from');
                }}
                title="Kéo chỉnh đầu clip"
              />
            )}

            <span className="clip-label">{asset.name || id}</span>

            {(() => {
              if (!layer.keys) return null;
              const frameMap = new Map<number, { fields: string[]; easing?: string }>();
              for (const [field, keyframes] of Object.entries(layer.keys) as [string, any][]) {
                for (const kf of keyframes) {
                  if (kf.frame < assetFrom || kf.frame >= assetTo) continue;
                  if (!frameMap.has(kf.frame)) {
                    frameMap.set(kf.frame, { fields: [field], easing: kf.easing });
                  } else {
                    frameMap.get(kf.frame)!.fields.push(field);
                  }
                }
              }

              return Array.from(frameMap.entries()).map(([kfFrame, info]) => {
                const kfLeft = ((kfFrame - assetFrom) / (assetTo - assetFrom)) * 100;
                const isChosen = isSelected && chosenKey && chosenKey.frame === kfFrame;
                const isAtPlayhead = currentFrame === kfFrame;
                const primaryField =
                  info.fields.includes('x') || info.fields.includes('y')
                    ? 'position'
                    : info.fields[0];
                const fieldsLabel =
                  info.fields.includes('x') && info.fields.includes('y')
                    ? 'Vị trí (X, Y)'
                    : info.fields.join(', ');

                return (
                  <button
                    key={`kf-${kfFrame}`}
                    onPointerDown={(e) => e.stopPropagation()}
                    onDoubleClick={(e) => e.stopPropagation()}
                    type="button"
                    className={`clip-keyframe-marker-btn ${isChosen ? 'is-chosen' : ''} ${
                      isAtPlayhead ? 'at-playhead' : ''
                    }`}
                    style={{ left: `${Math.max(0, Math.min(100, kfLeft))}%` }}
                    title={`Keyframe ${fieldsLabel} @ frame ${kfFrame}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSeek(kfFrame);
                      onSelectLayer(id);
                      onSelectKeyframe?.(primaryField, kfFrame);
                    }}
                  >
                    {isChosen || isAtPlayhead ? '◆' : '◇'}
                  </button>
                );
              });
            })()}

            {onDragClip && (
              <button
                type="button"
                className="clip-trim-handle trim-right"
                disabled={disabled}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  onDragClip(e, id, 'to');
                }}
                title="Kéo chỉnh cuối clip"
              />
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderKeyframeRows = () =>
    selectedLayer && (
      <section className="keyframe-workbench" aria-label="Keyframe đối tượng đang chọn">
        {(['position', 'scale', 'rotation'] as const).map((field) => {
          const keys = trackKeys(selectedLayer, field);
          const previous = [...keys].reverse().find((k: any) => k.frame < currentFrame);
          const next = keys.find((k: any) => k.frame > currentFrame);
          const choose = (f: number) => {
            onSeek(f);
            onSelectKeyframe?.(field, f);
          };
          return (
            <div className="keyframe-property-row" key={field}>
              <span className="keyframe-property-name">
                {field === 'position' ? 'Vị trí X/Y' : field === 'scale' ? 'Tỉ lệ' : 'Xoay'}
                <button
                  type="button"
                  aria-label={`Thêm/xóa mốc ${field}`}
                  aria-pressed={keys.some((k: any) => k.frame === currentFrame)}
                  disabled={disabled || !onToggleTrackKeyframe}
                  title={`Thêm/xóa mốc tại frame ${currentFrame}`}
                  onClick={() => onToggleTrackKeyframe?.(field)}
                >
                  {keys.some((k: any) => k.frame === currentFrame) ? '◆' : '◇'}
                </button>
              </span>
              <button aria-label={`Mốc trước ${field}`} disabled={!previous} onClick={() => choose(previous.frame)}>
                ‹
              </button>
              <button aria-label={`Mốc sau ${field}`} disabled={!next} onClick={() => choose(next.frame)}>
                ›
              </button>
              <div className="keyframe-property-lane">
                <i style={{ left: `${playheadPercent}%` }} />
                {keys
                  .filter((k: any) => k.frame >= timeFrom && k.frame < timeTo)
                  .map((k: any) => (
                    <button
                      key={k.frame}
                      className={
                        chosenKey?.field === field && chosenKey.frame === k.frame ? 'selected' : ''
                      }
                      style={{ left: `${((k.frame - timeFrom) / rangeDuration) * 100}%` }}
                      aria-label={`${field} frame ${k.frame}`}
                      title={`Frame ${k.frame} · ${k.easing} · Kéo để đổi thời điểm`}
                      onClick={() => {
                        if (keyDragMoved.current) {
                          keyDragMoved.current = false;
                          return;
                        }
                        choose(k.frame);
                      }}
                      onPointerDown={(e) => {
                        if (disabled || !onMoveKeyframe) return;
                        e.preventDefault();
                        e.stopPropagation();
                        keyDragMoved.current = false;
                        choose(k.frame);
                        const node = e.currentTarget;
                        const lane = node.parentElement!.getBoundingClientRect();
                        const start = e.clientX;
                        let destination = k.frame;
                        node.setPointerCapture(e.pointerId);
                        const move = (event: PointerEvent) => {
                          destination = Math.max(
                            selectedLayer.asset?.from ?? 0,
                            Math.min(
                              (selectedLayer.asset?.to ?? totalFrames) - 1,
                              k.frame + Math.round(((event.clientX - start) / lane.width) * rangeDuration)
                            )
                          );
                          node.style.left = `${((destination - timeFrom) / rangeDuration) * 100}%`;
                          node.textContent = String(destination);
                        };
                        const clean = () => {
                          node.removeEventListener('pointermove', move);
                          node.removeEventListener('pointerup', end);
                          node.removeEventListener('pointercancel', cancel);
                          node.style.left = `${((k.frame - timeFrom) / rangeDuration) * 100}%`;
                          node.textContent = '◆';
                        };
                        const end = () => {
                          clean();
                          keyDragMoved.current = destination !== k.frame;
                          if (destination !== k.frame) onMoveKeyframe(field, k.frame, destination);
                        };
                        const cancel = () => clean();
                        node.addEventListener('pointermove', move);
                        node.addEventListener('pointerup', end);
                        node.addEventListener('pointercancel', cancel);
                      }}
                    >
                      ◆
                    </button>
                  ))}
                {!keys.length && <small>Chưa có mốc</small>}
              </div>
            </div>
          );
        })}
      </section>
    );

  const showInlineKeyframes = proMode || Boolean(chosenKey);

  const renderTree = (entries: Array<[string, any]>, kind: 'char' | 'bg' | 'prop') => {
    const visit = (entry: [string, any]): React.ReactNode => {
      const [id] = entry;
      return (
        <React.Fragment key={id}>
          {renderClipTrack(entry, kind)}
          {showInlineKeyframes && id === selectedLayerId && renderKeyframeRows()}
          {!collapsedNodes[id] &&
            assetEntries.filter(([, child]) => child.parentId === id).map((child) => visit(child))}
        </React.Fragment>
      );
    };
    return entries.filter(([, layer]) => !layer.parentId).map(visit);
  };

  return (
    <div
      className="studio-timeline-container"
      style={{ '--timeline-scrollbar': `${scrollbarWidth}px` } as React.CSSProperties}
      aria-label="Dòng thời gian Studio đa tầng"
    >
      {/* 1. TIMELINE TOOLBAR */}
      <div className="studio-timeline-toolbar">
        <div className="timeline-toolbar-left">
          <strong className="timeline-title">TIMELINE</strong>
          <span className="timeline-range-badge">
            {zoomShot
              ? `Shot ${shotLabel || ''} · ${(rangeDuration / 30).toFixed(1)}s`
              : `Toàn cảnh · ${(totalFrames / 30).toFixed(1)}s`}
          </span>
        </div>

        <div className="timeline-toolbar-right">
          {onToggleKeyframe && (proMode || hasKeyAtPlayhead) && (
            <button
              type="button"
              className={`studio-tool-btn key-tool-btn ${hasKeyAtPlayhead ? 'is-keyed' : ''}`}
              disabled={disabled || !selectedLayerId}
              onClick={() => onToggleKeyframe(currentFrame)}
              title="Thêm/xóa keyframe vị trí tại Playhead (K)"
            >
              <IconDiamond size={12} />
              <span>{hasKeyAtPlayhead ? 'Xóa Key' : 'Key'}</span>
              <kbd className="kbd-badge">K</kbd>
            </button>
          )}

          {onSplitAtPlayhead && (
            <button
              type="button"
              className="studio-tool-btn split-tool-btn"
              disabled={disabled || !selectedLayerId}
              onClick={onSplitAtPlayhead}
              title="Cắt clip tại con trỏ phát (S)"
            >
              <IconScissors size={12} />
              <span>Cắt</span>
              <kbd className="kbd-badge">S</kbd>
            </button>
          )}

          <button
            type="button"
            className="studio-tool-btn"
            onClick={toggleCollapseAll}
            title={allCollapsed ? 'Mở tất cả nhóm' : 'Thu gọn tất cả nhóm'}
          >
            {allCollapsed ? 'Mở nhóm' : 'Thu nhóm'}
          </button>

          {onToggleZoom && (
            <button
              type="button"
              className={`studio-tool-btn ${zoomShot ? 'active' : ''}`}
              onClick={onToggleZoom}
              title={zoomShot ? 'Xem toàn bộ cảnh' : 'Phóng to phân đoạn hiện tại'}
            >
              {zoomShot ? <IconMinimize size={12} /> : <IconMaximize size={12} />}
              <span>{zoomShot ? 'Toàn cảnh' : 'Zoom shot'}</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. TIME RULER */}
      <div
        ref={rulerRef}
        className="studio-time-ruler"
        onPointerDown={handleRulerPointer}
        title="Nhấp hoặc kéo để tua nhanh"
      >
        {ticks.map((t, idx) => (
          <div key={idx} className="ruler-tick" style={{ left: `${t.percent}%` }}>
            <span className="tick-label">{t.sec}s</span>
            <div className="tick-line" />
          </div>
        ))}

        <div className="timeline-playhead-head" style={{ left: `${playheadPercent}%` }}>
          <div className="playhead-diamond" />
        </div>
      </div>

      {/* 3. TRACKS SCROLL CONTAINER */}
      <div ref={tracksRef} className="studio-tracks-scroll">
        {cues.length > 0 && (
          <div className="timeline-group-section">
            <div
              className={`studio-group-header group-cues ${
                collapsedGroups.cues ? 'collapsed' : 'expanded'
              }`}
              onClick={(e) => {
                e.stopPropagation();
                toggleGroup('cues');
              }}
            >
              <div className="group-header-left">
                <span className="group-toggle-arrow">{collapsedGroups.cues ? '▸' : '▾'}</span>
                <span className="group-icon">
                  <IconMessage size={12} />
                </span>
                <strong className="group-title">Thoại &amp; Lời kể</strong>
                <span className="group-count">({cues.length})</span>
              </div>
              <div className="group-header-right">
                {collapsedGroups.cues && (
                  <span className="group-collapsed-summary">
                    {cues[0]?.text ? `"${cues[0].text.slice(0, 32)}…"` : 'Đã thu gọn'}
                  </span>
                )}
              </div>
            </div>

            {!collapsedGroups.cues && (
              <div className="studio-track studio-track-cues" aria-label="Rãnh lời kể và thoại">
                <div className="track-header">
                  <span className="track-icon">
                    <IconMessage size={12} />
                  </span>
                  <span className="track-label">Thoại &amp; Lời kể</span>
                </div>
                <div className="track-lane">
                  {cues.map((cue) => {
                    const cueFrom = Math.max(timeFrom, cue.from);
                    const cueTo = Math.min(timeTo, cue.to);
                    if (cueTo <= timeFrom || cueFrom >= timeTo) return null;

                    const left = ((cueFrom - timeFrom) / rangeDuration) * 100;
                    const width = Math.max(1.5, ((cueTo - cueFrom) / rangeDuration) * 100);
                    const isActive = cue.id === activeCueId;
                    const isPlayingCue = currentFrame >= cue.from && currentFrame < cue.to;

                    return (
                      <button
                        key={cue.id}
                        type="button"
                        className={`studio-cue-block ${isActive ? 'active' : ''} ${
                          isPlayingCue ? 'playing' : ''
                        }`}
                        style={{ left: `${left}%`, width: `${width}%` }}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectCue(cue);
                        }}
                        title={`#${cue.index} (${(cue.from / 30).toFixed(1)}s - ${(
                          cue.to / 30
                        ).toFixed(1)}s): ${cue.text}`}
                      >
                        <span className="cue-num">#{cue.index}</span>
                        <span className="cue-snippet">{cue.text}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {charEntries.length > 0 && (
          <div className="timeline-group-section">
            <div
              className={`studio-group-header group-characters ${
                collapsedGroups.characters ? 'collapsed' : 'expanded'
              }`}
              onClick={(e) => {
                e.stopPropagation();
                toggleGroup('characters');
              }}
            >
              <div className="group-header-left">
                <span className="group-toggle-arrow">
                  {collapsedGroups.characters ? '▸' : '▾'}
                </span>
                <span className="group-icon">
                  <IconUser size={12} />
                </span>
                <strong className="group-title">Nhân vật</strong>
                <span className="group-count">({charEntries.length})</span>
              </div>
              <div className="group-header-right">
                {collapsedGroups.characters && (
                  <span className="group-collapsed-summary">
                    {charEntries
                      .map(([_, l]) => (l.asset?.name || '').split(' · ')[0])
                      .filter(Boolean)
                      .slice(0, 3)
                      .join(', ')}
                  </span>
                )}
              </div>
            </div>

            {!collapsedGroups.characters && renderTree(charEntries, 'char')}
          </div>
        )}

        {bgEntries.length > 0 && (
          <div className="timeline-group-section">
            <div
              className={`studio-group-header group-backgrounds ${
                collapsedGroups.backgrounds ? 'collapsed' : 'expanded'
              }`}
              onClick={(e) => {
                e.stopPropagation();
                toggleGroup('backgrounds');
              }}
            >
              <div className="group-header-left">
                <span className="group-toggle-arrow">
                  {collapsedGroups.backgrounds ? '▸' : '▾'}
                </span>
                <span className="group-icon">
                  <IconImage size={12} />
                </span>
                <strong className="group-title">Phông nền</strong>
                <span className="group-count">({bgEntries.length})</span>
              </div>
              <div className="group-header-right">
                {collapsedGroups.backgrounds && (
                  <span className="group-collapsed-summary">
                    {bgEntries
                      .map(([_, l]) => (l.asset?.name || '').split(' · ')[0])
                      .filter(Boolean)
                      .slice(0, 3)
                      .join(', ')}
                  </span>
                )}
              </div>
            </div>

            {!collapsedGroups.backgrounds && renderTree(bgEntries, 'bg')}
          </div>
        )}

        {propEntries.length > 0 && (
          <div className="timeline-group-section">
            <div
              className={`studio-group-header group-props ${
                collapsedGroups.props ? 'collapsed' : 'expanded'
              }`}
              onClick={(e) => {
                e.stopPropagation();
                toggleGroup('props');
              }}
            >
              <div className="group-header-left">
                <span className="group-toggle-arrow">{collapsedGroups.props ? '▸' : '▾'}</span>
                <span className="group-icon">
                  <IconSparkles size={12} />
                </span>
                <strong className="group-title">Đạo cụ &amp; Hiệu ứng</strong>
                <span className="group-count">({propEntries.length})</span>
              </div>
              <div className="group-header-right">
                {collapsedGroups.props && (
                  <span className="group-collapsed-summary">
                    {propEntries
                      .map(([_, l]) => (l.asset?.name || '').split(' · ')[0])
                      .filter(Boolean)
                      .slice(0, 3)
                      .join(', ')}
                  </span>
                )}
              </div>
            </div>

            {!collapsedGroups.props && renderTree(propEntries, 'prop')}
          </div>
        )}

        <div
          className="timeline-playhead-line"
          style={{
            left: `calc(var(--timeline-label-width) + (100% - var(--timeline-label-width)) * ${
              playheadPercent / 100
            })`,
          }}
        />
      </div>
    </div>
  );
}
