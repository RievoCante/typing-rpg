import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';

// 3D + typing internals can't server-render here; stub them.
vi.mock('./PlayerAvatar3D', () => ({
  default: () => <i data-avatar="true" />,
}));
vi.mock('./RaidBoss3D', () => ({ default: () => <i data-boss="true" /> }));
vi.mock('./TypingText', () => ({ default: () => <span data-typing="true" /> }));
vi.mock('../hooks/useTypingMechanics', () => ({
  useTypingMechanics: () => ({
    charStatus: [],
    typedChars: [],
    cursorPosition: 0,
    handleSpaceBar: () => {},
    handleBackspace: () => {},
    handleWordDeletion: () => {},
    handleCharacterInput: () => {},
    resetTypingState: () => {},
  }),
}));

import RaidGame from './RaidGame';
import type { RaidPlayer } from '../hooks/useRaidState';

const mk = (userId: string, username: string): RaidPlayer => ({
  userId,
  username,
  hp: 100,
  maxHp: 100,
  isHost: false,
  isAlive: true,
  wordsTyped: 0,
  wordsCorrect: 0,
  damageDealt: 0,
});

const baseProps = {
  bossHp: 100,
  bossMaxHp: 100,
  localText: 'hello world',
  isLocalAlive: true,
  lastHit: null,
  lastWordHit: null,
  onWordComplete: () => {},
  onMistake: () => {},
};

describe('RaidGame layout', () => {
  it('renders the boss and one avatar per player including the local player', () => {
    const players = [mk('me', 'Me'), mk('u2', 'Bob'), mk('u3', 'Cara')];
    const html = renderToString(
      <RaidGame {...baseProps} players={players} localUserId="me" />
    );
    expect((html.match(/data-boss/g) ?? []).length).toBe(1);
    expect((html.match(/data-avatar/g) ?? []).length).toBe(3);
    expect(html).toContain('Me');
    expect(html).toContain('Bob');
    // Local player highlighted exactly once; emoji boss fully replaced.
    expect((html.match(/\(you\)/g) ?? []).length).toBe(1);
    expect(html).not.toContain('👹');
  });

  it('still renders the boss HP readout', () => {
    const html = renderToString(
      <RaidGame {...baseProps} players={[mk('me', 'Me')]} localUserId="me" />
    );
    expect(html).toContain('100 / 100 HP');
  });
});
