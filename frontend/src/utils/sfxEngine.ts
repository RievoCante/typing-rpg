// Synthesized sound effects via Web Audio API — no audio assets required.
// Holds the authoritative SFX volume/mute so any component can trigger a sound
// while VolumeControl owns the UI. Settings are seeded from localStorage and
// kept in sync by the useSfx hook.

export const SFX_VOLUME_KEY = 'sfx:volume';
export const SFX_MUTED_KEY = 'sfx:muted';
const DEFAULT_SFX_VOLUME = 0.5;

function readVolume(): number {
  try {
    const saved = localStorage.getItem(SFX_VOLUME_KEY);
    const v = saved ? parseFloat(saved) : DEFAULT_SFX_VOLUME;
    return Number.isFinite(v)
      ? Math.min(1, Math.max(0, v))
      : DEFAULT_SFX_VOLUME;
  } catch {
    return DEFAULT_SFX_VOLUME;
  }
}

function readMuted(): boolean {
  try {
    return localStorage.getItem(SFX_MUTED_KEY) === '1';
  } catch {
    return false;
  }
}

const settings = {
  volume: readVolume(),
  muted: readMuted(),
};

export function setSfxSettings(next: { volume: number; muted: boolean }) {
  settings.volume = Math.min(1, Math.max(0, next.volume));
  settings.muted = next.muted;
}

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) ctx = new Ctor();
  if (ctx.state === 'suspended') void ctx.resume().catch(() => {});
  return ctx;
}

// A short, punchy explosion: a filtered noise burst for the "crack" plus a
// low sine drop for the "boom" body. Both decay quickly so it reads as a pop.
export function playExplosion() {
  if (settings.muted || settings.volume <= 0) return;
  const audio = getCtx();
  if (!audio) return;

  const now = audio.currentTime;
  const vol = settings.volume;
  const noiseDur = 0.5;
  const thumpDur = 0.3;

  // Noise burst → lowpass sweep → gain envelope
  const bufferSize = Math.floor(audio.sampleRate * noiseDur);
  const buffer = audio.createBuffer(1, bufferSize, audio.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

  const noise = audio.createBufferSource();
  noise.buffer = buffer;

  const lowpass = audio.createBiquadFilter();
  lowpass.type = 'lowpass';
  lowpass.frequency.setValueAtTime(1400, now);
  lowpass.frequency.exponentialRampToValueAtTime(120, now + noiseDur);

  const noiseGain = audio.createGain();
  noiseGain.gain.setValueAtTime(vol, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, now + noiseDur);

  noise.connect(lowpass).connect(noiseGain).connect(audio.destination);

  // Low-frequency body drop
  const osc = audio.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(95, now);
  osc.frequency.exponentialRampToValueAtTime(40, now + thumpDur);

  const oscGain = audio.createGain();
  oscGain.gain.setValueAtTime(vol * 0.8, now);
  oscGain.gain.exponentialRampToValueAtTime(0.001, now + thumpDur);

  osc.connect(oscGain).connect(audio.destination);

  noise.start(now);
  noise.stop(now + noiseDur);
  osc.start(now);
  osc.stop(now + thumpDur);
}
