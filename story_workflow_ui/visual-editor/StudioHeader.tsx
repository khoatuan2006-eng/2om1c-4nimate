import React, { useEffect, useRef, useState } from 'react';
import { AuthControls } from './AuthControls';
import {
  IconArchive,
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconClapper,
  IconDownload,
  IconFilm,
  IconHistory,
  IconKeyboard,
  IconMore,
  IconPlus,
  IconRedo,
  IconSave,
  IconSliders,
  IconUndo,
} from './StudioIcons';

export interface StudioHeaderProps {
  project: any;
  currentScene: string;
  scenes: Array<{ id: string; title: string }>;
  onSelectScene: (sceneId: string) => void;
  onOpenProjects: () => void;
  onAddScene: () => void;
  onBuildEpisode: () => void;
  timelineMode: 'scene' | 'film';
  onChangeTimelineMode: (mode: 'scene' | 'film') => void;
  storyboardOpen: boolean;
  onOpenStoryboard: () => void;
  libraryOpen: boolean;
  onToggleLibrary: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  saving: boolean;
  dirty: boolean;
  onSave: () => void;
  onExport: () => void;
  proMode: boolean;
  onToggleProMode: () => void;
  onOpenHistory: () => void;
  onOpenBackup: () => void;
  onOpenShortcuts: () => void;
  disabled?: boolean;
  exportDisabled?: boolean;
  statusText?: string;
}

