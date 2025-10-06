import { useThemeContext } from '../hooks/useThemeContext';

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
}

export default function TypingText({
  text,
  charStatus,
  typedChars,
  cursorPosition,
  hasStartedTyping,
}: TypingTextProps) {
  const { theme } = useThemeContext();

  // ADJUST THIS NUMBER to change max characters per line
  const MAX_CHARS_PER_LINE = 43;

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

  // Helper function to check if a character is part of a word with errors
  const isInErrorWord = (index: number): boolean => {
    // Find word boundaries
    let wordStart = index;
    let wordEnd = index;

    // Find start of word
    while (wordStart > 0 && !/\s/.test(text[wordStart - 1])) {
      wordStart--;
    }

    // Find end of word
    while (wordEnd < text.length - 1 && !/\s/.test(text[wordEnd + 1])) {
      wordEnd++;
    }

    // Check if any character in this word has errors
    for (let i = wordStart; i <= wordEnd; i++) {
      const status = charStatus[i];
      if (status === 'incorrect' || status === 'skipped') {
        return true;
      }
    }

    return false;
  };

  // Split text into fixed lines based on character limit (word-aware)
  const createFixedLines = () => {
    const lines: { chars: string[]; startIndex: number }[] = [];
    const words = text.split(/(\s+)/); // Split by spaces but keep the spaces

    let currentLineChars: string[] = [];
    let currentLineStartIndex = 0;
    let currentCharIndex = 0;

    for (const word of words) {
      // Check if adding this word would exceed the line limit
      const wouldExceed =
        currentLineChars.length + word.length > MAX_CHARS_PER_LINE;

      if (wouldExceed && currentLineChars.length > 0) {
        // Start a new line with this word
        lines.push({
          chars: [...currentLineChars],
          startIndex: currentLineStartIndex,
        });

        // Start new line
        currentLineChars = [];
        currentLineStartIndex = currentCharIndex;
      }

      // Add the word to current line
      for (const char of word) {
        currentLineChars.push(char);
      }

      currentCharIndex += word.length;
    }

    // Add the last line if it has content
    if (currentLineChars.length > 0) {
      lines.push({
        chars: currentLineChars,
        startIndex: currentLineStartIndex,
      });
    }

    return lines;
  };

  const textLines = createFixedLines();

  return (
    <div className="text-2xl my-6 leading-relaxed font-mono tracking-wider">
      <div className="space-y-0">
        {textLines.map((line, lineIndex) => (
          <div key={lineIndex} className="block">
            {line.chars.map((char, charIndexInLine) => {
              const absoluteIndex = line.startIndex + charIndexInLine;
              const charStyle = getCharStyle(
                charStatus[absoluteIndex] || 'pending'
              );
              const displayChar = getDisplayChar(char, absoluteIndex);
              const isInError =
                !/\s/.test(char) && isInErrorWord(absoluteIndex);
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
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
