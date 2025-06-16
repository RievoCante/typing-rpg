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
  // Core state - text never changes after initialization
  const [text, setText] = useState<string>('');
  const [charStatus, setCharStatus] = useState<CharStatus[]>([]);
  const [typedChars, setTypedChars] = useState<(string | null)[]>([]);
  const [cursorPosition, setCursorPosition] = useState(0);
  
  // Timing and stats
  const [startTime, setStartTime] = useState<number | null>(null);
  const [hasStartedTyping, setHasStartedTyping] = useState<boolean>(false);
  const [wpm, setWpm] = useState<number>(0);

  const containerRef = useRef<HTMLDivElement>(null);

  // Initialize new text - this is the only place where text changes
  const initializeNewText = useCallback(() => {
    const newText = generateText(currentMode);
    setText(newText);
    setCharStatus(Array(newText.length).fill('pending'));
    setTypedChars(Array(newText.length).fill(null));
    setCursorPosition(0);
    setStartTime(null);
    setHasStartedTyping(false);
    // Don't reset WPM here - keep the last session's WPM visible
    
    if (containerRef.current) {
      containerRef.current.focus();
    }
  }, [currentMode]);

  useEffect(() => {
    initializeNewText();
  }, [initializeNewText]);

  // Calculate WPM and handle completion
  const handleCompletion = useCallback(() => {
    if (!hasStartedTyping || !startTime || text.length === 0) {
      initializeNewText();
      return;
    }

    const elapsedMinutes = (Date.now() - startTime) / 60000;
    let correctWords = 0;
    let totalCharsIncludingSpaces = 0;
    let incorrectWords = 0;

    // Use regex to find words with their positions in the original text
    const wordMatches = [...text.matchAll(/\S+/g)];

    for (const match of wordMatches) {
      const word = match[0];
      const wordStartIndex = match.index!;
      const wordEndIndex = wordStartIndex + word.length;
      
      let isWordCorrect = true;
      
      // Check if all characters in this word are correct or locked
      for (let i = wordStartIndex; i < wordEndIndex; i++) {
        const status = charStatus[i];
        if (status !== 'correct' && status !== 'locked') {
          isWordCorrect = false;
          break;
        }
      }

      if (isWordCorrect) {
        correctWords++;
        // Add word length + 1 space (except for last word)
        totalCharsIncludingSpaces += word.length;
        
        // Add space after word if there's a space character following it
        if (wordEndIndex < text.length && text[wordEndIndex] === ' ') {
          totalCharsIncludingSpaces += 1;
        }
      } else {
        incorrectWords++;
      }
    }

    const calculatedWpm = elapsedMinutes > 0 ? totalCharsIncludingSpaces / 5 / elapsedMinutes : 0;
    const finalWpm = Math.round(calculatedWpm);
    
    // Save the final WPM to display until next session starts
    setWpm(finalWpm);

    // Add XP for endless mode
    if (currentMode === 'endless') {
      const rewardXp = calculateXP(currentMode, incorrectWords);
      addXp(rewardXp);
    }

    console.log('--- Completion Stats ---');
    console.log(`Correct words: ${correctWords}, Incorrect: ${incorrectWords}`);
    console.log(`Total chars including spaces: ${totalCharsIncludingSpaces}`);
    console.log(`Elapsed minutes: ${elapsedMinutes.toFixed(2)}`);
    console.log(`WPM: ${finalWpm}`);
    console.log('----------------------');

    // Load new text
    initializeNewText();
  }, [text, charStatus, hasStartedTyping, startTime, currentMode, addXp, initializeNewText]);

  // Check for completion
  useEffect(() => {
    if (hasStartedTyping && cursorPosition >= text.length) {
      handleCompletion();
    }
  }, [cursorPosition, text.length, hasStartedTyping, handleCompletion]);

  // Handle character input
  const handleCharacterInput = useCallback((key: string) => {
    if (!hasStartedTyping) {
      // Reset WPM only when starting a new session
      setWpm(0);
      setStartTime(Date.now());
      setHasStartedTyping(true);
    }

    if (cursorPosition >= text.length) return;

    const isCorrect = key === text[cursorPosition];
    const newCharStatus = [...charStatus];
    const newTypedChars = [...typedChars];

    if (isCorrect) {
      newCharStatus[cursorPosition] = 'correct';
    } else {
      newCharStatus[cursorPosition] = 'incorrect';
    }

    newTypedChars[cursorPosition] = key;
    setCharStatus(newCharStatus);
    setTypedChars(newTypedChars);
    setCursorPosition(prev => prev + 1);
  }, [cursorPosition, text, charStatus, typedChars, hasStartedTyping]);

  // Handle backspace
  const handleBackspace = useCallback(() => {
    if (cursorPosition <= 0) return;

    const newPosition = cursorPosition - 1;
    const status = charStatus[newPosition];

    // Don't allow deleting locked characters
    if (status === 'locked') return;

    const newCharStatus = [...charStatus];
    const newTypedChars = [...typedChars];

    newCharStatus[newPosition] = 'pending';
    newTypedChars[newPosition] = null;

    setCharStatus(newCharStatus);
    setTypedChars(newTypedChars);
    setCursorPosition(newPosition);
  }, [cursorPosition, charStatus, typedChars]);

  // Handle word deletion (Ctrl/Alt + Backspace)
  const handleWordDeletion = useCallback(() => {
    if (cursorPosition <= 0) return;

    let newPosition = cursorPosition - 1;

    // Skip spaces
    while (newPosition >= 0 && /\s/.test(text[newPosition])) {
      newPosition--;
    }

    // Skip word characters
    while (newPosition >= 0 && !/\s/.test(text[newPosition])) {
      newPosition--;
    }

    newPosition++; // Move to start of word

    const newCharStatus = [...charStatus];
    const newTypedChars = [...typedChars];

    // Clear from newPosition to cursorPosition
    for (let i = newPosition; i < cursorPosition; i++) {
      if (charStatus[i] !== 'locked') {
        newCharStatus[i] = 'pending';
        newTypedChars[i] = null;
      }
    }

    setCharStatus(newCharStatus);
    setTypedChars(newTypedChars);
    setCursorPosition(newPosition);
  }, [cursorPosition, text, charStatus, typedChars]);

  // Handle space bar (with word locking and skipping)
  const handleSpaceBar = useCallback(() => {
    // First, try to lock the current word if it's correct
    let wordStart = cursorPosition - 1;
    while (wordStart >= 0 && !/\s/.test(text[wordStart])) {
      wordStart--;
    }
    wordStart++;

    if (wordStart < cursorPosition) {
      // Check if the word is completely correct
      let isWordCorrect = true;
      for (let i = wordStart; i < cursorPosition; i++) {
        if (charStatus[i] !== 'correct') {
          isWordCorrect = false;
          break;
        }
      }

      if (isWordCorrect) {
        const newCharStatus = [...charStatus];
        for (let i = wordStart; i < cursorPosition; i++) {
          newCharStatus[i] = 'locked';
        }
        setCharStatus(newCharStatus);
      }
    }

    // Handle space input or word skipping
    if (cursorPosition < text.length && text[cursorPosition] === ' ') {
      // Normal space - just input it
      handleCharacterInput(' ');
    } else if (cursorPosition < text.length) {
      // Skip to next word
      let nextPos = cursorPosition;
      
      // Skip remaining characters in current word
      while (nextPos < text.length && !/\s/.test(text[nextPos])) {
        if (charStatus[nextPos] === 'pending') {
          const newCharStatus = [...charStatus];
          newCharStatus[nextPos] = 'skipped';
          setCharStatus(newCharStatus);
        }
        nextPos++;
      }

      // Skip spaces to get to next word
      while (nextPos < text.length && /\s/.test(text[nextPos])) {
        nextPos++;
      }

      setCursorPosition(nextPos);
    }
  }, [cursorPosition, text, charStatus, handleCharacterInput]);

  // Main keyboard handler
  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    e.preventDefault();

    const { key } = e;

    if (key === ' ') {
      handleSpaceBar();
    } else if (key === 'Backspace') {
      if (e.ctrlKey || e.altKey) {
        handleWordDeletion();
      } else {
        handleBackspace();
      }
    } else if (key.length === 1) {
      handleCharacterInput(key);
    }
  };

  // Calculate current WPM in real-time
  const calculateCurrentWpm = useCallback(() => {
    if (!hasStartedTyping || !startTime) return 0;

    const elapsedMinutes = (Date.now() - startTime) / 60000;
    if (elapsedMinutes === 0) return 0;

    // Count completed words (locked words)
    const wordMatches = [...text.matchAll(/\S+/g)];
    let totalCharsIncludingSpaces = 0;

    for (const match of wordMatches) {
      const word = match[0];
      const wordStartIndex = match.index!;
      const wordEndIndex = wordStartIndex + word.length;
      
      let isWordCompleted = true;
      
      // Check if all characters in this word are locked
      for (let i = wordStartIndex; i < wordEndIndex; i++) {
        if (charStatus[i] !== 'locked') {
          isWordCompleted = false;
          break;
        }
      }

      if (isWordCompleted) {
        // Add word length + 1 space (except for last word)
        totalCharsIncludingSpaces += word.length;
        
        // Add space after word if there's a space character following it
        if (wordEndIndex < text.length && text[wordEndIndex] === ' ') {
          totalCharsIncludingSpaces += 1;
        }
      }
    }

    return Math.round(totalCharsIncludingSpaces / 5 / elapsedMinutes);
  }, [text, charStatus, hasStartedTyping, startTime]);

  // Update WPM in real-time (only during active typing, not after completion)
  useEffect(() => {
    if (hasStartedTyping && cursorPosition < text.length) {
      const currentWpm = calculateCurrentWpm();
      setWpm(currentWpm);
    }
  }, [charStatus, hasStartedTyping, calculateCurrentWpm, cursorPosition, text.length]);

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
        text={text}
        charStatus={charStatus}
        typedChars={typedChars}
        cursorPosition={cursorPosition}
        hasStartedTyping={hasStartedTyping}
      />

      <div className="flex justify-between items-center pt-4">
        <WPMDisplay wpm={wpm} isCalculating={false} />
      </div>
    </div>
  );
}
