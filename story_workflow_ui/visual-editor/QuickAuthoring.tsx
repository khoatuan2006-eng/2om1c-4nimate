import React, { useState } from 'react';
import { hierarchy, layoutLocked } from './scene-graph.mjs';
import { CharacterPoseFacePicker } from './CharacterPoseFacePicker';
import {
  IconArrowDown,
  IconArrowUp,
  IconCheck,
  IconChevronRight,
  IconClapper,
  IconCopy,
  IconEye,
  IconFlipH,
  IconFocus,
  IconFolder,
  IconLayers,
  IconLock,
  IconMessage,
  IconPlus,
  IconRefresh,
  IconReplace,
  IconSliders,
  IconTarget,
  IconTrash,
} from './StudioIcons';

export interface QuickAuthoringCue {
  id: string;
  index: number;
  from: number;
  to: number;
  text: string;
  durationSec: number;
}

export interface QuickAuthoringProps {
  selected: string;
  layer: any;
  infoLabel?: string;
  disabled?: boolean;
  canPaste?: boolean;
  proMode?: boolean;
  onAdd?: () => void;
  onReplace?: () => void;
  onSelectPose: (character: any, pose: any, face: any) => void;
  onSelectFace: (character: any, pose: any, face: any) => void;
  motionTargeting?: boolean;
  motionDuration?: number;
  onStartMotionTargeting?: (seconds: number) => void;
  onCancelMotionTargeting?: () => void;
  onCopy?: () => void;
  onPaste?: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
  onFlip?: (axis: 'flipX' | 'flipY') => void;
  onStepZ?: (direction: number) => void;
  values?: any;
  onContinueToNewScene?: () => void;
  nextScene?: { id: string; title: string };
  onOpenNextScene?: () => void;
  transformControls?: React.ReactNode;
  document?: any;
  frame?: number;
  onAttachParent?: (parentId: string) => void;
  onDetachParent?: () => void;
  onToggleLayoutLock?: (locked: boolean) => void;
  currentFraming?: 'full' | 'bust' | 'portrait' | null;
  onApplyFraming?: (preset: 'full' | 'bust' | 'portrait') => void;
  isFocused?: boolean;
  hasAnyDimmed?: boolean;
  onFocusLayer?: () => void;
  onClearFocus?: () => void;
  cues?: QuickAuthoringCue[];
  activeCueId?: string | null;
  onSelectCue?: (cue: QuickAuthoringCue) => void;
  sceneTitle?: string;
  sceneDuration?: number;
  layerStats?: { total: number; characters: number; backgrounds: number; props: number };
  sceneReadOnly?: boolean;
  onResetLayer?: () => void;
  advancedDrawer?: React.ReactNode;
}

function formatSec(frames: number): string {
  const sec = Math.max(0, frames) / 30;
  return sec >= 60
    ? `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`
    : `${sec.toFixed(1)}s`;
}

