import { describe, it, expect } from 'vitest';
import { buildTypingLines } from './typingLines';

const text = (line: { tokens: { char: string }[] }) =>
  line.tokens.map(t => t.char).join('');

describe('buildTypingLines', () => {
  it('keeps a short prompt on a single line', () => {
    const lines = buildTypingLines('to be free', {}, 43);
    expect(lines).toHaveLength(1);
    expect(text(lines[0])).toBe('to be free');
    expect(lines[0].origStart).toBe(0);
    expect(lines[0].origEnd).toBe(10);
  });

  it('wraps whole words by character count', () => {
    // maxCharsPerLine = 5 forces "to be" then "free"
    const lines = buildTypingLines('to be free', {}, 5);
    expect(lines.map(text)).toEqual(['to be ', 'free']);
    expect(lines[0].origStart).toBe(0);
    expect(lines[0].origEnd).toBe(6); // through the space at index 5
    expect(lines[1].origStart).toBe(6);
    expect(lines[1].origEnd).toBe(10);
  });

  it('inserts overflow letters before the boundary space', () => {
    // overflow on "to" (boundary space index 2)
    const lines = buildTypingLines('to be free', { 2: ['x', 'y'] }, 43);
    expect(text(lines[0])).toBe('toxy be free');
    // overflow tokens carry the boundary, not an original index
    const overflowTokens = lines[0].tokens.filter(t => t.kind === 'overflow');
    expect(overflowTokens.map(t => t.char)).toEqual(['x', 'y']);
    expect(overflowTokens.every(t => t.boundary === 2)).toBe(true);
    // original index bookkeeping is unaffected by the inserted tokens
    expect(lines[0].origStart).toBe(0);
    expect(lines[0].origEnd).toBe(10);
  });

  it('counts overflow width when wrapping so the word pushes right', () => {
    // "to" + 4 overflow = effective width 6 > 5, so "free" can't fit with it
    const lines = buildTypingLines(
      'to be free',
      { 2: ['1', '2', '3', '4'] },
      6
    );
    // "to1234 " exceeds nothing alone, but adding "be" (len 2) -> 7+2 wraps
    expect(text(lines[0])).toBe('to1234 ');
    expect(lines[1].origStart).toBe(3);
  });

  it('marks original tokens with their text index and char', () => {
    const lines = buildTypingLines('hi', {}, 43);
    const origs = lines[0].tokens.filter(t => t.kind === 'orig');
    expect(origs.map(t => ({ i: t.origIndex, c: t.char }))).toEqual([
      { i: 0, c: 'h' },
      { i: 1, c: 'i' },
    ]);
  });
});
