// Whole seconds remaining until `endsAt`, clamped at 0. Pure so it can be
// unit-tested without a DOM (frontend vitest runs in the node environment).
export function countdownRemaining(endsAt: number, nowMs: number): number {
  return Math.max(0, Math.ceil((endsAt - nowMs) / 1000));
}