export function QuickAuthoring({
  selected,
  layer,
  infoLabel,
  disabled,
  canPaste,
  proMode = false,
  onAdd,
  onReplace,
  onSelectPose,
  onSelectFace,
  motionTargeting,
  motionDuration,
  onStartMotionTargeting,
  onCancelMotionTargeting,
  onCopy,
  onPaste,
  onDuplicate,
  onDelete,
  onFlip,
  onStepZ,
  values,
  onContinueToNewScene,
  nextScene,
  onOpenNextScene,
  transformControls,
  document: doc,
  frame = 0,
  onAttachParent,
  onDetachParent,
  onToggleLayoutLock,
  currentFraming,
  onApplyFraming,
  isFocused,
  hasAnyDimmed,
  onFocusLayer,
  onClearFocus,
  cues = [],
  activeCueId,
  onSelectCue,
  sceneTitle,
  sceneDuration = 0,
  layerStats,
  sceneReadOnly = false,
  onResetLayer,
  advancedDrawer,
}: QuickAuthoringProps) {
  const [targetSeconds, setTargetSeconds] = useState(motionDuration || 1.0);
  const [chosenParentId, setChosenParentId] = useState('');
  const [parentError, setParentError] = useState('');

  const assetType = layer?.asset?.type as string | undefined;
  const assetName = layer?.asset?.name || infoLabel || '';
  const isCharacter =
    assetType === 'characters' ||
    (!assetType && /\b(char|actor)\b|nhân vật/i.test(assetName));

  const parentLayer = layer?.parentId && doc?.layers ? doc.layers[layer.parentId] : null;
  const isLayoutLockedByAncestor =
    selected && doc?.layers ? layoutLocked(doc.layers, selected) : false;
  const childEntries =
    selected && doc?.layers
      ? Object.entries(doc.layers).filter(
          ([, l]: any) => l?.parentId === selected && l?.asset
        )
      : [];
  const candidateParents = doc?.layers
    ? Object.entries(doc.layers).filter(([k, l]: any) => {
        if (!l?.asset || k === selected) return false;
        try {
          return !hierarchy(doc.layers, k).includes(selected);
        } catch {
          return false;
        }
      })
    : [];

  /* ── NO LAYER SELECTED: PRO SCENE OVERVIEW + INTERACTIVE DIALOGUE LIST ── */
  if (!selected) {
    return (
      <section className="studio-inspector-overview" aria-label="Tổng quan cảnh">
        <div className="scene-overview-card">
          <div className="overview-top-row">
            <span className="overview-badge">
              <IconClapper size={12} /> CẢNH HIỆN TẠI
            </span>
            {sceneReadOnly && (
              <span className="overview-lock-pill">
                <IconLock size={11} /> Đã duyệt
              </span>
            )}
          </div>
          <strong className="overview-scene-title">{sceneTitle || 'Chưa chọn cảnh'}</strong>
          <div className="overview-meta-row">
            <span>{formatSec(sceneDuration)}</span>
            <span>·</span>
            <span>{sceneDuration} frame</span>
          </div>

          {layerStats && (
            <div className="overview-stats-row">
              <span className="stat-chip">{layerStats.characters} nhân vật</span>
              <span className="stat-chip">{layerStats.backgrounds} nền</span>
              <span className="stat-chip">{layerStats.props} đạo cụ</span>
            </div>
          )}
        </div>

        <div className="scene-cues-card">
          <div className="scene-cues-head">
            <span>
              <IconMessage size={13} /> Lời thoại trong cảnh
            </span>
            <small>{cues.length} câu</small>
          </div>

          {cues.length > 0 ? (
            <div className="scene-cues-list" role="list">
              {cues.map((cue) => {
                const isLive = frame >= cue.from && frame < cue.to;
                const isChosen = cue.id === activeCueId;
                return (
                  <button
                    key={cue.id}
                    type="button"
                    role="listitem"
                    className={`scene-cue-item ${isLive ? 'is-live' : ''} ${
                      isChosen ? 'is-chosen' : ''
                    }`}
                    onClick={() => onSelectCue?.(cue)}
                    title={`Nhảy tới ${formatSec(cue.from)} (frame ${cue.from})`}
                  >
                    <div className="cue-item-top">
                      <span className="cue-item-num">#{cue.index}</span>
                      <span className="cue-item-time">{formatSec(cue.from)}</span>
                    </div>
                    <p className="cue-item-text">{cue.text}</p>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="inspector-muted-note">
              Cảnh này chưa có lời thoại được tách cue. Chọn đối tượng trên màn hình để chỉnh sửa.
            </p>
          )}
        </div>

        <div className="overview-footer-actions">
          {onAdd && (
            <button
              type="button"
              className="studio-btn studio-btn-primary"
              disabled={disabled}
              onClick={onAdd}
            >
              <IconFolder size={14} />
              <span>Mở kho tài nguyên</span>
            </button>
          )}

          {canPaste && onPaste && (
            <button
              type="button"
              className="studio-btn studio-btn-secondary"
              disabled={disabled}
              onClick={onPaste}
            >
              <IconCopy size={14} />
              <span>Dán bố cục từ cảnh trước</span>
            </button>
          )}

          {nextScene && onOpenNextScene && (
            <button
              type="button"
              className="studio-btn studio-btn-next"
              disabled={disabled}
              onClick={onOpenNextScene}
            >
              <span>Cảnh tiếp: {nextScene.title}</span>
              <IconChevronRight size={14} />
            </button>
          )}
        </div>
      </section>
    );
  }

  /* ── LAYER SELECTED: UNIFIED VERTICAL DIRECTOR INSPECTOR ── */
  const showFraming = Boolean(isCharacter && onApplyFraming);
  const showFocus = Boolean(
    assetType && assetType !== 'backgrounds' && onFocusLayer
  );
  const typeLabel =
    assetType === 'characters'
      ? 'Nhân vật'
      : assetType === 'backgrounds'
      ? 'Bối cảnh'
      : 'Đối tượng';

  return (
    <div className="studio-inspector-content" aria-label="Bảng chỉnh sửa đối tượng">
      {/* 1. SELECTED OBJECT META + 1-ROW QUICK ACTION STRIP */}
      <section className="selected-object-card">
        <div className="selected-meta-strip">
          <span className={`object-type-pill type-${assetType || 'props'}`}>{typeLabel}</span>
          {layer?.asset && (
            <span className="object-time-pill">
              {formatSec(layer.asset.from)} – {formatSec(layer.asset.to)}
            </span>
          )}
        </div>

        <div className="quick-action-strip" role="toolbar" aria-label="Thao tác nhanh">
          {onFlip && (
            <button
              type="button"
              className={`strip-btn ${values?.flipX ? 'active' : ''}`}
              disabled={disabled}
              onClick={() => onFlip('flipX')}
              title="Lật ngang (H)"
            >
              <IconFlipH size={13} />
              <span>Lật</span>
            </button>
          )}

          {onStepZ && (
            <>
              <button
                type="button"
                className="strip-btn"
                disabled={disabled}
                onClick={() => onStepZ(1)}
                title="Đưa lên trên 1 lớp"
              >
                <IconArrowUp size={13} />
                <span>Lên</span>
              </button>
              <button
                type="button"
                className="strip-btn"
                disabled={disabled}
                onClick={() => onStepZ(-1)}
                title="Đưa xuống dưới 1 lớp"
              >
                <IconArrowDown size={13} />
                <span>Xuống</span>
              </button>
            </>
          )}

          {onReplace && (
            <button
              type="button"
              className="strip-btn"
              disabled={disabled}
              onClick={onReplace}
              title="Thay từ Kho (giữ thời gian & keyframe)"
            >
              <IconReplace size={13} />
              <span>Đổi</span>
            </button>
          )}

          {onDuplicate && (
            <button
              type="button"
              className="strip-btn"
              disabled={disabled}
              onClick={onDuplicate}
              title="Nhân bản đối tượng"
            >
              <IconCopy size={13} />
              <span>Nhân</span>
            </button>
          )}

          {onDelete && (
            <button
              type="button"
              className="strip-btn danger"
              disabled={disabled}
              onClick={onDelete}
              title="Xóa khỏi cảnh (Del)"
            >
              <IconTrash size={13} />
              <span>Xóa</span>
            </button>
          )}
        </div>
      </section>

      {/* 2. FRAMING & SELECTIVE FOCUS CARD */}
      {(showFraming || showFocus) && (
        <section className="studio-framing-card" aria-label="Cỡ khung và tiêu điểm">
          {showFraming && (
            <div className="framing-group">
              <div className="framing-label-row">
                <span className="framing-label">Cỡ khung hình</span>
                <span className="framing-shortcut-hint">Phím 1 · 2 · 3</span>
              </div>
              <div className="framing-segmented" role="group" aria-label="Chọn cỡ khung">
                {([
                  ['full', 'Toàn thân'],
                  ['bust', 'Nửa thân'],
                  ['portrait', 'Chân dung'],
                ] as const).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    className={`framing-seg-btn ${currentFraming === key ? 'active' : ''}`}
                    disabled={disabled}
                    onClick={() => onApplyFraming?.(key)}
                    title={`Đổi nhanh sang cỡ ${label}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {showFocus && (
            <div className="framing-group">
              <div className="focus-chip-row">
                <button
                  type="button"
                  className={`framing-chip ${isFocused ? 'active' : ''}`}
                  disabled={disabled}
                  onClick={() => onFocusLayer?.()}
                  title="Giữ rõ nhân vật này và làm mờ các đối tượng khác (F)"
                >
                  <IconFocus size={13} />
                  <span>Focus nhân vật này</span>
                </button>
                {hasAnyDimmed && onClearFocus && (
                  <button
                    type="button"
                    className="framing-chip"
                    disabled={disabled}
                    onClick={() => onClearFocus()}
                    title="Bỏ làm mờ và hiện rõ lại tất cả"
                  >
                    <IconEye size={13} />
                    <span>Hiện rõ tất cả</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </section>
      )}

      {/* 3. POSE & FACE PICKER (IMMEDIATELY ACCESSIBLE FOR CHARACTERS) */}
      {isCharacter && (
        <CharacterPoseFacePicker
          layer={layer}
          infoLabel={infoLabel}
          disabled={disabled}
          onSelectPose={onSelectPose}
          onSelectFace={onSelectFace}
        />
      )}

      {/* 4. DIRECT DESTINATION MOTION (ACCORDION) */}
      <details
        className="inspector-accordion"
        open={motionTargeting || undefined}
      >
        <summary>
          <IconTarget size={13} />
          <span>Chuyển động nhanh (Kéo đích)</span>
          {motionTargeting && <span className="accordion-pill active">Đang bật</span>}
        </summary>
        <div className="inspector-accordion-body">
          {motionTargeting ? (
            <div className="motion-targeting-active-box">
              <div>
                <strong>Đang kích hoạt kéo đích (+{targetSeconds}s)</strong>
                <p>Kéo đối tượng trên khung xem tới vị trí đích rồi thả chuột.</p>
              </div>
              {onCancelMotionTargeting && (
                <button
                  type="button"
                  className="studio-btn-cancel"
                  onClick={onCancelMotionTargeting}
                >
                  Hủy kéo đích
                </button>
              )}
            </div>
          ) : (
            <div className="motion-targeting-setup">
              <div className="duration-preset-row">
                <span className="preset-label">Thời lượng:</span>
                <div className="preset-chips">
                  {[0.5, 1.0, 1.5, 2.0].map((sec) => (
                    <button
                      key={sec}
                      type="button"
                      className={`duration-chip ${targetSeconds === sec ? 'active' : ''}`}
                      disabled={disabled}
                      onClick={() => setTargetSeconds(sec)}
                    >
                      {sec}s
                    </button>
                  ))}
                </div>
              </div>
              <button
                type="button"
                className="studio-motion-trigger-btn"
                disabled={disabled}
                onClick={() => onStartMotionTargeting && onStartMotionTargeting(targetSeconds)}
              >
                <IconTarget size={13} />
                <span>Bắt đầu kéo đích (+{targetSeconds}s)</span>
              </button>
            </div>
          )}
        </div>
      </details>

      {/* 5. TRANSFORM & PRECISION NUMERIC CONTROLS (ACCORDION) */}
      {transformControls && (
        <details className="inspector-accordion">
          <summary>
            <IconSliders size={13} />
            <span>Vị trí &amp; Thông số chi tiết (X, Y, Z…)</span>
          </summary>
          <div className="inspector-accordion-body">
            {transformControls}
          </div>
        </details>
      )}

      {/* 6. PRO / TECHNICAL CONTROLS (ONLY IN KỸ THUẬT MODE) */}
      {proMode && (
        <div className="inspector-pro-section" aria-label="Công cụ kỹ thuật">
          <div className="pro-section-divider">
            <span>KỸ THUẬT NÂNG CAO</span>
          </div>

          {/* Parent-Child Grouping */}
          <details className="inspector-accordion">
            <summary>
              <IconLayers size={13} />
              <span>Quan hệ Cha - Con &amp; Nhóm</span>
              {layer?.parentId && <span className="accordion-pill">Con</span>}
              {childEntries.length > 0 && (
                <span className="accordion-pill">{childEntries.length} con</span>
              )}
            </summary>
            <div className="inspector-accordion-body">
              {layer?.parentId ? (
                <div className="parent-current-info">
                  <div className="parent-desc">
                    <span>Đang gắn vào:</span>
                    <strong className="parent-highlight-name">
                      {parentLayer?.asset?.name || layer.parentId}
                    </strong>
                  </div>
                  {onDetachParent && (
                    <button
                      type="button"
                      className="studio-btn detach-btn"
                      disabled={disabled || isLayoutLockedByAncestor}
                      onClick={() => {
                        setParentError('');
                        try {
                          onDetachParent();
                        } catch (e: any) {
                          setParentError(e.message);
                        }
                      }}
                    >
                      Tách khỏi cha
                    </button>
                  )}
                </div>
              ) : (
                <div className="parent-attach-section">
                  <div className="parent-attach-row">
                    <select
                      className="studio-select parent-select"
                      disabled={disabled || isLayoutLockedByAncestor || candidateParents.length === 0}
                      value={chosenParentId}
                      onChange={(e) => setChosenParentId(e.target.value)}
                      aria-label="Chọn đối tượng cha để gắn"
                    >
                      <option value="">-- Chọn đối tượng cha --</option>
                      {candidateParents.map(([pId, pLayer]: any) => (
                        <option key={pId} value={pId}>
                          {pLayer.asset?.name || pId}
                        </option>
                      ))}
                    </select>
                    {onAttachParent && (
                      <button
                        type="button"
                        className="studio-btn attach-btn"
                        disabled={disabled || !chosenParentId || isLayoutLockedByAncestor}
                        onClick={() => {
                          if (!chosenParentId) return;
                          setParentError('');
                          try {
                            onAttachParent(chosenParentId);
                            setChosenParentId('');
                          } catch (e: any) {
                            setParentError(e.message);
                          }
                        }}
                      >
                        Gắn
                      </button>
                    )}
                  </div>
                </div>
              )}

              {childEntries.length > 0 && (
                <div className="parent-children-box">
                  <span className="children-title">
                    Đối tượng con ({childEntries.length}):
                  </span>
                  <div className="children-chips">
                    {childEntries.map(([cId, cLayer]: any) => (
                      <span key={cId} className="child-chip" title={cId}>
                        {cLayer.asset?.name || cId}
                      </span>
                    ))}
                  </div>
                  {onToggleLayoutLock && (
                    <label className="lock-children-toggle">
                      <input
                        type="checkbox"
                        checked={!!layer?.layoutLocked}
                        disabled={disabled}
                        onChange={(e) => onToggleLayoutLock(e.target.checked)}
                      />
                      <span>Khóa vị trí các đối tượng con</span>
                    </label>
                  )}
                </div>
              )}

              {isLayoutLockedByAncestor && (
                <p className="parent-lock-warning" role="alert">
                  Cha đang khóa thiết kế. Mở khóa ở đối tượng cha để chỉnh sửa.
                </p>
              )}
              {parentError && (
                <p className="parent-error" role="alert">
                  {parentError}
                </p>
              )}
            </div>
          </details>

          {/* Scene Continuity */}
          <details className="inspector-accordion">
            <summary>
              <IconCheck size={13} />
              <span>Tiếp nối sang cảnh kế tiếp</span>
            </summary>
            <div className="inspector-accordion-body">
              <div className="continuity-actions-vertical">
                {onContinueToNewScene && (
                  <button
                    type="button"
                    className="studio-btn studio-btn-primary"
                    disabled={disabled}
                    onClick={onContinueToNewScene}
                  >
                    <IconPlus size={13} />
                    <span>Tiếp nối sang cảnh mới</span>
                  </button>
                )}
                {onCopy && (
                  <button
                    type="button"
                    className="studio-btn studio-btn-secondary"
                    disabled={disabled}
                    onClick={onCopy}
                  >
                    <IconCopy size={13} />
                    <span>Chụp bố cục frame này</span>
                  </button>
                )}
                {canPaste && onPaste && (
                  <button
                    type="button"
                    className="studio-btn studio-btn-secondary"
                    disabled={disabled}
                    onClick={onPaste}
                  >
                    <span>Dán bố cục đã chụp</span>
                  </button>
                )}
                {nextScene && onOpenNextScene && (
                  <button
                    type="button"
                    className="studio-btn studio-btn-next"
                    disabled={disabled}
                    onClick={onOpenNextScene}
                  >
                    <span>Mở cảnh: {nextScene.title} →</span>
                  </button>
                )}
              </div>
            </div>
          </details>

          {advancedDrawer}

          {onResetLayer && (
            <button
              type="button"
              className="reset"
              disabled={disabled}
              onClick={onResetLayer}
            >
              <IconRefresh size={12} />
              <span>Khôi phục đối tượng về bản gốc</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
