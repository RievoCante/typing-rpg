import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import {
  DEFAULT_AVATAR_CONFIG,
  ARMOR_TYPES,
  ARMOR_COLORS,
  HELMET_TYPES,
  HELMET_COLORS,
  SKIN_TONES,
  type PlayerAvatarConfig,
} from '../utils/avatarConfig';
import { useCharacter } from '../hooks/useCharacter';
import { useThemeContext } from '../hooks/useThemeContext';
import { useApi } from '../hooks/useApi';
import PlayerAvatar3D from './PlayerAvatar3D';

interface Props {
  onClose: () => void;
}

export default function CharacterCustomizer({ onClose }: Props) {
  const { config, save } = useCharacter();
  const { theme } = useThemeContext();
  const { getMe, updateDisplayName } = useApi();
  const [draft, setDraft] = useState<PlayerAvatarConfig>(
    config ?? DEFAULT_AVATAR_CONFIG
  );
  const [displayName, setDisplayName] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The real saved displayName (null if never set) and the username we
  // prefilled with as a fallback. Used at save time so opening the modal and
  // saving without touching the name doesn't lock the prefilled username in as
  // an explicit displayName (which would then shadow future Clerk username changes).
  const savedDisplayNameRef = useRef<string | null>(null);
  const prefilledUsernameRef = useRef<string>('');
  // If the modal opens before the saved config has loaded, adopt it once it
  // arrives — but never clobber edits the user has already made.
  const editedRef = useRef(false);
  useEffect(() => {
    if (config && !editedRef.current) setDraft(config);
  }, [config]);

  // Prefill the field with the player's current leaderboard name: their saved
  // displayName if set, otherwise their username (the fallback the leaderboard
  // already shows), so they see and can edit what's live today.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await getMe();
        if (res.ok) {
          const data = await res.json();
          const saved: string | null = data?.user?.displayName ?? null;
          const username: string = data?.user?.username ?? '';
          if (!cancelled) {
            savedDisplayNameRef.current = saved;
            prefilledUsernameRef.current = username;
            setDisplayName(saved ?? username);
          }
        }
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getMe]);

  // Close on Escape, matching the click-outside affordance.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const set = <K extends keyof PlayerAvatarConfig>(
    key: K,
    value: PlayerAvatarConfig[K]
  ) => {
    editedRef.current = true;
    setDraft(d => ({ ...d, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const trimmed = displayName.trim();
      // If the user never had a saved name and left the prefilled username
      // untouched, persist null (keep falling back to username) rather than
      // pinning the username as an explicit displayName.
      const isUntouchedFallback =
        savedDisplayNameRef.current === null &&
        trimmed === prefilledUsernameRef.current.trim();
      await Promise.all([
        save(draft),
        updateDisplayName(isUntouchedFallback ? null : trimmed || null),
      ]);
      onClose();
    } catch {
      setError('Could not save. Please try again.');
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

        <div className="mb-4">
          <label className="text-xs font-semibold uppercase tracking-wide opacity-70 mb-1 block">
            Display Name
          </label>
          <input
            type="text"
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            placeholder="Your name on the leaderboard"
            maxLength={50}
            className={`w-full px-3 py-2 rounded border text-sm ${
              theme === 'dark'
                ? 'bg-[#1E1F2B] border-gray-600 text-white placeholder-gray-500'
                : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-400'
            } focus:outline-none focus:ring-2 focus:ring-blue-500/50`}
          />
        </div>

        <div className="mx-auto mb-4 h-40 w-40">
          <PlayerAvatar3D config={draft} isAlive hpPercent={100} />
        </div>

        <Knob label="Armor">
          {ARMOR_TYPES.map(s => (
            <Choice
              key={s}
              active={draft.armorType === s}
              onClick={() => set('armorType', s)}
            >
              {s}
            </Choice>
          ))}
        </Knob>

        <Knob label="Armor Color">
          {ARMOR_COLORS.map(c => (
            <Swatch
              key={c}
              color={c}
              active={draft.armorColor === c}
              onClick={() => set('armorColor', c)}
            />
          ))}
        </Knob>

        <Knob label="Helmet">
          {HELMET_TYPES.map(s => (
            <Choice
              key={s}
              active={draft.helmetType === s}
              onClick={() => set('helmetType', s)}
            >
              {s}
            </Choice>
          ))}
        </Knob>

        <Knob label="Helmet Color">
          {HELMET_COLORS.map(c => (
            <Swatch
              key={c}
              color={c}
              active={draft.helmetColor === c}
              onClick={() => set('helmetColor', c)}
            />
          ))}
        </Knob>

        <Knob label="Skin">
          {SKIN_TONES.map(c => (
            <Swatch
              key={c}
              color={c}
              active={draft.skinTone === c}
              onClick={() => set('skinTone', c)}
            />
          ))}
        </Knob>

        {error && (
          <p className="mt-4 text-sm text-red-400 text-right">{error}</p>
        )}

        <div className="mt-4 flex justify-end gap-3">
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
        active ? 'border-blue-500 scale-110' : 'border-gray-400/40'
      } transition-transform`}
    />
  );
}
