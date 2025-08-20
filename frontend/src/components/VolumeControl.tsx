// Floating bottom-left volume control with hover slider and click-to-mute
import { Music2, Slash } from 'lucide-react';
import { useBgm } from '../hooks/useBgm';
import { useThemeContext } from '../hooks/useThemeContext';

export default function VolumeControl() {
  const { volume, setVolume, muted, toggleMute, ensurePlay } = useBgm();
  const { theme } = useThemeContext();

  const iconColor = theme === 'dark' ? '#ffffff' : '#000000';

  return (
    <div className="fixed bottom-4 left-4 z-50 select-none">
      {/* Connected pill that expands to the right on hover/focus */}
      <div
        className="group relative h-12 w-12 bg-[#1D1F2A] text-white rounded-full shadow overflow-hidden
                   transition-all duration-300 ease-out
                   hover:w-80 focus-within:w-80"
      >
        {/* Icon is absolutely positioned at the left so it never shifts */}
        <div className="absolute left-0 top-0 h-full w-12 flex items-center justify-center z-10">
          <button
            type="button"
            onClick={() => {
              toggleMute();
              ensurePlay();
            }}
            aria-label="Toggle mute"
            className="h-12 w-12 flex items-center justify-center"
          >
            <span className="relative inline-flex items-center justify-center">
              <Music2 size={18} style={{ color: iconColor }} />
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

        {/* Absolute slider overlay so collapsed icon stays perfectly centered */}
        <div
          className="absolute inset-y-0 left-12 right-3 flex items-center opacity-0 translate-x-2
                     transition-all duration-300 ease-out pointer-events-none
                     group-hover:opacity-100 group-hover:translate-x-0 group-hover:pointer-events-auto
                     group-focus-within:opacity-100 group-focus-within:translate-x-0 group-focus-within:pointer-events-auto"
        >
          <input
            aria-label="Volume"
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={muted ? 0 : volume}
            onChange={e => {
              const v = parseFloat(e.target.value);
              setVolume(v);
              if (v > 0 && muted) toggleMute();
              ensurePlay();
            }}
            className="w-full accent-[#FCC800]"
          />
        </div>
      </div>
    </div>
  );
}
