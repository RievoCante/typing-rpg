// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTypingMechanics } from './useTypingMechanics';

describe('useTypingMechanics onKeypress', () => {
  it('fires correct=true for a matching char and false for a wrong char', () => {
    const onKeypress = vi.fn();
    const { result } = renderHook(() =>
      useTypingMechanics({ text: 'ab', onKeypress })
    );
    act(() => result.current.handleCharacterInput('a')); // correct
    act(() => result.current.handleCharacterInput('z')); // wrong (expected 'b')
    expect(onKeypress).toHaveBeenNthCalledWith(1, true);
    expect(onKeypress).toHaveBeenNthCalledWith(2, false);
  });
});
