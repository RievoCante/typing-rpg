import type { CharStatus } from '../components/TypingText';

/**
 * Pure, framework-agnostic typing engine.
 *
 * State is a plain object so it can be unit-tested in a node environment.
 * `useTypingMechanics` is a thin React shell that holds this state and fires
 * callbacks based on the returned {@link TypingEvents}.
 *
 * Overflow model (Monkeytype-style): when the cursor sits on a word-boundary
 * space (`text[cursor] === ' '`) and the player types a non-space character,
 * the extra letter is appended to `overflow[cursor]` instead of advancing the
 * cursor into the following word. The active word grows (pushing the rest of
 * the prompt right and wrapping), and the word is scored as incorrect.
 */

export interface TypingState {
  charStatus: CharStatus[];
  typedChars: (string | null)[];
  cursorPosition: number;
  /** Sparse map: word-boundary space index -> extra letters typed there. */
  overflow: Record<number, string[]>;
}

export interface TypingEvents {
  /** A character key reached the engine (fired for every non-space input). */
  characterInput?: string;
  /** A fresh per-character mistake (wrong char or an overflow keystroke). */
  characterMistake?: boolean;
  /** A correct word was locked. */
  wordCompleted?: boolean;
  /** A word was committed incorrectly (wrong chars, skipped, or overflow). */
  wordMistake?: boolean;
}

/** Maximum extra characters retained per word boundary, to bound layout. */
export const MAX_OVERFLOW = 20;

export const initTypingState = (textLength: number): TypingState => ({
  charStatus: Array(textLength).fill('pending'),
  typedChars: Array(textLength).fill(null),
  cursorPosition: 0,
  overflow: {},
});

export const inputChar = (
  state: TypingState,
  text: string,
  key: string
): { state: TypingState; events: TypingEvents } => {
  const events: TypingEvents = { characterInput: key };
  const { cursorPosition } = state;

  // Cannot type past the end of the text (completion fires at text.length).
  if (cursorPosition >= text.length) {
    return { state, events };
  }

  // Overflow: sitting on a word-boundary space and typing a letter appends an
  // extra character to the active word rather than advancing into the next.
  if (text[cursorPosition] === ' ' && key !== ' ') {
    const existing = state.overflow[cursorPosition] ?? [];
    if (existing.length >= MAX_OVERFLOW) {
      return { state, events }; // cap reached — ignore further overflow
    }
    events.characterMistake = true;
    return {
      state: {
        ...state,
        overflow: {
          ...state.overflow,
          [cursorPosition]: [...existing, key],
        },
      },
      events,
    };
  }

  const isCorrect = key === text[cursorPosition];
  const charStatus = [...state.charStatus];
  const typedChars = [...state.typedChars];
  charStatus[cursorPosition] = isCorrect ? 'correct' : 'incorrect';
  typedChars[cursorPosition] = key;
  if (!isCorrect) events.characterMistake = true;

  return {
    state: {
      ...state,
      charStatus,
      typedChars,
      cursorPosition: cursorPosition + 1,
    },
    events,
  };
};

export const backspace = (state: TypingState): { state: TypingState } => {
  const { cursorPosition } = state;
  if (cursorPosition <= 0) return { state };

  // Remove overflow characters at the current boundary first.
  const overflowHere = state.overflow[cursorPosition];
  if (overflowHere && overflowHere.length > 0) {
    const next = overflowHere.slice(0, -1);
    const overflow = { ...state.overflow };
    if (next.length === 0) delete overflow[cursorPosition];
    else overflow[cursorPosition] = next;
    return { state: { ...state, overflow } };
  }

  // Don't delete a locked character.
  if (state.charStatus[cursorPosition - 1] === 'locked') return { state };

  const newPosition = cursorPosition - 1;
  const charStatus = [...state.charStatus];
  const typedChars = [...state.typedChars];
  charStatus[newPosition] = 'pending';
  typedChars[newPosition] = null;

  return {
    state: { ...state, charStatus, typedChars, cursorPosition: newPosition },
  };
};

