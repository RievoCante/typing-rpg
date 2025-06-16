import {
  useState,
  useEffect,
  type KeyboardEvent,
  useRef,
  useCallback,
} from 'react';
import ModeSelector from './ModeSelector';
import TypingText, { type CharStatus } from './TypingText';
import { generateText } from '../utils/textGenerator';
import { calculateXP } from '../utils/calculateXP';
import WPMDisplay from './WPMDisplay';

interface TypingInterfaceProps {
  currentMode: 'daily' | 'endless';
  onModeChange: (mode: 'daily' | 'endless') => void;
  addXp: (amount: number) => void;
}

export default function TypingInterface({
  currentMode,
  onModeChange,
  addXp,
}: TypingInterfaceProps) {
  const originalTextRef = useRef<string>('');
  const [textToType, setTextToType] = useState<string>(''); // DISPLAY text
  const [charStatus, setCharStatus] = useState<CharStatus[]>([]);
  const [typedChars, setTypedChars] = useState<(string | null)[]>([]);
  const [originIndices, setOriginIndices] = useState<(number | null)[]>([]); // Maps display index to original index
  const [cursorPosition, setCursorPosition] = useState(0);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [hasStartedTyping, setHasStartedTyping] = useState<boolean>(false);
  const [wpm, setWpm] = useState<number>(0);
  const [isCalculatingWpm, setIsCalculatingWpm] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement>(null);

  const fetchNewText = useCallback(() => {
    const newText = generateText(currentMode);
    originalTextRef.current = newText;
    setTextToType(newText);
    setCharStatus(Array(newText.length).fill('pending'));
    setTypedChars(Array(newText.length).fill(null));
    setOriginIndices(Array.from({ length: newText.length }, (_, i) => i));
    setCursorPosition(0);
    setStartTime(null);
    setHasStartedTyping(false);
    setIsCalculatingWpm(false);
    if (containerRef.current) {
      containerRef.current.focus();
    }
  }, [currentMode]);

  useEffect(() => {
    fetchNewText();
  }, [fetchNewText]);

  const handleCompletion = useCallback(() => {
    const originalText = originalTextRef.current;
    let incorrectWordCount = 0;
    // WPM Calculation
    if (hasStartedTyping && startTime && originalText.length > 0) {
      let correctlyTypedWordsCount = 0;
      let totalCharsInCorrectWords = 0;

      const elapsedSeconds = (Date.now() - startTime) / 1000;
      const elapsedTimeInMinutes = elapsedSeconds / 60;

      const wordRegex = /\S+/g;
      let match;

      while ((match = wordRegex.exec(originalText)) !== null) {
        const word = match[0];
        const wordStartIndex = match.index;
        const wordEndIndex = wordStartIndex + word.length;

        const startDisplayIndex = originIndices.indexOf(wordStartIndex);
        const endDisplayIndex = originIndices.lastIndexOf(wordEndIndex - 1);

        let isWordCorrect = true;
        if (startDisplayIndex === -1 || endDisplayIndex === -1) {
          isWordCorrect = false; // Word was deleted or mangled
        } else {
          // Check for extra characters inserted within the word's span in the display text
          for (let i = startDisplayIndex; i <= endDisplayIndex; i++) {
            if (originIndices[i] === null) {
              isWordCorrect = false;
              break;
            }
          }
          if (!isWordCorrect) {
            incorrectWordCount++;
            continue;
          }

          // Check if all characters of the original word are marked 'correct'
          for (let i = wordStartIndex; i < wordEndIndex; i++) {
            const displayIndex = originIndices.indexOf(i);
            if (displayIndex === -1 || charStatus[displayIndex] !== 'correct') {
              isWordCorrect = false;
              break;
            }
          }
        }

        if (isWordCorrect) {
          correctlyTypedWordsCount++;
          totalCharsInCorrectWords += word.length;
        } else {
          incorrectWordCount++;
        }
      }

      const calculatedWpm =
        elapsedTimeInMinutes > 0
          ? totalCharsInCorrectWords / 5 / elapsedTimeInMinutes
          : 0;
      setWpm(Math.round(calculatedWpm));
      setIsCalculatingWpm(false);

      console.log('--- Typing Stats ---');
      console.log(`Time taken: ${elapsedSeconds.toFixed(2)} seconds`);
      console.log(`Correctly typed words: ${correctlyTypedWordsCount}`);
      console.log(`Incorrectly typed words: ${incorrectWordCount}`);
      console.log(
        `Total characters in correct words: ${totalCharsInCorrectWords}`
      );
      console.log(`Calculated WPM (Corrected): ${Math.round(calculatedWpm)}`);
      console.log('--------------------');
    }

    // XP Logic
    if (currentMode === 'endless') {
      const rewardXp = calculateXP(currentMode, incorrectWordCount);
      addXp(rewardXp);
    } else if (currentMode === 'daily') {
      // NOTE: Daily mode logic
    }

    fetchNewText();
  }, [
    addXp,
    fetchNewText,
    charStatus,
    hasStartedTyping,
    startTime,
    originIndices,
    currentMode,
  ]);

  // This useEffect MUST be after handleCompletion is defined
  useEffect(() => {
    const originalText = originalTextRef.current;
    if (
      hasStartedTyping &&
      cursorPosition >= textToType.length &&
      originIndices.includes(originalText.length - 1) &&
      textToType.length > 0
    ) {
      handleCompletion();
    }
  }, [
    cursorPosition,
    textToType.length,
    hasStartedTyping,
    handleCompletion,
    originIndices,
  ]);

  const handleBackspace = useCallback(() => {
    if (cursorPosition > 0 && charStatus[cursorPosition - 1] !== 'locked') {
      const newCursorPosition = cursorPosition - 1;
      const wasExtraChar = originIndices[newCursorPosition] === null;

      if (wasExtraChar) {
        setTextToType(
          prev =>
            prev.slice(0, newCursorPosition) + prev.slice(newCursorPosition + 1)
        );
        setCharStatus(prev =>
          prev
            .slice(0, newCursorPosition)
            .concat(prev.slice(newCursorPosition + 1))
        );
        setTypedChars(prev =>
          prev
            .slice(0, newCursorPosition)
            .concat(prev.slice(newCursorPosition + 1))
        );
        setOriginIndices(prev =>
          prev
            .slice(0, newCursorPosition)
            .concat(prev.slice(newCursorPosition + 1))
        );
      } else {
        const newCharStatus = [...charStatus];
        newCharStatus[newCursorPosition] = 'pending';
        setCharStatus(newCharStatus);
        const newTypedChars = [...typedChars];
        newTypedChars[newCursorPosition] = null;
        setTypedChars(newTypedChars);
      }
      setCursorPosition(newCursorPosition);
    }
  }, [
    charStatus,
    cursorPosition,
    originIndices,
    typedChars,
    setTextToType,
    setCharStatus,
    setTypedChars,
    setOriginIndices,
    setCursorPosition,
  ]);

  const handleCharacter = useCallback(
    (key: string) => {
      if (!hasStartedTyping) {
        setStartTime(Date.now());
        setHasStartedTyping(true);
        console.log('start!');
      }

      const isAtEnd = cursorPosition >= textToType.length;
      const isCorrect =
        !isAtEnd &&
        key === textToType[cursorPosition] &&
        charStatus[cursorPosition] !== 'extra';

      if (isCorrect) {
        const newCharStatus = [...charStatus];
        newCharStatus[cursorPosition] = 'correct';
        setCharStatus(newCharStatus);
        const newTypedChars = [...typedChars];
        newTypedChars[cursorPosition] = key;
        setTypedChars(newTypedChars);
      } else {
        setTextToType(
          prev =>
            prev.slice(0, cursorPosition) + key + prev.slice(cursorPosition)
        );
        setCharStatus(prev =>
          prev
            .slice(0, cursorPosition)
            .concat('extra', prev.slice(cursorPosition))
        );
        setTypedChars(prev =>
          prev.slice(0, cursorPosition).concat(key, prev.slice(cursorPosition))
        );
        setOriginIndices(prev =>
          prev.slice(0, cursorPosition).concat(null, prev.slice(cursorPosition))
        );
      }

      setCursorPosition(prev => prev + 1);
    },
    [
      cursorPosition,
      charStatus,
      typedChars,
      textToType,
      hasStartedTyping,
      setStartTime,
      setHasStartedTyping,
      setTextToType,
      setCharStatus,
      setTypedChars,
      setOriginIndices,
      setCursorPosition,
    ]
  );

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const { key } = e;

    if (key === ' ') {
      // Lock the preceding word if it was typed 100% correctly.
      let wordStartIndex = cursorPosition - 1;
      while (wordStartIndex >= 0 && !/\s/.test(textToType[wordStartIndex])) {
        wordStartIndex--;
      }
      wordStartIndex++; // Move to the first character of the word.

      if (wordStartIndex < cursorPosition) {
        const wordToCheck = textToType.substring(
          wordStartIndex,
          cursorPosition
        );
        const isWordFullyCorrect =
          wordToCheck.length > 0 &&
          wordToCheck.split('').every((_, index) => {
            return charStatus[wordStartIndex + index] === 'correct';
          });

        if (isWordFullyCorrect) {
          const newCharStatus = [...charStatus];
          for (let i = wordStartIndex; i < cursorPosition; i++) {
            newCharStatus[i] = 'locked';
          }
          setCharStatus(newCharStatus);
        }
      }

      // Handle space press (skip word or move cursor)
      if (
        cursorPosition < textToType.length &&
        !/\s/.test(textToType[cursorPosition])
      ) {
        // Premature spacebar press, skip the rest of the word
        let endOfWordIndex = cursorPosition;
        while (
          endOfWordIndex < textToType.length &&
          !/\s/.test(textToType[endOfWordIndex])
        ) {
          endOfWordIndex++;
        }

        // Create a new status array to avoid stale state from the locking logic above
        setCharStatus(prevStatus => {
          const newStatus = [...prevStatus];
          for (let i = cursorPosition; i < endOfWordIndex; i++) {
            if (originIndices[i] !== null) newStatus[i] = 'skipped';
          }
          return newStatus;
        });

        let nextWordStartIndex = endOfWordIndex;
        while (
          nextWordStartIndex < textToType.length &&
          /\s/.test(textToType[nextWordStartIndex])
        ) {
          nextWordStartIndex++;
        }
        setCursorPosition(nextWordStartIndex);
      } else {
        // Normal spacebar press
        handleCharacter(' ');
      }
      return;
    }

    if (key === 'Backspace') {
      if ((e.altKey || e.ctrlKey) && cursorPosition > 0) {
        // Word deletion logic
        if (charStatus[cursorPosition - 1] === 'locked') return;

        let currentWordStartIndex = cursorPosition - 1;
        while (
          currentWordStartIndex >= 0 &&
          /\s/.test(textToType[currentWordStartIndex])
        ) {
          currentWordStartIndex--;
        }
        while (
          currentWordStartIndex > 0 &&
          !/\s/.test(textToType[currentWordStartIndex - 1])
        ) {
          currentWordStartIndex--;
        }
        if (currentWordStartIndex < 0) currentWordStartIndex = 0;

        const newCharStatus = [...charStatus];
        const newTypedChars = [...typedChars];
        const newTextToTypeChars = textToType.split('');
        const newOriginIndices = [...originIndices];

        for (let i = cursorPosition - 1; i >= currentWordStartIndex; i--) {
          if (i < 0 || i >= newOriginIndices.length) continue;

          if (newOriginIndices[i] === null) {
            newTextToTypeChars.splice(i, 1);
            newCharStatus.splice(i, 1);
            newTypedChars.splice(i, 1);
            newOriginIndices.splice(i, 1);
          } else {
            newCharStatus[i] = 'pending';
            newTypedChars[i] = null;
          }
        }

        setTextToType(newTextToTypeChars.join(''));
        setCharStatus(newCharStatus);
        setTypedChars(newTypedChars);
        setOriginIndices(newOriginIndices);
        setCursorPosition(currentWordStartIndex);
      } else {
        // Normal single character backspace
        handleBackspace();
      }
      return;
    }

    if (key.length === 1) {
      handleCharacter(key);
    }
  };

  return (
    <div
      ref={containerRef}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      className="max-w-3xl mx-auto mt-8 p-8 bg-slate-800 rounded-lg shadow-xl text-white flex flex-col space-y-6 focus:outline-none"
    >
      <div className="flex justify-between items-center">
        <ModeSelector currentMode={currentMode} onModeChange={onModeChange} />
      </div>

      <TypingText
        text={textToType}
        charStatus={charStatus}
        typedChars={typedChars}
        cursorPosition={cursorPosition}
        hasStartedTyping={hasStartedTyping}
      />

      <div className="flex justify-between items-center pt-4">
        <WPMDisplay wpm={wpm} isCalculating={isCalculatingWpm} />
      </div>
    </div>
  );
}
