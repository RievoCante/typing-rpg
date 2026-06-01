// Floating bottom-left audio control. Collapsed: a single music circle.
// On hover/focus it expands into two stacked slider rows — sound effects on
// top, background music on the bottom — each with click-to-mute.
import type { ReactNode } from 'react';
import { Music2, Volume2, Slash } from 'lucide-react';
import { useBgm } from '../hooks/useBgm';
import { useSfx } from '../hooks/useSfx';
import { useThemeContext } from '../hooks/useThemeContext';

interface SliderRowProps {
  icon: ReactNode;
  ariaLabel: string;
  volume: number;
  setVolume: (v: number) => void;
  muted: boolean;
  toggleMute: () => void;
  onInteract?: () => void; // icon button click
  onSlide?: () => void; // fired on every slider change (keep idempotent)
  onCommit?: () => void; // fired once when the drag/keypress is released
  isDark: boolean;
  iconColor: string;
}

// One audio channel: mute button + volume slider. The slider fades in with the
// shared outer `group` hover so the collapsed circle stays icon-only.
function SliderRow({
  icon,
  ariaLabel,
  volume,
  setVolume,
  muted,
  toggleMute,
  onInteract,
  onSlide,
  onCommit,
  isDark,
  iconColor,
}: SliderRowProps) {
  return (
    <div
      className={`relative h-12 w-full rounded-full shadow overflow-hidden ${
        isDark ? 'bg-[#1D1F2A] text-white' : 'bg-white text-black'
      }`}
    >
      {/* Icon absolutely positioned at the left so it never shifts */}
      <div className="absolute left-0 top-0 h-full w-12 flex items-center justify-center z-10">
        <button
          type="button"
          onClick={() => {
            toggleMute();
            onInteract?.();
          }}
          aria-label={ariaLabel}
          className="h-12 w-12 flex items-center justify-center"
        >
          <span className="relative inline-flex items-center justify-center">
            {icon}
            {(muted || volume === 0) && (
              <Slash
                size={18}
                style={{ color: iconColor }}
                className="absolute pointer-events-none"
              />
            )}
          </span>
        </button>
      </div>

      {/* Slider overlay fades in with the outer group's hover/focus */}
      <div
        className="absolute inset-y-0 left-12 right-3 flex items-center opacity-0 translate-x-2
                   transition-all duration-300 ease-out pointer-events-none
                   group-hover:opacity-100 group-hover:translate-x-0 group-hover:pointer-events-auto
                   group-focus-within:opacity-100 group-focus-within:translate-x-0 group-focus-within:pointer-events-auto"
      >
        <input
          aria-label={`${ariaLabel} volume`}
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={muted ? 0 : volume}
          onChange={e => {
            const v = parseFloat(e.target.value);
            setVolume(v);
            if (v > 0 && muted) toggleMute();
            onSlide?.();
          }}
          onPointerUp={() => onCommit?.()}
          onKeyUp={() => onCommit?.()}
          className="w-full accent-[#FCC800]"
        />
      </div>
    </div>
  );
}

export default function VolumeControl() {
  const bgm = useBgm();
  const sfx = useSfx();
  const { theme } = useThemeContext();
  const isDark = theme === 'dark';
  const iconColor = isDark ? '#ffffff' : '#000000';

  return (
    <div className="fixed bottom-4 left-4 z-50 select-none">
      {/* Outer group: collapsed 48px circle, expands to a 320px column on hover */}
      <div className="group relative h-12 w-12 hover:w-80 focus-within:w-80 transition-all duration-300 ease-out">
        {/* SFX row — stacked above, hidden until the control is opened.
            bottom-full + pb-2 keeps a transparent bridge over the visual gap so
            moving the cursor up to the SFX row doesn't drop the hover. */}
        <div
          className="absolute left-0 bottom-full w-full pb-2 opacity-0 translate-y-1 pointer-events-none
                     transition-all duration-300 ease-out
                     group-hover:opacity-100 group-hover:translate-y-0 group-hover:pointer-events-auto
                     group-focus-within:opacity-100 group-focus-within:translate-y-0 group-focus-within:pointer-events-auto"
        >
          <SliderRow
            icon={<Volume2 size={18} style={{ color: iconColor }} />}
            ariaLabel="Toggle sound effects"
            volume={sfx.volume}
            setVolume={sfx.setVolume}
            muted={sfx.muted}
            toggleMute={sfx.toggleMute}
            onInteract={sfx.playExplosion}
            onCommit={sfx.playExplosion}
            isDark={isDark}
            iconColor={iconColor}
          />
        </div>

        {/* BGM row — always-visible circle that expands into a slider */}
        <SliderRow
          icon={<Music2 size={18} style={{ color: iconColor }} />}
          ariaLabel="Toggle music"
          volume={bgm.volume}
          setVolume={bgm.setVolume}
          muted={bgm.muted}
          toggleMute={bgm.toggleMute}
          onInteract={bgm.ensurePlay}
          onSlide={bgm.ensurePlay}
          isDark={isDark}
          iconColor={iconColor}
        />
      </div>
    </div>
  );
}
