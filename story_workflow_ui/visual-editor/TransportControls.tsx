import React from 'react';
import { useTransportContext } from './useTransport';
import {
  IconChevronLeft,
  IconChevronRight,
  IconDiamond,
  IconPause,
  IconPlay,
  IconSkipBack,
  IconSkipForward,
  IconStepBack,
  IconStepForward,
} from './StudioIcons';

export interface TransportControlsProps {
  auto: boolean;
  setAuto: (value: boolean) => void;
  proMode?: boolean;
  playbackRate?: number;
  onCyclePlaybackRate?: () => void;
  onPrevCue?: () => void;
  onNextCue?: () => void;
  hasCues?: boolean;
}

export function TransportControls({
  auto,
  setAuto,
  proMode = false,
  playbackRate = 1,
  onCyclePlaybackRate,
  onPrevCue,
  onNextCue,
  hasCues = false,
}: TransportControlsProps) {
  const { frame, totalFrames, seek, player, playing } = useTransportContext();

  const currentMins = Math.floor((frame % 108000) / 1800).toString().padStart(2, '0');
  const currentSecs = Math.floor((frame % 1800) / 30).toString().padStart(2, '0');
  const currentFrames = (frame % 30).toString().padStart(2, '0');

  const totalMins = Math.floor((totalFrames % 108000) / 1800).toString().padStart(2, '0');
  const totalSecs = Math.floor((totalFrames % 1800) / 30).toString().padStart(2, '0');
  const totalSubFrames = (totalFrames % 30).toString().padStart(2, '0');

  return (
    <div className="studio-transport" role="region" aria-label="Thanh điều khiển phát video">
      <div className="transport-timecode" title={`Frame ${frame} / ${totalFrames}`}>
        <span className="time-primary">
          {currentMins}:{currentSecs}:{currentFrames}
        </span>
        <span className="time-separator">/</span>
        <span className="time-secondary">
          {totalMins}:{totalSecs}:{totalSubFrames}
        </span>
        <span className="time-frames">F:{frame}</span>
      </div>

      <div className="transport-playback-controls" aria-label="Phím điều khiển tua phát">
        <button
          type="button"
          className="transport-btn"
          title="Về đầu cảnh (Home)"
          aria-label="Về đầu cảnh"
          onClick={() => seek(0)}
        >
          <IconSkipBack size={13} />
        </button>

        {hasCues && onPrevCue && (
          <button
            type="button"
            className="transport-btn transport-cue-btn"
            title="Câu thoại trước ([)"
            aria-label="Câu thoại trước"
            onClick={onPrevCue}
          >
            <IconChevronLeft size={13} />
          </button>
        )}

        <button
          type="button"
          className="transport-btn"
          title="Lùi 1 frame (←)"
          aria-label="Lùi 1 frame"
          onClick={() => seek(frame - 1)}
        >
          <IconStepBack size={13} />
        </button>

        <button
          type="button"
          className={`transport-play-btn ${playing ? 'playing' : ''}`}
          title="Phát / Dừng (Space)"
          aria-label={playing ? 'Dừng phát' : 'Phát video'}
          onClick={() => player.current?.toggle()}
        >
          {playing ? <IconPause size={14} /> : <IconPlay size={14} />}
        </button>

        <button
          type="button"
          className="transport-btn"
          title="Tiến 1 frame (→)"
          aria-label="Tiến 1 frame"
          onClick={() => seek(frame + 1)}
        >
          <IconStepForward size={13} />
        </button>

        {hasCues && onNextCue && (
          <button
            type="button"
            className="transport-btn transport-cue-btn"
            title="Câu thoại sau (])"
            aria-label="Câu thoại sau"
            onClick={onNextCue}
          >
            <IconChevronRight size={13} />
          </button>
        )}

        <button
          type="button"
          className="transport-btn"
          title="Đến cuối cảnh (End)"
          aria-label="Đến cuối cảnh"
          onClick={() => seek(totalFrames - 1)}
        >
          <IconSkipForward size={13} />
        </button>
      </div>

      <div className="transport-extras">
        {onCyclePlaybackRate && (
          <button
            type="button"
            className={`transport-rate-btn ${playbackRate !== 1 ? 'active' : ''}`}
            title="Đổi tốc độ phát thử (1× · 1.5× · 2× · 0.5×)"
            onClick={onCyclePlaybackRate}
          >
            {playbackRate}×
          </button>
        )}

        {(proMode || auto) && (
          <button
            type="button"
            className={`transport-toggle-btn ${auto ? 'active' : ''}`}
            title="Tự động ghi keyframe khi di chuyển đối tượng"
            onClick={() => setAuto(!auto)}
          >
            <IconDiamond size={12} />
            <span>Auto-Key</span>
          </button>
        )}
      </div>
    </div>
  );
}
