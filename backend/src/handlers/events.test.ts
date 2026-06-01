import { describe, it, expect } from 'vitest';
import { eventSchema } from './events';

describe('eventSchema', () => {
  it('accepts a valid anonymous reached_game event', () => {
    const r = eventSchema.safeParse({ event: 'reached_game', anonId: 'abc-123', mode: 'daily' });
    expect(r.success).toBe(true);
  });

  it('accepts started_typing without a mode', () => {
    const r = eventSchema.safeParse({ event: 'started_typing', anonId: 'abc-123' });
    expect(r.success).toBe(true);
  });

  it('rejects an unknown event name', () => {
    const r = eventSchema.safeParse({ event: 'finished', anonId: 'abc-123' });
    expect(r.success).toBe(false);
  });

  it('rejects a missing anonId', () => {
    const r = eventSchema.safeParse({ event: 'reached_game' });
    expect(r.success).toBe(false);
  });

  it('rejects an over-long anonId', () => {
    const r = eventSchema.safeParse({ event: 'reached_game', anonId: 'x'.repeat(65) });
    expect(r.success).toBe(false);
  });

  it('rejects an invalid mode', () => {
    const r = eventSchema.safeParse({ event: 'reached_game', anonId: 'abc-123', mode: 'practice' });
    expect(r.success).toBe(false);
  });
});
