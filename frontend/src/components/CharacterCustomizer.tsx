import { useState } from 'react';
import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import {
  avatarConfigFromSeed,
  BODY_SHAPES,
  BODY_COLORS,
  EYE_STYLES,
  ACCESSORIES,
  ACCESSORY_COLORS,
  type PlayerAvatarConfig,
} from '../utils/avatarConfig';
import { useCharacter } from '../hooks/useCharacter';
import { useThemeContext } from '../hooks/useThemeContext';
import PlayerAvatar3D from './PlayerAvatar3D';

interface Props {
  onClose: () => void;
}

export default function CharacterCustomizer({ onClose }: Props) {
  const { config, save } = useCharacter();
  const { theme } = useThemeContext();
  const [draft, setDraft] = useState<PlayerAvatarConfig>(
    config ?? avatarConfigFromSeed('preview')
  );
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof PlayerAvatarConfig>(
    key: K,
    value: PlayerAvatarConfig[K]
  ) => setDraft(d => ({ ...d, [key]: value }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await save(draft);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const panel =
    theme === 'dark' ? 'bg-[#2A2C3C] text-gray-100' : 'bg-white text-gray-900';

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        className={`relative w-full max-w-md rounded-lg shadow-2xl p-6 ${panel}`}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-3 right-3 p-1 rounded hover:bg-gray-500/20"
        >
          <X size={18} />
        </button>
        <h2 className="text-lg font-bold mb-4">Customize Character</h2>

        <div className="mx-auto mb-4 h-40 w-40">
          <PlayerAvatar3D config={draft} isAlive hpPercent={100} />
        </div>

        <Knob label="Body">
          {BODY_SHAPES.map(s => (
            <Choice
              key={s}
              active={draft.bodyShape === s}
              onClick={() => set('bodyShape', s)}
            >
              {s}
            </Choice>
          ))}
        </Knob>

        <Knob label="Body Color">
          {BODY_COLORS.map(c => (
            <Swatch
              key={c}
              color={c}
              active={draft.bodyColor === c}
              onClick={() => set('bodyColor', c)}
            />
          ))}
        </Knob>

        <Knob label="Eyes">
          {EYE_STYLES.map(s => (
            <Choice
              key={s}
              active={draft.eyeStyle === s}
              onClick={() => set('eyeStyle', s)}
            >
              {s}
            </Choice>
          ))}
        </Knob>

        <Knob label="Accessory">
          {ACCESSORIES.map(a => (
            <Choice
              key={a}
              active={draft.accessory === a}
              onClick={() => set('accessory', a)}
            >
              {a}
            </Choice>
          ))}
        </Knob>

        <Knob label="Accessory Color">
          {ACCESSORY_COLORS.map(c => (
            <Swatch
              key={c}
              color={c}
              active={draft.accessoryColor === c}
              onClick={() => set('accessoryColor', c)}
            />
          ))}
        </Knob>

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded bg-gray-500/20 hover:bg-gray-500/30"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 rounded bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Knob({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="mb-3">
      <p className="text-xs font-semibold uppercase tracking-wide opacity-70 mb-1">
        {label}
      </p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function Choice({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 rounded text-sm capitalize border ${
        active
          ? 'border-blue-500 bg-blue-500/20'
          : 'border-gray-500/30 hover:bg-gray-500/10'
      }`}
    >
      {children}
    </button>
  );
}

function Swatch({
  color,
  active,
  onClick,
}: {
  color: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={color}
      style={{ backgroundColor: color }}
      className={`h-7 w-7 rounded-full border-2 ${
        active ? 'border-blue-500 scale-110' : 'border-transparent'
      } transition-transform`}
    />
  );
}
