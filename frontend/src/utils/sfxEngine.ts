// Synthesized sound effects via Web Audio API — no audio assets required.
// Holds the authoritative SFX volume/mute so any component can trigger a sound
// while VolumeControl owns the UI. Settings are seeded from localStorage and
// kept in sync by the useSfx hook.

import { critSfxParams, type ComboTier } from './sfxTier';

export const SFX_VOLUME_KEY = 'sfx:volume';
export const SFX_MUTED_KEY = 'sfx:muted';
const DEFAULT_SFX_VOLUME = 0.25;
// The slider runs 0–1; this maps it onto a quieter output ceiling so even the
// max slider position stays comfortable. Better to start low and let players
// turn it up. settings.volume keeps the raw slider value (for persistence/UI);
// the ceiling is applied only at playback.
const SFX_MAX_OUTPUT = 0.3;
// The monster-kill explosion is the loudest cue, so it gets an extra attenuation
// on top of the global ceiling.
const EXPLOSION_SCALE = 0.5;

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
  const vol = settings.volume * SFX_MAX_OUTPUT * EXPLOSION_SCALE;
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

// Plays a short sequence of square-wave notes with a stepped 8-bit decay.
// Shared by the potion cues so they sit in the same retro family as the
// explosion above.
export function playArpeggio(freqs: number[], noteLen: number, peak: number) {
  if (settings.muted || settings.volume <= 0) return;
  const audio = getCtx();
  if (!audio) return;

  const now = audio.currentTime;
  const vol = settings.volume * SFX_MAX_OUTPUT * peak;

  freqs.forEach((f, i) => {
    const start = now + i * noteLen;
    const osc = audio.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(f, start);

    const gain = audio.createGain();
    // Stepped decay across the note for the chiptune feel.
    const steps = 4;
    for (let s = 0; s <= steps; s++) {
      const level = vol * (1 - s / steps);
      gain.gain.setValueAtTime(
        Math.max(0.0001, level),
        start + (noteLen * s) / steps
      );
    }

    osc.connect(gain).connect(audio.destination);
    osc.start(start);
    osc.stop(start + noteLen);
  });
}

// Bright ascending "pickup" blip for when a potion drops into the inventory.
export function playPotionDrop() {
  playArpeggio([660, 880, 1320], 0.07, 0.3);
}

// Warm ascending chime for drinking a potion (heal). A touch longer and
// sweeter than the drop cue so the two read as distinct events.
export function playPotionHeal() {
  playArpeggio([523, 659, 784, 1047], 0.09, 0.28);
}

// Short, bright punchy cue for a critical hit. The streak tier raises the pitch
// (a hotter streak sounds hotter) and, at BLAZING, layers a brighter octave on
// top. Defaults to 'combo' so callers that don't pass a tier behave as before.
export function playCrit(tier: ComboTier = 'combo') {
  const { pitchMult, extraLayer } = critSfxParams(tier);
  const base = [1047, 1568].map(f => f * pitchMult);
  playArpeggio(base, 0.06, 0.35);
  if (extraLayer) {
    // Brighter octave shimmer for the top tier.
    playArpeggio(
      base.map(f => f * 2),
      0.05,
      0.16
    );
  }
}

// Soft, low, descending cue for a broken combo — subtle so it informs without
// punishing the player too harshly.
export function playComboBreak() {
  playArpeggio([330, 220, 165], 0.08, 0.18);
}

// Short, punchy "hit" for when a monster attacks the player: a low square-wave
// thud that drops in pitch plus a brief noise crunch, both with stepped 8-bit
// envelopes so it lands as a retro impact. ~0.2s — quick so the periodic
// attacks don't get grating.
export function playMonsterAttack() {
  if (settings.muted || settings.volume <= 0) return;
  const audio = getCtx();
  if (!audio) return;

  const now = audio.currentTime;
  const vol = settings.volume * SFX_MAX_OUTPUT;
  const duration = 0.2;
  const sr = audio.sampleRate;

  // Stepped decay helper — discrete drops for the chiptune feel.
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

  // --- Short crunchy noise burst for the impact transient ---
  const bufferSize = Math.floor(sr * duration);
  const buffer = audio.createBuffer(1, bufferSize, sr);
  const data = buffer.getChannelData(0);
  const hold = Math.max(1, Math.floor(sr / 7000));
  let held = 0;
  for (let i = 0; i < bufferSize; i++) {
    if (i % hold === 0) held = Math.random() * 2 - 1;
    data[i] = Math.round(held * 5) / 5;
  }
  const noise = audio.createBufferSource();
  noise.buffer = buffer;

  const noiseFilter = audio.createBiquadFilter();
  noiseFilter.type = 'lowpass';
  noiseFilter.frequency.setValueAtTime(1600, now);
  noiseFilter.frequency.linearRampToValueAtTime(300, now + duration);

  const noiseGain = audio.createGain();
  steppedDecay(noiseGain.gain, vol * 0.5, 6, duration);
  noise.connect(noiseFilter).connect(noiseGain).connect(audio.destination);

  // --- Low square-wave thud dropping in pitch ---
  const osc = audio.createOscillator();
  osc.type = 'square';
  const toneSteps = 6;
  const startF = 200;
  const endF = 60;
  for (let s = 0; s <= toneSteps; s++) {
    const f = startF * Math.pow(endF / startF, s / toneSteps);
    osc.frequency.setValueAtTime(f, now + (duration * s) / toneSteps);
  }
  const oscGain = audio.createGain();
  steppedDecay(oscGain.gain, vol * 0.45, 6, duration);
  osc.connect(oscGain).connect(audio.destination);

  noise.start(now);
  noise.stop(now + duration);
  osc.start(now);
  osc.stop(now + duration);
}
