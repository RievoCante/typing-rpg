/**
 * Pure layout for the typing prompt.
 *
 * Produces an ordered list of display lines made of tokens. Overflow letters
 * (extra characters typed past a word's end) are inserted immediately before
 * their boundary space, so the active word grows and pushes the rest of the
 * prompt right — wrapping to a new line when the line fills. Because the prompt
 * is rendered in a monospace font, line width is measured exactly by character
 * (token) count.
 */

export interface OrigToken {
  kind: 'orig';
  /** Index into the original text. */
  origIndex: number;
  char: string;
}

export interface OverflowToken {
  kind: 'overflow';
  /** The boundary space index this extra letter belongs to. */
  boundary: number;
  /** Position within the overflow bucket. */
  ordinal: number;
  char: string;
}

export type TypingToken = OrigToken | OverflowToken;

export interface TypingLine {
  tokens: TypingToken[];
  /** First original-text index on this line. */
  origStart: number;
  /** One past the last original-text index on this line. */
  origEnd: number;
}

interface Segment {
  tokens: TypingToken[];
  isSpace: boolean;
}

const makeLine = (tokens: TypingToken[]): TypingLine => {
  const origs = tokens.filter((t): t is OrigToken => t.kind === 'orig');
  const first = origs[0];
  const last = origs[origs.length - 1];
  return {
    tokens,
    origStart: first ? first.origIndex : 0,
    origEnd: last ? last.origIndex + 1 : 0,
  };
};

export const buildTypingLines = (
  text: string,
  overflow: Record<number, string[]>,
  maxCharsPerLine: number
): TypingLine[] => {
  // 1. Build segments: words (non-space runs, including overflow) and spaces.
  const segments: Segment[] = [];
  let word: TypingToken[] = [];
  const flushWord = () => {
    if (word.length) {
      segments.push({ tokens: word, isSpace: false });
      word = [];
    }
  };

  for (let i = 0; i < text.length; i++) {
    if (text[i] === ' ') {
      // Overflow belongs to the word before this space — append, then break.
      const extra = overflow[i];
      if (extra?.length) {
        extra.forEach((char, ordinal) =>
          word.push({ kind: 'overflow', boundary: i, ordinal, char })
        );
      }
      flushWord();
      segments.push({
        tokens: [{ kind: 'orig', origIndex: i, char: ' ' }],
        isSpace: true,
      });
    } else {
      word.push({ kind: 'orig', origIndex: i, char: text[i] });
    }
  }
  flushWord();

  // 2. Pack segments into lines. Wrap only before a word (never a space), so
  //    trailing spaces stay on the line they close.
  const lines: TypingLine[] = [];
  let current: TypingToken[] = [];
  for (const seg of segments) {
    if (
      !seg.isSpace &&
      current.length > 0 &&
      current.length + seg.tokens.length > maxCharsPerLine
    ) {
      lines.push(makeLine(current));
      current = [];
    }
    current.push(...seg.tokens);
  }
  if (current.length) lines.push(makeLine(current));

  return lines;
};
