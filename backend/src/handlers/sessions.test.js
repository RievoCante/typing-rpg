import { describe, it, expect } from 'vitest';
import { sessionSchema } from './sessions';
describe('sessionSchema metrics fields', () => {
    it('accepts new optional metric fields', () => {
        const r = sessionSchema.safeParse({
            mode: 'endless',
            wpm: 80,
            totalWords: 20,
            correctWords: 19,
            incorrectWords: 1,
            rawWpm: 85,
            accuracy: 95,
            consistency: 72,
            correctChars: 95,
            incorrectChars: 5,
            extraChars: 1,
            missedChars: 0,
            durationSeconds: 15,
            afkSeconds: 0,
            chartData: { wpm: [70, 80], raw: [75, 85], err: [0, 1] },
        });
        expect(r.success).toBe(true);
    });
    it('still accepts a payload without metric fields', () => {
        const r = sessionSchema.safeParse({
            mode: 'daily',
            wpm: 60,
            totalWords: 30,
            correctWords: 29,
            incorrectWords: 1,
        });
        expect(r.success).toBe(true);
    });
    it('rejects out-of-range accuracy', () => {
        const r = sessionSchema.safeParse({
            mode: 'endless',
            wpm: 80,
            totalWords: 1,
            correctWords: 1,
            incorrectWords: 0,
            accuracy: 150,
        });
        expect(r.success).toBe(false);
    });
});
