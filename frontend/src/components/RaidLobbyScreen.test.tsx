import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';

// The lobby renders a 3D <Canvas> avatar per player; @react-three/fiber cannot
// server-render under the node test environment, so stub it with a marker we
// can count. The stub emits no user id, preserving the userId-absence asserts.
vi.mock('./PlayerAvatar3D', () => ({
  default: () => <i data-avatar="true" />,
}));

import RaidLobbyScreen from './RaidLobbyScreen';

// Server-rendered string assertions: cheaper than spinning up jsdom +
// testing-library and sufficient for this component, which has no client-side
// behavior we need to test beyond initial render output.

const baseProps = {
  roomCode: 'PX5XZ3',
  onStartGame: () => {},
  onLeaveRoom: () => {},
};

const mkPlayer = (userId: string, username: string, isHost = false) => ({
  userId,
  username,
  isHost,
});

describe('RaidLobbyScreen', () => {
  it('renders the room code', () => {
    const html = renderToString(
      <RaidLobbyScreen {...baseProps} players={[]} isHost={false} />
    );
    expect(html).toContain('PX5XZ3');
  });

  it('renders each player by username (never the userId)', () => {
    // Regression guard for the bug where authenticated users without a local
    // `users` row showed up as their raw Clerk userId in the lobby.
    const html = renderToString(
      <RaidLobbyScreen
        {...baseProps}
        players={[
          mkPlayer('user_2abc', 'Ravit', true),
          mkPlayer('guest-xy12', 'Guest-7', false),
        ]}
        isHost={true}
      />
    );
    expect(html).toContain('Ravit');
    expect(html).toContain('Guest-7');
    expect(html).not.toContain('user_2abc');
    expect(html).not.toContain('guest-xy12');
  });

  it('shows the (Host) badge only next to the host player', () => {
    const html = renderToString(
      <RaidLobbyScreen
        {...baseProps}
        players={[
          mkPlayer('user_2abc', 'Ravit', true),
          mkPlayer('user_2def', 'Bob', false),
        ]}
        isHost={true}
      />
    );
    const hostMatches = html.match(/\(Host\)/g) ?? [];
    expect(hostMatches).toHaveLength(1);
  });

  it('renders Start Game when local user is host', () => {
    const html = renderToString(
      <RaidLobbyScreen {...baseProps} players={[]} isHost={true} />
    );
    expect(html).toContain('Start Game');
    expect(html).not.toContain('Waiting for host to start');
  });

  it('renders waiting message when local user is not host', () => {
    const html = renderToString(
      <RaidLobbyScreen {...baseProps} players={[]} isHost={false} />
    );
    expect(html).toContain('Waiting for host to start');
    expect(html).not.toContain('Start Game');
  });

  it('renders "Waiting for players" when the player list is empty', () => {
    const html = renderToString(
      <RaidLobbyScreen {...baseProps} players={[]} isHost={true} />
    );
    expect(html).toContain('Waiting for players');
  });

  it('renders an error banner when an error is passed', () => {
    const html = renderToString(
      <RaidLobbyScreen
        {...baseProps}
        players={[]}
        isHost={true}
        error="Room is full"
      />
    );
    expect(html).toContain('Room is full');
  });

  it('omits the error banner when no error is passed', () => {
    const html = renderToString(
      <RaidLobbyScreen {...baseProps} players={[]} isHost={true} />
    );
    expect(html).not.toContain('bg-red-900');
  });

  it('renders one avatar per player', () => {
    const html = renderToString(
      <RaidLobbyScreen
        {...baseProps}
        players={[mkPlayer('u1', 'Alice'), mkPlayer('u2', 'Bob')]}
        isHost={false}
      />
    );
    expect((html.match(/data-avatar/g) ?? []).length).toBe(2);
  });

  it('still renders one avatar per player when configs are provided', () => {
    const html = renderToString(
      <RaidLobbyScreen
        {...baseProps}
        players={[
          {
            userId: 'u1',
            username: 'Alice',
            isHost: true,
            characterConfig: {
              bodyShape: 'round',
              bodyColor: '#38bdf8',
              eyeStyle: 'wide',
              accessory: 'crown',
              accessoryColor: '#fde047',
            },
          },
          { userId: 'u2', username: 'Bob', isHost: false },
        ]}
        isHost={true}
      />
    );
    expect((html.match(/data-avatar/g) ?? []).length).toBe(2);
    expect(html).toContain('Alice');
    expect(html).toContain('Bob');
  });
});
