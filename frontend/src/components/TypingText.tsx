import { useLayoutEffect, useRef, useState } from 'react';
import { useThemeContext } from '../hooks/useThemeContext';
import { buildTypingLines } from '../utils/typingLines';

export type CharStatus =
  | 'pending'
  | 'correct'
  | 'incorrect'
  | 'skipped'
  | 'locked';

interface TypingTextProps {
  text: string;
  charStatus: CharStatus[];
  typedChars: (string | null)[];
  cursorPosition: number;
  hasStartedTyping: boolean;
  /** Extra letters typed past a word's end, keyed by boundary space index. */
  overflow?: Record<number, string[]>;
}

export default function TypingText({
  text,
  charStatus,
  typedChars,
  cursorPosition,
  hasStartedTyping,
  overflow = {},
}: TypingTextProps) {
  const { theme } = useThemeContext();

  // Chars-per-line is measured from the live container width instead of being
  // hardcoded, so a full line always fits no matter the screen size. We size a
  // line to the actual available width divided by the actual rendered width of
  // one monospace glyph (which includes tracking). `whitespace-nowrap` +
  // `overflow-hidden` on each line below remain the hard guard if a single
  // token (e.g. a long overflow run) ever exceeds the width.
  const widthRef = useRef<HTMLDivElement>(null);
  const charRef = useRef<HTMLSpanElement>(null);
  // Conservative starting value: small enough to never overflow on first paint
  // before measurement runs; corrected synchronously via useLayoutEffect.
  const [maxCharsPerLine, setMaxCharsPerLine] = useState(20);

  // Drives the re-measure when text first arrives (see effect deps below).
  const hasText = text.length > 0;

  useLayoutEffect(() => {
    const widthEl = widthRef.current;
    const charEl = charRef.current;
    if (!widthEl || !charEl) return;

    const SAMPLE_LEN = 20;
    const recompute = () => {
      const available = widthEl.clientWidth;
      const charWidth = charEl.getBoundingClientRect().width / SAMPLE_LEN;
      if (available <= 0 || charWidth <= 0) return;
      // floor() guarantees the line fits; -1 char absorbs sub-pixel rounding
      // and the cursor's 2px border. Clamp so we never produce empty lines.
      const fit = Math.floor(available / charWidth) - 1;
      setMaxCharsPerLine(Math.max(8, fit));
    };

    recompute();
    const observer = new ResizeObserver(recompute);
    observer.observe(widthEl);
    return () => observer.disconnect();
    // Re-run when text first appears: the measured refs only mount in the
    // non-loading branch, so the initial run is a no-op until text exists.
  }, [hasText]);

  if (!text) {
    return (
      <div
        className={`text-2xl my-6 leading-relaxed font-mono ${
          theme === 'dark' ? 'text-slate-500' : 'text-gray-500'
        }`}
      >
        Loading text...
      </div>
    );
  }

  // Helper function to get character color based on status and theme
  const getCharStyle = (status: CharStatus): string => {
    switch (status) {
      case 'locked':
        return 'text-green-400';
      case 'correct':
        return theme === 'dark' ? 'text-slate-100' : 'text-[#1D221F]';
      case 'incorrect':
        return 'text-red-500';
      case 'skipped':
        return theme === 'dark' ? 'text-slate-400' : 'text-gray-400';
      case 'pending':
      default:
        return theme === 'dark' ? 'text-slate-500' : 'text-[#D5D5D5]';
    }
  };

  // Helper function to determine what character to display
  const getDisplayChar = (originalChar: string, index: number): string => {
    const status = charStatus[index];
    if (status === 'incorrect' && typedChars[index]) {
      return typedChars[index] as string;
    }
    return originalChar;
  };

  // Helper function to check if a character is part of a word with errors.
  // A word is an error word if any of its characters are incorrect/skipped, or
  // it carries overflow (extra) characters at its trailing boundary.
  const isInErrorWord = (index: number): boolean => {
    let wordStart = index;
    let wordEnd = index;

    while (wordStart > 0 && !/\s/.test(text[wordStart - 1])) {
      wordStart--;
    }
    while (wordEnd < text.length - 1 && !/\s/.test(text[wordEnd + 1])) {
      wordEnd++;
    }

    // Overflow lives at the space right after the word.
    if ((overflow[wordEnd + 1]?.length ?? 0) > 0) {
      return true;
    }

    for (let i = wordStart; i <= wordEnd; i++) {
      const status = charStatus[i];
      if (status === 'incorrect' || status === 'skipped') {
        return true;
      }
    }

    return false;
  };

  const textLines = buildTypingLines(text, overflow, maxCharsPerLine);

  // Find which line contains the cursor position
  const getCursorLineIndex = () => {
    for (let i = 0; i < textLines.length; i++) {
      const line = textLines[i];
      if (cursorPosition >= line.origStart && cursorPosition < line.origEnd) {
        return i;
      }
    }
    // If cursor is at the very end, it's on the last line
    if (cursorPosition >= text.length && textLines.length > 0) {
      return textLines.length - 1;
    }
    return 0;
  };

  const cursorLineIndex = getCursorLineIndex();

  // Calculate viewport start index:
  // - At start (cursor on line 0): show from line 0, cursor on first visible line
  // - After completing line 0: still show from line 0, cursor moves to second visible line
  // - After line 1+: show from cursor-1, keeping cursor on middle line
  const viewportStartIndex = cursorLineIndex <= 1 ? 0 : cursorLineIndex - 1;

  // Get the 3 visible lines
  const visibleLines = [
    textLines[viewportStartIndex],
    textLines[viewportStartIndex + 1],
    textLines[viewportStartIndex + 2],
  ];

  return (
    <div
      ref={widthRef}
      className="text-2xl my-6 leading-relaxed font-mono tracking-wider transition-opacity duration-300 ease-in-out text-left"
    >
      {/* Hidden probe: one rendered monospace glyph's width (incl. tracking),
          measured live so chars-per-line adapts to the font and zoom level. */}
      <span
        ref={charRef}
        aria-hidden="true"
        className="pointer-events-none absolute -z-10 select-none whitespace-pre opacity-0"
      >
        00000000000000000000
      </span>
      <div className="space-y-0 h-[5.25em] overflow-hidden flex flex-col items-start justify-center">
        {' '}
        {/* Fixed height for exactly 3 lines */}
        {visibleLines.map((line, lineIndex) => (
          <div
            key={`line-${viewportStartIndex}-${lineIndex}`}
            className="block h-[1.75em] overflow-hidden whitespace-nowrap"
          >
            {' '}
            {/* Each line is exactly 1.75em tall */}
            {line ? (
              line.tokens.map(token => {
                if (token.kind === 'overflow') {
                  // Extra (overflow) letter: always rendered as an error.
                  return (
                    <span
                      key={`overflow-${token.boundary}-${token.ordinal}`}
                      className="text-red-500 underline decoration-red-500 decoration-2 underline-offset-2 relative"
                    >
                      {token.char}
                    </span>
                  );
                }

                const absoluteIndex = token.origIndex;
                const charStyle = getCharStyle(
                  charStatus[absoluteIndex] || 'pending'
                );
                const displayChar = getDisplayChar(token.char, absoluteIndex);
                const isInError =
                  !/\s/.test(token.char) && isInErrorWord(absoluteIndex);
                const underlineClass = isInError
                  ? 'underline decoration-red-500 decoration-2 underline-offset-2'
                  : '';

                return (
                  <span
                    key={absoluteIndex}
                    className={`${charStyle} ${underlineClass} relative`}
                  >
                    {displayChar}
                    {absoluteIndex === cursorPosition && (
                      <span
                        className={`absolute left-0 h-6 top-[0.25rem] border-l-2 border-yellow-400 ${
                          !hasStartedTyping ? 'animate-blink' : ''
                        }`}
                      />
                    )}
                  </span>
                );
              })
            ) : (
              <>&nbsp;</>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
