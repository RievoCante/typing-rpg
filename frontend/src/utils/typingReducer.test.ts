import { describe, it, expect } from 'vitest';
import {
  initTypingState,
  inputChar,
  backspace,
  wordDeletion,
  spaceBar,
  MAX_OVERFLOW,
  type TypingState,
} from './typingReducer';

const TEXT = 'to be free';
//            0123456789  -> "to"(0,1) " "(2) "be"(3,4) " "(5) "free"(6-9)

// Drive a fresh state by typing a sequence of single characters (no spaces).
const typeChars = (text: string, keys: string): TypingState => {
  let state = initTypingState(text.length);
  for (const key of keys) {
    state = inputChar(state, text, key).state;
  }
  return state;
};

describe('inputChar', () => {
  it('marks a matching key correct and advances the cursor', () => {
    const { state } = inputChar(initTypingState(TEXT.length), TEXT, 't');
    expect(state.charStatus[0]).toBe('correct');
    expect(state.typedChars[0]).toBe('t');
    expect(state.cursorPosition).toBe(1);
  });

  it('marks a non-matching key incorrect, advances, and signals a mistake', () => {
    const { state, events } = inputChar(
      initTypingState(TEXT.length),
      TEXT,
      'x'
    );
    expect(state.charStatus[0]).toBe('incorrect');
    expect(state.typedChars[0]).toBe('x');
    expect(state.cursorPosition).toBe(1);
    expect(events.characterMistake).toBe(true);
  });

  it('does not advance past the end of the text', () => {
    let state = typeChars(TEXT, 'to be free'.replace(/ /g, '')); // type all letters
    // cursor should be at the final space-less end; force cursor to text end
    state = { ...state, cursorPosition: TEXT.length };
    const result = inputChar(state, TEXT, 'z');
    expect(result.state.cursorPosition).toBe(TEXT.length);
  });
});

describe('overflow', () => {
  it('appends extra letters at a word boundary instead of advancing', () => {
    // Type "to" -> cursor sits on the space at index 2.
    const state = typeChars(TEXT, 'to');
    expect(state.cursorPosition).toBe(2);

    const { state: s2, events } = inputChar(state, TEXT, 'a');
    expect(s2.overflow[2]).toEqual(['a']);
    expect(s2.cursorPosition).toBe(2); // cursor does NOT move into next word
    expect(s2.charStatus[3]).toBe('pending'); // next word untouched
    expect(events.characterMistake).toBe(true);

    const { state: s3 } = inputChar(s2, TEXT, 'b');
    expect(s3.overflow[2]).toEqual(['a', 'b']);
    expect(s3.cursorPosition).toBe(2);
  });

  it('caps the number of overflow characters', () => {
    let state = typeChars(TEXT, 'to');
    for (let i = 0; i < MAX_OVERFLOW + 5; i++) {
      state = inputChar(state, TEXT, 'x').state;
    }
    expect(state.overflow[2].length).toBe(MAX_OVERFLOW);
  });
});

describe('backspace', () => {
  it('removes overflow characters before normal deletion', () => {
    let state = typeChars(TEXT, 'to');
    state = inputChar(state, TEXT, 'a').state;
    state = inputChar(state, TEXT, 'b').state;
    expect(state.overflow[2]).toEqual(['a', 'b']);

    state = backspace(state).state;
    expect(state.overflow[2]).toEqual(['a']);
    expect(state.cursorPosition).toBe(2); // cursor stays put

    state = backspace(state).state;
    expect(state.overflow[2]).toBeUndefined(); // bucket cleared when empty
    expect(state.cursorPosition).toBe(2);

    // next backspace deletes the real previous character
    state = backspace(state).state;
    expect(state.cursorPosition).toBe(1);
    expect(state.charStatus[1]).toBe('pending');
  });

  it('does not delete a locked character', () => {
    // Type "to" then space to lock the word + space.
    let state = typeChars(TEXT, 'to');
    state = spaceBar(state, TEXT).state;
    expect(state.charStatus[0]).toBe('locked');
    expect(state.cursorPosition).toBe(3);

    state = backspace(state).state;
    expect(state.cursorPosition).toBe(3); // blocked by locked space
  });
});

describe('spaceBar', () => {
  it('locks a correctly typed word and its trailing space', () => {
    const state = typeChars(TEXT, 'to');
    const { state: s2, events } = spaceBar(state, TEXT);
    expect(s2.charStatus[0]).toBe('locked');
    expect(s2.charStatus[1]).toBe('locked');
    expect(s2.charStatus[2]).toBe('locked'); // the space
    expect(s2.cursorPosition).toBe(3);
    expect(events.wordCompleted).toBe(true);
  });

  it('penalizes a word that carries overflow and keeps the extras', () => {
    let state = typeChars(TEXT, 'to');
    state = inputChar(state, TEXT, 'x').state; // overflow at index 2
    const { state: s2, events } = spaceBar(state, TEXT);
    expect(events.wordMistake).toBe(true);
    expect(events.wordCompleted).toBeFalsy();
    expect(s2.overflow[2]).toEqual(['x']); // extras remain rendered
    expect(s2.charStatus[2]).toBe('locked'); // boundary locked
    expect(s2.cursorPosition).toBe(3);
    // base word chars are NOT locked as correct
    expect(s2.charStatus[0]).not.toBe('locked');
  });

  it('penalizes a base word typed incorrectly', () => {
    const state = typeChars(TEXT, 'tx'); // second char wrong
    const { events } = spaceBar(state, TEXT);
    expect(events.wordMistake).toBe(true);
    expect(events.wordCompleted).toBeFalsy();
  });

  it('skips the rest of a word on a mid-word space and locks the next space', () => {
    const state = typeChars(TEXT, 't'); // cursor at index 1, mid "to"
    const { state: s2, events } = spaceBar(state, TEXT);
    expect(events.wordMistake).toBe(true);
    expect(s2.charStatus[2]).toBe('locked'); // boundary space locked
    expect(s2.cursorPosition).toBe(3);
  });
});

describe('wordDeletion', () => {
  it('clears the current word back to its start', () => {
    let state = typeChars(TEXT, 'to'); // cursor at 2
    state = wordDeletion(state, TEXT).state;
    expect(state.cursorPosition).toBe(0);
    expect(state.charStatus[0]).toBe('pending');
    expect(state.charStatus[1]).toBe('pending');
  });

  it('clears overflow on the boundary it starts from', () => {
    let state = typeChars(TEXT, 'to');
    state = inputChar(state, TEXT, 'x').state; // overflow at 2
    state = wordDeletion(state, TEXT).state;
    expect(state.overflow[2]).toBeUndefined();
  });

  it('does not delete across a locked word', () => {
    let state = typeChars(TEXT, 'to');
    state = spaceBar(state, TEXT).state; // lock "to" + space, cursor at 3
    state = inputChar(state, TEXT, 'b').state; // start "be", cursor at 4
    state = wordDeletion(state, TEXT).state;
    // deletes back to start of "be" (index 3) but not into the locked word
    expect(state.cursorPosition).toBe(3);
    expect(state.charStatus[0]).toBe('locked');
  });
});
