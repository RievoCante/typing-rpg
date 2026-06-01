// Shared <Canvas> defaults for every 3D surface (monster, warrior avatar, raid
// boss). Centralized so the resolution cap is identical everywhere.
//
// dpr is the single biggest runtime lever: an uncapped Canvas renders at the
// full device pixel ratio, so on a 2-3x retina display it shades 4-9x the
// pixels of its CSS box every frame. Two such canvases run continuously during
// an Endless/Daily session (monster + warrior), which is what spikes CPU/GPU.
// Capping at 1.5 keeps edges crisp while cutting per-frame pixel work ~2-4x.
export const CANVAS_DPR: [number, number] = [1, 1.5];

// WebGL context options shared by every Canvas. Matches the prior
// alpha + antialias setup; centralized so future changes apply everywhere.
export const CANVAS_GL = {
  alpha: true,
  antialias: true,
} as const;