export function StudioHeader({
  project,
  currentScene,
  scenes,
  onSelectScene,
  onOpenProjects,
  onAddScene,
  onBuildEpisode,
  timelineMode,
  onChangeTimelineMode,
  onOpenStoryboard,
  undo,
  redo,
  canUndo,
  canRedo,
  saving,
  dirty,
  onSave,
  onExport,
  proMode,
  onToggleProMode,
  onOpenHistory,
  onOpenBackup,
  onOpenShortcuts,
  disabled,
  exportDisabled,
  statusText,
}: StudioHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      if (menuWrapRef.current && !menuWrapRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen]);

  const currentIdx = scenes.findIndex((s) => s.id === currentScene);
  const prevScene = currentIdx > 0 ? scenes[currentIdx - 1] : null;
  const nextScene = currentIdx >= 0 && currentIdx < scenes.length - 1 ? scenes[currentIdx + 1] : null;

  return (
    <header className="studio-header" aria-label="Thanh công cụ Studio">
      {/* CLUSTER 1: PROJECT & SCENE NAVIGATOR */}
      <div className="header-cluster-left">
        <button
          type="button"
          className="studio-brand-btn"
          onClick={onOpenProjects}
          disabled={disabled}
          title="Mở hoặc đổi dự án"
        >
          <span className="brand-badge">DOYIN</span>
          <strong className="brand-name">{project?.title || 'Chọn dự án'}</strong>
          <IconChevronDown size={13} className="brand-caret" />
        </button>

        <div className="studio-scene-nav" role="group" aria-label="Điều hướng phân cảnh">
          <button
            type="button"
            className="scene-step-btn"
            disabled={disabled || !prevScene}
            onClick={() => prevScene && onSelectScene(prevScene.id)}
            title={prevScene ? `Cảnh trước: ${prevScene.title}` : 'Đây là cảnh đầu tiên'}
            aria-label="Cảnh trước"
          >
            <IconChevronLeft size={14} />
          </button>

          <div className="studio-scene-pill">
            <select
              aria-label="Chọn Scene"
              value={currentScene}
              disabled={disabled || scenes.length === 0}
              onChange={(e) => onSelectScene(e.target.value)}
            >
              {scenes.length === 0 && <option value={currentScene}>Chưa có cảnh</option>}
              {scenes.map((s, idx) => (
                <option key={s.id} value={s.id}>
                  {String(idx + 1).padStart(2, '0')} · {s.title}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            className="scene-step-btn"
            disabled={disabled || !nextScene}
            onClick={() => nextScene && onSelectScene(nextScene.id)}
            title={nextScene ? `Cảnh sau: ${nextScene.title}` : 'Đây là cảnh cuối cùng'}
            aria-label="Cảnh sau"
          >
            <IconChevronRight size={14} />
          </button>
        </div>

        <button
          type="button"
          className="studio-icon-btn studio-add-scene-btn"
          disabled={disabled || !project}
          onClick={onAddScene}
          title="Tạo phân đoạn mới"
          aria-label="Thêm cảnh mới"
        >
          <IconPlus size={14} />
        </button>
      </div>

      {/* CLUSTER 2: FOCUSED 2-MODE SWITCHER */}
      <div className="header-cluster-center">
        <div className="studio-mode-switcher" role="tablist" aria-label="Chế độ xem">
          <button
            type="button"
            role="tab"
            aria-selected={timelineMode === 'scene'}
            className={timelineMode === 'scene' ? 'active' : ''}
            onClick={() => {
              if (timelineMode !== 'scene') onChangeTimelineMode('scene');
            }}
          >
            <IconClapper size={13} />
            <span>Dựng cảnh</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={timelineMode === 'film'}
            className={timelineMode === 'film' ? 'active' : ''}
            disabled={disabled || !project?.duration}
            onClick={() => onChangeTimelineMode('film')}
          >
            <IconFilm size={13} />
            <span>Toàn tập</span>
          </button>
        </div>
      </div>

      {/* CLUSTER 3: SAVE, HISTORY, MODE, MENU & EXPORT */}
      <div className="header-cluster-right">
        <AuthControls />

        <button
          type="button"
          className={`studio-status-indicator ${saving ? 'saving' : dirty ? 'dirty' : 'saved'}`}
          title={statusText || (dirty ? 'Nhấn để lưu thay đổi (Ctrl+S)' : 'Tất cả thay đổi đã được lưu')}
          disabled={disabled || saving || !dirty}
          onClick={onSave}
        >
          <span className="status-dot" />
          <span className="status-label">
            {saving ? 'Đang lưu…' : dirty ? 'Lưu ngay' : 'Đã lưu'}
          </span>
          {dirty && !saving && <IconSave size={12} />}
        </button>

        <div className="header-actions-group">
          <div className="studio-btn-pair">
            <button
              type="button"
              className="studio-icon-btn"
              title="Hoàn tác (Ctrl+Z)"
              aria-label="Hoàn tác"
              onClick={undo}
              disabled={disabled || !canUndo}
            >
              <IconUndo size={14} />
            </button>
            <button
              type="button"
              className="studio-icon-btn"
              title="Làm lại (Ctrl+Y)"
              aria-label="Làm lại"
              onClick={redo}
              disabled={disabled || !canRedo}
            >
              <IconRedo size={14} />
            </button>
          </div>

          <button
            type="button"
            className={`studio-mode-pill ${proMode ? 'pro-active' : ''}`}
            onClick={onToggleProMode}
            title={
              proMode
                ? 'Đang ở Chế độ Kỹ thuật (hiện đầy đủ Keyframe, Socket, Parallax). Nhấn để về Đạo diễn gọn.'
                : 'Đang ở Chế độ Đạo diễn tối giản. Nhấn để mở công cụ Kỹ thuật (Keyframe, Socket, Parallax).'
            }
          >
            <IconSliders size={13} />
            <span>{proMode ? 'Kỹ thuật' : 'Đạo diễn'}</span>
          </button>

          <div className="studio-overflow-wrap" ref={menuWrapRef}>
            <button
              type="button"
              className={`studio-icon-btn ${menuOpen ? 'active' : ''}`}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-label="Công cụ khác"
              title="Kịch bản, Dựng tập, Lịch sử, Sao lưu, Phím tắt"
              onClick={() => setMenuOpen((o) => !o)}
            >
              <IconMore size={15} />
            </button>

            {menuOpen && (
              <div className="studio-overflow-menu" role="menu" aria-label="Công cụ mở rộng">
                <button
                  type="button"
                  role="menuitem"
                  disabled={disabled || !project}
                  onClick={() => {
                    setMenuOpen(false);
                    onOpenStoryboard();
                  }}
                >
                  <IconClapper size={14} />
                  <span>Bảng kịch bản (Storyboard)</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  disabled={!project}
                  onClick={() => {
                    setMenuOpen(false);
                    onBuildEpisode();
                  }}
                >
                  <IconFilm size={14} />
                  <span>Trình dựng tập (Episode Builder)</span>
                </button>
                <div className="menu-divider" />
                <button
                  type="button"
                  role="menuitem"
                  disabled={!project}
                  onClick={() => {
                    setMenuOpen(false);
                    onOpenHistory();
                  }}
                >
                  <IconHistory size={14} />
                  <span>Lịch sử phiên bản</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    onOpenBackup();
                  }}
                >
                  <IconArchive size={14} />
                  <span>Sao lưu dữ liệu</span>
                </button>
                <div className="menu-divider" />
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    onOpenShortcuts();
                  }}
                >
                  <IconKeyboard size={14} />
                  <span>Phím tắt Studio</span>
                  <kbd>?</kbd>
                </button>
              </div>
            )}
          </div>

          <button
            type="button"
            className="studio-btn studio-btn-export"
            disabled={(exportDisabled ?? disabled) || !project?.duration}
            onClick={onExport}
            title="Xuất video thành phẩm MP4"
          >
            <IconDownload size={14} />
            <span>Xuất MP4</span>
          </button>
        </div>
      </div>
    </header>
  );
}
