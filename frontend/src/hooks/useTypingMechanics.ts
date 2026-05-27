import { useState, useCallback } from 'react';
import type { CharStatus } from '../components/TypingText';

interface UseTypingMechanicsProps {
  text: string;
  onCharacterInput?: (key: string) => void;
  onWordCompleted?: () => void;
  onWordMistake?: () => void;
  // Fires once when a character key is typed that does not match the expected
  // character — for raid mode, used to signal a mistake to the server. Only
  // fires when the cursor is not inside an already-locked region.
  onCharacterMistake?: () => void;
}

export const useTypingMechanics = ({
  text,
  onCharacterInput,
  onWordCompleted,
  onWordMistake,
  onCharacterMistake,
}: UseTypingMechanicsProps) => {
  const [charStatus, setCharStatus] = useState<CharStatus[]>([]);
  const [typedChars, setTypedChars] = useState<(string | null)[]>([]);
  const [cursorPosition, setCursorPosition] = useState(0);

  // Reset typing state for new text
  const resetTypingState = useCallback(() => {
    setCharStatus(Array(text.length).fill('pending'));
    setTypedChars(Array(text.length).fill(null));
    setCursorPosition(0);
  }, [text.length]);

  // Handle character input
  const handleCharacterInput = useCallback(
    (key: string) => {
      // Call optional callback
      onCharacterInput?.(key);

      // Prevent typing beyond the text length
      if (cursorPosition >= text.length) return;

      const isCorrect = key === text[cursorPosition];
      const newCharStatus = [...charStatus];
      const newTypedChars = [...typedChars];

      if (isCorrect) {
        newCharStatus[cursorPosition] = 'correct';
      } else {
        newCharStatus[cursorPosition] = 'incorrect';
        // Signal a mistake to consumers (e.g. raid mode reports to the server).
        // The locked-word mechanic already prevents the cursor from advancing
        // into a locked region, so anything reaching here is a fresh mistake.
        onCharacterMistake?.();
      }

      newTypedChars[cursorPosition] = key;
      setCharStatus(newCharStatus);
      setTypedChars(newTypedChars);
      setCursorPosition(prev => prev + 1);
    },
    [
      cursorPosition,
      text,
      charStatus,
      typedChars,
      onCharacterInput,
      onCharacterMistake,
    ]
  );

  // Handle backspace
  const handleBackspace = useCallback(() => {
    if (cursorPosition <= 0) return;

    const previousCharStatus = charStatus[cursorPosition - 1];

    // Don't allow backspace if the previous character is locked
    if (previousCharStatus === 'locked') return;

    const newPosition = cursorPosition - 1;
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

    // Skip word characters, but stop if we hit a locked character
    while (newPosition >= 0 && !/\s/.test(text[newPosition])) {
      if (charStatus[newPosition] === 'locked') {
        // If we hit a locked character, don't delete anything and return
        return;
      }
      newPosition--;
    }

    newPosition++; // Move to start of word

    // Double-check: don't delete if any character in the range is locked
    for (let i = newPosition; i < cursorPosition; i++) {
      if (charStatus[i] === 'locked') {
        return;
      }
    }

    const newCharStatus = [...charStatus];
    const newTypedChars = [...typedChars];

    // Clear from newPosition to cursorPosition
    for (let i = newPosition; i < cursorPosition; i++) {
      newCharStatus[i] = 'pending';
      newTypedChars[i] = null;
    }

    setCharStatus(newCharStatus);
    setTypedChars(newTypedChars);
    setCursorPosition(newPosition);
  }, [cursorPosition, text, charStatus, typedChars]);

  // Handle space bar (with word locking and skipping)
  const handleSpaceBar = useCallback(() => {
    if (cursorPosition >= text.length) return;

    // Mid-word space: skip the rest of the current word and count it as a
    // word mistake. Lock the boundary space so the player can't backspace
    // into the skipped chars.
    if (text[cursorPosition] !== ' ') {
      let nextSpace = cursorPosition;
      while (nextSpace < text.length && text[nextSpace] !== ' ') {
        nextSpace++;
      }
      if (nextSpace >= text.length) return; // No following word — nothing to skip to.

      const newCharStatus = [...charStatus];
      const newTypedChars = [...typedChars];
      newCharStatus[nextSpace] = 'locked';
      newTypedChars[nextSpace] = ' ';
      setCharStatus(newCharStatus);
      setTypedChars(newTypedChars);
      setCursorPosition(nextSpace + 1);
      onWordMistake?.();
      return;
    }

    // Find the start of the word right before the cursor.
    let wordStart = cursorPosition - 1;
    while (wordStart >= 0 && !/\s/.test(text[wordStart])) {
      wordStart--;
    }
    wordStart++; // Move cursor to the beginning of the word.

    // Check if the word is fully typed and correct.
    let isWordCorrect = true;
    if (wordStart >= cursorPosition) {
      isWordCorrect = false; // No word before the cursor (e.g. "  ")
    } else {
      for (let i = wordStart; i < cursorPosition; i++) {
        if (charStatus[i] !== 'correct') {
          isWordCorrect = false;
          break;
        }
      }
    }

    // If the word is correct, lock it and the space.
    if (isWordCorrect) {
      const newCharStatus = [...charStatus];
      for (let i = wordStart; i < cursorPosition; i++) {
        newCharStatus[i] = 'locked';
      }
      // IMPORTANT: Lock the space character itself.
      newCharStatus[cursorPosition] = 'locked';
      setCharStatus(newCharStatus);

      // Mark the space as typed correctly.
      const newTypedChars = [...typedChars];
      newTypedChars[cursorPosition] = ' ';
      setTypedChars(newTypedChars);

      // Notify that a word was completed.
      onWordCompleted?.();

      // Move cursor forward.
      setCursorPosition(prev => prev + 1);
    } else {
      // If the word is incorrect, monster attacks!
      onWordMistake?.();
      // Treat the space as an incorrect character for visual feedback.
      handleCharacterInput(' ');
    }
  }, [
    cursorPosition,
    text,
    charStatus,
    typedChars,
    onWordCompleted,
    onWordMistake,
    handleCharacterInput,
  ]);

  return {
    // State
    charStatus,
    typedChars,
    cursorPosition,

    // Actions
    handleCharacterInput,
    handleBackspace,
    handleWordDeletion,
    handleSpaceBar,
    resetTypingState,
  };
};
