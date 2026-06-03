import { useState, useCallback } from 'react';
import {
  initTypingState,
  inputChar,
  backspace as backspaceReducer,
  wordDeletion as wordDeletionReducer,
  spaceBar as spaceBarReducer,
  type TypingState,
  type TypingEvents,
} from '../utils/typingReducer';

interface UseTypingMechanicsProps {
  text: string;
  onCharacterInput?: (key: string) => void;
  onWordCompleted?: () => void;
  onWordMistake?: () => void;
  // Fires once when a character key is typed that does not match the expected
  // character — for raid mode, used to signal a mistake to the server. Also
  // fires for overflow keystrokes (extra letters typed past a word's end).
  onCharacterMistake?: () => void;
  // Fires once per character keystroke reaching the engine (incl. overflow).
  // `correct` is true when the typed char matched, false otherwise.
  onKeypress?: (correct: boolean) => void;
}

export const useTypingMechanics = ({
  text,
  onCharacterInput,
  onWordCompleted,
  onWordMistake,
  onCharacterMistake,
  onKeypress,
}: UseTypingMechanicsProps) => {
  const [state, setState] = useState<TypingState>(() =>
    initTypingState(text.length)
  );

  // Fire callbacks based on events returned by the pure reducer. Kept outside
  // the setState updater so side effects don't run twice under StrictMode.
  const dispatchEvents = useCallback(
    (events: TypingEvents) => {
      if (events.characterInput !== undefined) {
        onCharacterInput?.(events.characterInput);
        onKeypress?.(!events.characterMistake);
      }
      if (events.characterMistake) onCharacterMistake?.();
      if (events.wordCompleted) onWordCompleted?.();
      if (events.wordMistake) onWordMistake?.();
    },
    [onCharacterInput, onCharacterMistake, onWordCompleted, onWordMistake, onKeypress]
  );

  const resetTypingState = useCallback(() => {
    setState(initTypingState(text.length));
  }, [text.length]);

  const handleCharacterInput = useCallback(
    (key: string) => {
      const { state: next, events } = inputChar(state, text, key);
      dispatchEvents(events);
      setState(next);
    },
    [state, text, dispatchEvents]
  );

  const handleBackspace = useCallback(() => {
    setState(backspaceReducer(state).state);
  }, [state]);

  const handleWordDeletion = useCallback(() => {
    setState(wordDeletionReducer(state, text).state);
  }, [state, text]);

  const handleSpaceBar = useCallback(() => {
    const { state: next, events } = spaceBarReducer(state, text);
    dispatchEvents(events);
    setState(next);
  }, [state, text, dispatchEvents]);

  return {
    // State
    charStatus: state.charStatus,
    typedChars: state.typedChars,
    cursorPosition: state.cursorPosition,
    overflow: state.overflow,

    // Actions
    handleCharacterInput,
    handleBackspace,
    handleWordDeletion,
    handleSpaceBar,
    resetTypingState,
  };
};
