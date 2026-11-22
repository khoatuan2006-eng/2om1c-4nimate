import React from 'react';
import { useModal } from './useModal';
import { IconClose, IconKeyboard } from './StudioIcons';

export interface ShortcutsDialogProps {
  open: boolean;
  onClose: () => void;
}

const SHORTCUT_GROUPS: Array<{
  title: string;
  items: Array<{ keys: string[]; label: string }>;
}> = [
  {
    title: 'Phát & Di chuyển',
    items: [
      { keys: ['Space'], label: 'Phát / Dừng khung xem' },
      { keys: ['←', '→'], label: 'Lùi / Tiến 1 frame' },
      { keys: ['[', ']'], label: 'Nhảy về câu thoại trước / sau' },
      { keys: ['Home', 'End'], label: 'Về đầu / cuối cảnh' },
    ],
  },
  {
    title: 'Đạo diễn nhanh',
    items: [
      { keys: ['1', '2', '3'], label: 'Khung hình: Toàn thân / Nửa thân / Chân dung' },
      { keys: ['F'], label: 'Bật / tắt Focus nhân vật đang chọn' },
      { keys: ['H'], label: 'Lật ngang đối tượng đang chọn' },
      { keys: ['S'], label: 'Cắt clip tại con trỏ phát (Playhead)' },
      { keys: ['Del'], label: 'Xóa đối tượng hoặc keyframe đang chọn' },
    ],
  },
  {
    title: 'Hệ thống',
    items: [
      { keys: ['Ctrl', 'S'], label: 'Lưu chỉnh sửa vào dự án' },
      { keys: ['Ctrl', 'Z'], label: 'Hoàn tác (Undo)' },
      { keys: ['Ctrl', 'Y'], label: 'Làm lại (Redo)' },
      { keys: ['K'], label: 'Thêm / xóa keyframe vị trí tại Playhead' },
      { keys: ['Esc'], label: 'Bỏ chọn / hủy chế độ kéo đích' },
      { keys: ['?'], label: 'Mở hoặc đóng bảng phím tắt' },
    ],
  },
];

export function ShortcutsDialog({ open, onClose }: ShortcutsDialogProps) {
  const modalRef = useModal(open);

  if (!open) return null;

  return (
    <div
      className="create-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Escape' || e.key === '?') onClose();
      }}
    >
      <div
        className="projects-dialog shortcuts-dialog"
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-label="Phím tắt Studio"
      >
        <div className="projects-heading">
          <div className="shortcuts-title-wrap">
            <small>ĐIỀU KHIỂN NHANH</small>
            <h2>
              <IconKeyboard size={18} /> Phím tắt Studio
            </h2>
          </div>
          <button type="button" aria-label="Đóng phím tắt" onClick={onClose}>
            <IconClose size={16} />
          </button>
        </div>

        <div className="shortcuts-grid">
          {SHORTCUT_GROUPS.map((group) => (
            <section className="shortcuts-group" key={group.title}>
              <h3>{group.title}</h3>
              <ul>
                {group.items.map((item) => (
                  <li key={item.label}>
                    <span className="shortcut-desc">{item.label}</span>
                    <span className="shortcut-keys">
                      {item.keys.map((k, idx) => (
                        <React.Fragment key={k}>
                          {idx > 0 && <span className="key-sep">/</span>}
                          <kbd>{k}</kbd>
                        </React.Fragment>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
