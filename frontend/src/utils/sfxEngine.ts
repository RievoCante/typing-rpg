// Synthesized sound effects via Web Audio API — no audio assets required.
// Holds the authoritative SFX volume/mute so any component can trigger a sound
// while VolumeControl owns the UI. Settings are seeded from localStorage and
// kept in sync by the useSfx hook.

export const SFX_VOLUME_KEY = 'sfx:volume';
export const SFX_MUTED_KEY = 'sfx:muted';
const DEFAULT_SFX_VOLUME = 0.25;

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

// A chiptune-style explosion: a crunchy low-fi noise channel plus a square-wave
// tone that arpeggios downward — both using stepped (8-bit) envelopes so it
// reads as a retro "boom" rather than a smooth burst. ~0.9s long.
export function playExplosion() {
  if (settings.muted || settings.volume <= 0) return;
  const audio = getCtx();
  if (!audio) return;

  const now = audio.currentTime;
  const vol = settings.volume;
  const duration = 0.9;
  const sr = audio.sampleRate;

  // Stepped envelope helper — discrete volume drops give the 8-bit feel.
  const steppedDecay = (
    param: AudioParam,
    peak: number,
    steps: number,
    span: number
  ) => {
    for (let s = 0; s <= steps; s++) {
      const level = peak * (1 - s / steps);
      param.setValueAtTime(Math.max(0.0001, level), now + (span * s) / steps);
    }
  };

  // --- Noise channel: sample-and-hold + quantized for a crunchy LFSR sound ---
  const bufferSize = Math.floor(sr * duration);
  const buffer = audio.createBuffer(1, bufferSize, sr);
  const data = buffer.getChannelData(0);
  const hold = Math.max(1, Math.floor(sr / 8000)); // ~8kHz effective rate
  let held = 0;
  for (let i = 0; i < bufferSize; i++) {
    if (i % hold === 0) held = Math.random() * 2 - 1;
    data[i] = Math.round(held * 6) / 6; // quantize to a few levels
  }
  const noise = audio.createBufferSource();
  noise.buffer = buffer;

  const noiseFilter = audio.createBiquadFilter();
  noiseFilter.type = 'lowpass';
  noiseFilter.frequency.setValueAtTime(2400, now);
  noiseFilter.frequency.linearRampToValueAtTime(400, now + duration);

  const noiseGain = audio.createGain();
  steppedDecay(noiseGain.gain, vol * 0.9, 8, duration);
  noise.connect(noiseFilter).connect(noiseGain).connect(audio.destination);

  // --- Square-wave tone arpeggiating downward (the retro "boom") ---
  const osc = audio.createOscillator();
  osc.type = 'square';
  const toneSteps = 12;
  const startF = 340;
  const endF = 50;
  for (let s = 0; s <= toneSteps; s++) {
    const f = startF * Math.pow(endF / startF, s / toneSteps);
    osc.frequency.setValueAtTime(f, now + (duration * 0.85 * s) / toneSteps);
  }
  const oscGain = audio.createGain();
  steppedDecay(oscGain.gain, vol * 0.3, 9, duration);
  osc.connect(oscGain).connect(audio.destination);

  noise.start(now);
  noise.stop(now + duration);
  osc.start(now);
  osc.stop(now + duration);
}
