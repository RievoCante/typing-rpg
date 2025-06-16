export type CharStatus =
  | 'pending'
  | 'correct'
  | 'incorrect'
  | 'skipped'
  | 'extra'
  | 'locked';

interface Segment {
  type: 'word' | 'space';
  content: string;
  startIndex: number;
  underline?: boolean; // Optional because it's only relevant for words
}

interface TypingTextProps {
  text: string;
  charStatus: CharStatus[];
  typedChars: (string | null)[]; // User's actual keystrokes
  cursorPosition: number;
  hasStartedTyping: boolean; // New prop
}

export default function TypingText({
  text,
  charStatus,
  typedChars,
  cursorPosition,
  hasStartedTyping, // Destructure new prop
}: TypingTextProps) {
  // TODO: Add loading state
  if (!text) {
    return (
      <div className="text-2xl text-slate-500 my-6 leading-relaxed font-mono whitespace-pre-wrap">
        Loading text...
      </div>
    );
  }

  // Helper to process text into segments (words and spaces with underline info)
  const segments: Segment[] = [];
  if (text.length > 0) {
    let currentSegment: Segment = {
      type: /\s/.test(text[0]) ? 'space' : 'word',
      content: '',
      startIndex: 0,
    };
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const isSpace = /\s/.test(char);
      const currentTypeIsSpace = currentSegment.type === 'space';

      if (isSpace !== currentTypeIsSpace) {
        segments.push(currentSegment);
        currentSegment = {
          type: isSpace ? 'space' : 'word',
          content: '',
          startIndex: i,
        };
      }
      currentSegment.content += char;
    }
    segments.push(currentSegment);

    segments.forEach((segment: Segment) => {
      // Explicitly type segment here for clarity
      if (segment.type === 'word') {
        segment.underline = false;
        for (let i = 0; i < segment.content.length; i++) {
          const charIdxInOriginalText = segment.startIndex + i;
          if (
            charIdxInOriginalText < charStatus.length &&
            (charStatus[charIdxInOriginalText] === 'incorrect' ||
              charStatus[charIdxInOriginalText] === 'skipped' ||
              charStatus[charIdxInOriginalText] === 'extra')
          ) {
            segment.underline = true;
            break;
          }
        }
      }
    });
  }

  return (
    <div className="text-2xl my-6 leading-relaxed font-mono tracking-wider whitespace-pre-wrap">
      {segments.map((segment, segmentIndex) => {
        const segmentKey = `segment-${segmentIndex}`;
        if (segment.type === 'word') {
          const wordSpanClass = segment.underline
            ? 'underline decoration-red-500 decoration-2 underline-offset-2'
            : '';
          return (
            <span key={segmentKey} className={wordSpanClass}>
              {
                // Note: The outer span is necessary for the underline to wrap correctly.
                segment.content.split('').map((char, charInWordIndex) => {
                  const originalIndex = segment.startIndex + charInWordIndex;
                  let charStyle = '';
                  switch (charStatus[originalIndex]) {
                    case 'locked':
                      charStyle = 'text-green-400'; // Locked-in correct words
                      break;
                    case 'correct':
                      charStyle = 'text-slate-100';
                      break;
                    case 'incorrect':
                    case 'extra':
                      charStyle = 'text-red-500';
                      break;
                    case 'skipped':
                      charStyle = 'text-slate-400'; // Style for skipped characters
                      break;
                    case 'pending':
                    default:
                      charStyle = 'text-slate-500';
                      break;
                  }

                  let charToDisplay = char;
                  if (
                    charStatus[originalIndex] === 'incorrect' ||
                    charStatus[originalIndex] === 'extra'
                  ) {
                    if (typedChars[originalIndex] === ' ' && char !== ' ') {
                      charToDisplay = char;
                    } else if (typedChars[originalIndex]) {
                      charToDisplay = typedChars[originalIndex];
                    }
                  } else if (charStatus[originalIndex] === 'skipped') {
                    charToDisplay = char; // Display original character for skipped ones
                  }

                  return (
                    <span
                      key={`char-${originalIndex}`}
                      className={`${charStyle} relative`}
                    >
                      {charToDisplay}
                      {originalIndex === cursorPosition && (
                        <span
                          className={`absolute left-0 h-6 top-[0.25rem] border-l-2 border-yellow-400 ${
                            !hasStartedTyping ? 'animate-blink' : ''
                          }`}
                        />
                      )}
                    </span>
                  );
                })
              }
            </span>
          );
        }
        // Segment is a space
        const spaceChars = segment.content
          .split('')
          .map((spaceChar, spaceInSegmentIndex) => {
            const originalIndex = segment.startIndex + spaceInSegmentIndex;
            let charStyle = 'text-slate-500'; // Default for pending spaces
            if (charStatus[originalIndex] === 'correct') {
              charStyle = 'text-slate-100';
            }

            return (
              <span
                key={`char-${originalIndex}`}
                className={`${charStyle} relative`}
              >
                {spaceChar}
                {originalIndex === cursorPosition && (
                  <span
                    className={`absolute left-0 h-6 top-[0.25rem] border-l-2 border-yellow-400 ${
                      !hasStartedTyping ? 'animate-blink' : ''
                    }`}
                  />
                )}
              </span>
            );
          });
        return <span key={segmentKey}>{spaceChars}</span>;
      })}
    </div>
  );
}
