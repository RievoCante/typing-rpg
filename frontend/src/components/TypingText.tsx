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

  // ADJUST THIS NUMBER to change max characters per line.
  // Must stay small enough that a full line fits the prompt container width;
  // otherwise the line visually wraps and its second row overflows the
  // fixed-height line box and overlaps the next line. At the desktop card
  // width (~665px) a monospace char with tracking-wider is ~15.7px, so 42
  // chars (~658px) is the safe max. The whitespace-nowrap on each line below
  // is the hard guard against overlap if a line ever exceeds the width.
  const MAX_CHARS_PER_LINE = 42;

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

  const textLines = buildTypingLines(text, overflow, MAX_CHARS_PER_LINE);

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
    <div className="text-2xl my-6 leading-relaxed font-mono tracking-wider transition-opacity duration-300 ease-in-out text-left">
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