export const wordDeletion = (
  state: TypingState,
  text: string
): { state: TypingState } => {
  const { cursorPosition } = state;
  if (cursorPosition <= 0) return { state };

  const overflow = { ...state.overflow };
  // Clear any overflow on the boundary we start from (it belongs to this word).
  let clearedOverflow = false;
  if (overflow[cursorPosition]) {
    delete overflow[cursorPosition];
    clearedOverflow = true;
  }

  let newPosition = cursorPosition - 1;
  while (newPosition >= 0 && /\s/.test(text[newPosition])) newPosition--;
  while (newPosition >= 0 && !/\s/.test(text[newPosition])) {
    if (state.charStatus[newPosition] === 'locked') {
      // Hit a locked char — keep any overflow clearing but delete nothing else.
      return clearedOverflow ? { state: { ...state, overflow } } : { state };
    }
    newPosition--;
  }
  newPosition++;

  for (let i = newPosition; i < cursorPosition; i++) {
    if (state.charStatus[i] === 'locked') {
      return clearedOverflow ? { state: { ...state, overflow } } : { state };
    }
  }

  const charStatus = [...state.charStatus];
  const typedChars = [...state.typedChars];
  for (let i = newPosition; i < cursorPosition; i++) {
    charStatus[i] = 'pending';
    typedChars[i] = null;
  }

  return {
    state: {
      ...state,
      charStatus,
      typedChars,
      overflow,
      cursorPosition: newPosition,
    },
  };
};

export const spaceBar = (
  state: TypingState,
  text: string
): { state: TypingState; events: TypingEvents } => {
  const events: TypingEvents = {};
  const { cursorPosition } = state;
  if (cursorPosition >= text.length) return { state, events };

  // Mid-word space: skip the rest of the current word and count it as a word
  // mistake. Lock the boundary space so the skipped chars can't be edited.
  if (text[cursorPosition] !== ' ') {
    let nextSpace = cursorPosition;
    while (nextSpace < text.length && text[nextSpace] !== ' ') nextSpace++;
    if (nextSpace >= text.length) return { state, events }; // nothing to skip to

    const charStatus = [...state.charStatus];
    const typedChars = [...state.typedChars];
    charStatus[nextSpace] = 'locked';
    typedChars[nextSpace] = ' ';
    events.wordMistake = true;
    return {
      state: {
        ...state,
        charStatus,
        typedChars,
        cursorPosition: nextSpace + 1,
      },
      events,
    };
  }

  // On a word-boundary space. If the word carries overflow it is incorrect.
  if ((state.overflow[cursorPosition]?.length ?? 0) > 0) {
    const charStatus = [...state.charStatus];
    const typedChars = [...state.typedChars];
    charStatus[cursorPosition] = 'locked';
    typedChars[cursorPosition] = ' ';
    events.wordMistake = true;
    return {
      state: {
        ...state,
        charStatus,
        typedChars,
        cursorPosition: cursorPosition + 1,
      },
      events,
    };
  }

  // Find the start of the word immediately before the cursor.
  let wordStart = cursorPosition - 1;
  while (wordStart >= 0 && !/\s/.test(text[wordStart])) wordStart--;
  wordStart++;

  let isWordCorrect = true;
  if (wordStart >= cursorPosition) {
    isWordCorrect = false; // no word before the cursor (e.g. "  ")
  } else {
    for (let i = wordStart; i < cursorPosition; i++) {
      if (state.charStatus[i] !== 'correct') {
        isWordCorrect = false;
        break;
      }
    }
  }

  if (isWordCorrect) {
    const charStatus = [...state.charStatus];
    const typedChars = [...state.typedChars];
    for (let i = wordStart; i < cursorPosition; i++) charStatus[i] = 'locked';
    charStatus[cursorPosition] = 'locked';
    typedChars[cursorPosition] = ' ';
    events.wordCompleted = true;
    return {
      state: {
        ...state,
        charStatus,
        typedChars,
        cursorPosition: cursorPosition + 1,
      },
      events,
    };
  }

  // Incorrect base word: treat the space as an incorrect character.
  events.wordMistake = true;
  const { state: afterChar } = inputChar(state, text, ' ');
  return { state: afterChar, events };
};
