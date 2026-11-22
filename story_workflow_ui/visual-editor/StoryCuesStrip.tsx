import React from 'react';

export interface StoryCue {
  id: string;
  index: number;
  from: number;
  to: number;
  text: string;
  durationSec: number;
  speaker?: string;
}

export interface StoryCuesStripProps {
  cues: StoryCue[];
  currentFrame: number;
  activeCueId: string | null;
  onSelectCue: (cue: StoryCue) => void;
  disabled?: boolean;
}

export function StoryCuesStrip({
  cues,
  currentFrame,
  activeCueId,
  onSelectCue,
  disabled
}: StoryCuesStripProps) {
  if (!cues || cues.length === 0) {
    return null;
  }

  // Find cue that corresponds to currentFrame if any
  const currentPlayingCue = cues.find(c => currentFrame >= c.from && currentFrame < c.to);
  const activeCue = cues.find(c => c.id === activeCueId) || currentPlayingCue || cues[0];

  const handlePrev = () => {
    const currentIndex = cues.findIndex(c => c.id === activeCue?.id);
    if (currentIndex > 0) {
      onSelectCue(cues[currentIndex - 1]);
    }
  };

  const handleNext = () => {
    const currentIndex = cues.findIndex(c => c.id === activeCue?.id);
    if (currentIndex >= 0 && currentIndex < cues.length - 1) {
      onSelectCue(cues[currentIndex + 1]);
    }
  };

  const activeIndex = cues.findIndex(c => c.id === activeCue?.id);

  return (
    <section className="story-cues-strip" aria-label="Lời kể và câu thoại">
      <div className="story-cues-header">
        <div className="story-cues-title">
          <span className="story-cues-icon">📖</span>
          <strong>Lời kể & Cốt truyện</strong>
          <small className="story-cues-count">{cues.length} câu thoại</small>
        </div>
        <div className="story-cues-nav">
          <span className="story-cues-hint">Chọn câu để mở đúng đoạn dựng</span>
          <button
            type="button"
            className="story-cue-nav-btn"
            disabled={disabled || activeIndex <= 0}
            onClick={handlePrev}
            title="Câu thoại trước"
            aria-label="Câu thoại trước"
          >
            ◀ Câu trước
          </button>
          <span className="story-cue-nav-pos">
            {(activeIndex >= 0 ? activeIndex + 1 : 1)} / {cues.length}
          </span>
          <button
            type="button"
            className="story-cue-nav-btn"
            disabled={disabled || activeIndex >= cues.length - 1}
            onClick={handleNext}
            title="Câu thoại tiếp theo"
            aria-label="Câu thoại tiếp theo"
          >
            Câu tiếp ▶
          </button>
        </div>
      </div>

      <div className="story-cues-scroll-container">
        <div className="story-cues-list" role="list">
          {cues.map(cue => {
            const isPlaying = currentFrame >= cue.from && currentFrame < cue.to;
            const isSelected = activeCue?.id === cue.id;
            return (
              <button
                key={cue.id}
                type="button"
                role="listitem"
                disabled={disabled}
                className={
                  'story-cue-card ' +
                  (isSelected ? 'selected ' : '') +
                  (isPlaying ? 'playing ' : '')
                }
                onClick={() => onSelectCue(cue)}
                title={`Nhấp để mở đoạn frame ${cue.from}–${cue.to - 1} (${cue.durationSec.toFixed(1)}s)`}
              >
                <div className="story-cue-card-top">
                  <span className="story-cue-index">#{String(cue.index).padStart(2, '0')}</span>
                  <span className="story-cue-time">
                    {(cue.from / 30).toFixed(1)}s – {(cue.to / 30).toFixed(1)}s
                  </span>
                  {isPlaying && <span className="story-cue-live-pill">Đang phát</span>}
                  {isSelected && !isPlaying && <span className="story-cue-active-pill">Đang dựng</span>}
                </div>
                <div className="story-cue-text">{cue.text}</div>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
