# Raid Inline Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Raid tab render inline on the main game page (same brick background, mode tabs) instead of navigating to a separate `/raid` route.

**Architecture:** Add `'raid'` to `GameMode` type, make `ModeSelector` call `setCurrentMode('raid')` instead of navigating, and have `App.tsx` conditionally render a new `RaidView` component in place of the Monster + TypingInterface block when raid mode is active. `RaidView` owns the room-list → in-room phase transition and merges logic from the now-deleted `RaidLobbyPage` and `RaidRoomPage`.

**Tech Stack:** React 19, TypeScript, react-router-dom v6, @clerk/clerk-react, Tailwind CSS. Runtime: Cloudflare Workers (backend, unchanged).

---

### Task 1: Extend GameMode type to include `'raid'`

**Files:**
- Modify: `frontend/src/context/GameContext.ts`
- Modify: `frontend/src/context/GameProvider.tsx`

- [ ] **Step 1: Update `GameContext.ts`**

In `frontend/src/context/GameContext.ts`, change lines 6–7 from:
```ts
  currentMode: 'daily' | 'endless';
  setCurrentMode: (mode: 'daily' | 'endless') => void;
```
to:
```ts
  currentMode: 'daily' | 'endless' | 'raid';
  setCurrentMode: (mode: 'daily' | 'endless' | 'raid') => void;
```

Also update the default value on line 33:
```ts
export const GameContext = createContext<GameContextType>({
  currentMode: 'daily',
  setCurrentMode: () => {},
```
This stays the same — no change needed there.

- [ ] **Step 2: Update `GameProvider.tsx`**

In `frontend/src/context/GameProvider.tsx`, change line 77 from:
```ts
  const [currentMode, setCurrentMode] = useState<'daily' | 'endless'>(
    initialMode
  );
```
to:
```ts
  const [currentMode, setCurrentMode] = useState<'daily' | 'endless' | 'raid'>(
    initialMode
  );
```

The `initialMode` prop type (`'daily' | 'endless'`) stays unchanged — we never default to raid on page load.

- [ ] **Step 3: Type-check**

```bash
cd frontend && bunx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/context/GameContext.ts frontend/src/context/GameProvider.tsx
git commit -m "feat: add 'raid' to GameMode type"
```

---

### Task 2: Update ModeSelector to set raid mode locally

**Files:**
- Modify: `frontend/src/components/ModeSelector.tsx`

- [ ] **Step 1: Rewrite `ModeSelector.tsx`**

Replace the full file content with:

```tsx
import { useThemeContext } from '../hooks/useThemeContext';
import { useGameContext } from '../hooks/useGameContext';
import { useEffect, useState } from 'react';
import EndlessOptions from './EndlessOptions';

export default function ModeSelector() {
  const { theme } = useThemeContext();
  const { currentMode, setCurrentMode } = useGameContext();
  const [, setTick] = useState(0);

  const activeIndex =
    currentMode === 'raid' ? 2 : currentMode === 'daily' ? 0 : 1;

  // Live ticking countdown without heavy re-renders
  useEffect(() => {
    const id = setInterval(() => setTick(n => (n + 1) % 60), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex flex-col items-center w-full py-4">
      <div
        className={`relative flex rounded-lg p-1 transition-colors duration-300 ${
          theme === 'dark'
            ? 'bg-[#2A2C3C] border border-gray-700'
            : 'bg-gray-100 border border-gray-200'
        }`}
      >
        {/* Sliding background indicator */}
        <div
          className={`absolute top-1 bottom-1 left-1 w-[calc(33.33%-0.33rem)] rounded-md transition-all duration-300 ease-in-out ${
            theme === 'dark' ? 'bg-gray-700' : 'bg-white shadow-sm'
          }`}
          style={{ transform: `translateX(${activeIndex * 100}%)` }}
        />

        {/* Daily Mode Button */}
        <div className="relative group">
          <button
            onClick={() => setCurrentMode('daily')}
            className={`relative z-10 px-8 py-3 rounded-md transition-all duration-300 font-medium text-lg min-w-[140px] flex items-center justify-center ${
              currentMode === 'daily'
                ? theme === 'dark'
                  ? 'text-white'
                  : 'text-gray-900'
                : theme === 'dark'
                  ? 'text-gray-400 hover:text-gray-300'
                  : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Daily
          </button>
          <div
            className={`absolute left-1/2 -translate-x-1/2 bottom-full mb-1 px-2 py-1 text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 delay-0 group-hover:delay-[750ms] whitespace-nowrap ${
              theme === 'dark'
                ? 'bg-gray-900 text-white'
                : 'bg-gray-800 text-white'
            }`}
          >
            daily challenge that reset everyday
          </div>
        </div>

        {/* Endless Mode Button */}
        <div className="relative group">
          <button
            onClick={() => setCurrentMode('endless')}
            className={`relative z-10 px-8 py-3 rounded-md transition-all duration-300 font-medium text-lg min-w-[140px] flex items-center justify-center ${
              currentMode === 'endless'
                ? theme === 'dark'
                  ? 'text-white'
                  : 'text-gray-900'
                : theme === 'dark'
                  ? 'text-gray-400 hover:text-gray-300'
                  : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Endless
          </button>
          <div
            className={`absolute left-1/2 -translate-x-1/2 bottom-full mb-1 px-2 py-1 text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 delay-0 group-hover:delay-[750ms] whitespace-nowrap ${
              theme === 'dark'
                ? 'bg-gray-900 text-white'
                : 'bg-gray-800 text-white'
            }`}
          >
            practice typing and kill monsters endlessly!
          </div>
        </div>

        {/* Raid Button */}
        <div className="relative group">
          <button
            onClick={() => setCurrentMode('raid')}
            className={`relative z-10 px-8 py-3 rounded-md transition-all duration-300 font-medium text-lg min-w-[140px] flex items-center justify-center ${
              currentMode === 'raid'
                ? theme === 'dark'
                  ? 'text-white'
                  : 'text-gray-900'
                : theme === 'dark'
                  ? 'text-gray-400 hover:text-gray-300'
                  : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Raid
          </button>
          <div
            className={`absolute left-1/2 -translate-x-1/2 bottom-full mb-1 px-2 py-1 text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 delay-0 group-hover:delay-[750ms] whitespace-nowrap ${
              theme === 'dark'
                ? 'bg-gray-900 text-white'
                : 'bg-gray-800 text-white'
            }`}
          >
            team up and raid together!
          </div>
        </div>
      </div>

      {/* Endless mode options - word count and difficulty in one row */}
      {currentMode === 'endless' && <EndlessOptions />}
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
cd frontend && bunx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/ModeSelector.tsx
git commit -m "feat: raid tab sets mode locally instead of navigating"
```

---

### Task 3: Remove raid routes from `main.tsx` and delete old pages

> **Note:** We delete the old pages before updating `RaidResultScreen`'s interface so there's never an intermediate TypeScript error.

**Files:**
- Modify: `frontend/src/main.tsx`
- Delete: `frontend/src/pages/RaidLobbyPage.tsx`
- Delete: `frontend/src/pages/RaidRoomPage.tsx`

- [ ] **Step 1: Update `main.tsx`**

Remove the two raid page imports (lines 6–7):
```ts
import RaidLobbyPage from './pages/RaidLobbyPage';
import RaidRoomPage from './pages/RaidRoomPage';
```

Replace the router definition:
```ts
const router = createBrowserRouter([
  { path: '/', element: <App /> },
  { path: '/leaderboard', element: <LeaderboardPage /> },
  { path: '/raid', element: <RaidLobbyPage /> },
  { path: '/raid/:roomId', element: <RaidRoomPage /> },
]);
```
with:
```ts
const router = createBrowserRouter([
  { path: '/', element: <App /> },
  { path: '/leaderboard', element: <LeaderboardPage /> },
]);
```

- [ ] **Step 2: Delete old page files**

```bash
rm frontend/src/pages/RaidLobbyPage.tsx frontend/src/pages/RaidRoomPage.tsx
```

- [ ] **Step 3: Type-check**

```bash
cd frontend && bunx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/main.tsx
git rm frontend/src/pages/RaidLobbyPage.tsx frontend/src/pages/RaidRoomPage.tsx
git commit -m "feat: remove /raid routes and old raid pages"
```

---

### Task 4: Add `onHome` prop to `RaidResultScreen`

**Files:**
- Modify: `frontend/src/components/RaidResultScreen.tsx`

The current component uses `useNavigate` internally for the "Home" button (`navigate('/')`). Replace it with an `onHome` callback prop so the component has no routing dependency.

- [ ] **Step 1: Rewrite `RaidResultScreen.tsx`**

```tsx
interface Props {
  result: 'victory' | 'defeat' | null;
  stats: { totalWords: number; avgWpm: number; durationMs: number } | null;
  players: {
    userId: string;
    username: string;
    damageDealt: number;
    isAlive: boolean;
  }[];
  onPlayAgain: () => void;
  onHome: () => void;
}

export default function RaidResultScreen({
  result,
  stats,
  players,
  onPlayAgain,
  onHome,
}: Props) {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="bg-gray-800 p-8 rounded-lg shadow-xl max-w-lg w-full text-center">
        <h2
          className={`text-4xl font-bold mb-4 ${result === 'victory' ? 'text-green-400' : 'text-red-400'}`}
        >
          {result === 'victory' ? 'VICTORY!' : 'DEFEAT'}
        </h2>
        {stats && (
          <div className="mb-6 text-gray-300">
            <p>Total Words: {stats.totalWords}</p>
            <p>Duration: {Math.round(stats.durationMs / 1000)}s</p>
          </div>
        )}
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-2">Team Stats</h3>
          <ul className="space-y-2">
            {players.map(p => (
              <li
                key={p.userId}
                className="p-3 bg-gray-700 rounded flex justify-between"
              >
                <span>
                  {p.username} {p.isAlive ? '✅' : '💀'}
                </span>
                <span>{p.damageDealt} dmg</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex gap-4 justify-center">
          <button
            onClick={onPlayAgain}
            className="px-6 py-2 bg-blue-600 rounded hover:bg-blue-700"
          >
            Play Again
          </button>
          <button
            onClick={onHome}
            className="px-6 py-2 bg-gray-600 rounded hover:bg-gray-700"
          >
            Home
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
cd frontend && bunx tsc --noEmit
```

Expected: no errors (the only file that used `RaidResultScreen` was `RaidRoomPage`, which was deleted in Task 3).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/RaidResultScreen.tsx
git commit -m "feat: replace useNavigate with onHome prop in RaidResultScreen"
```

---

### Task 5: Create `RaidView.tsx`

**Files:**
- Create: `frontend/src/components/RaidView.tsx`

This component merges the logic from `RaidLobbyPage` (room list, create/join) and `RaidRoomPage` (WebSocket, game lifecycle). It owns `phase: 'room-list' | 'in-room'` state.

- [ ] **Step 1: Create `frontend/src/components/RaidView.tsx`**

```tsx
import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { useRaidSocket } from '../hooks/useRaidSocket';
import { useRaidState } from '../hooks/useRaidState';
import { useApi } from '../hooks/useApi';
import { useGameContext } from '../hooks/useGameContext';
import RaidLobbyScreen from './RaidLobbyScreen';
import RaidGame from './RaidGame';
import RaidResultScreen from './RaidResultScreen';

type Phase = 'room-list' | 'in-room';

interface LobbyRoom {
  roomId: string;
  hostName: string;
  playerCount: number;
  status: string;
}

export default function RaidView() {
  const [phase, setPhase] = useState<Phase>('room-list');
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [rooms, setRooms] = useState<LobbyRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [wsUrl, setWsUrl] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const hasJoined = useRef(false);

  const { userId, getToken } = useAuth();
  const { setCurrentMode } = useGameContext();
  const { getMe } = useApi();
  const apiUrl = import.meta.env.VITE_API_URL;

  // Fetch room list when in room-list phase, poll every 5 seconds
  const fetchRooms = useCallback(async () => {
    try {
      const res = await fetch(`${apiUrl}/api/raid/rooms`);
      const data = await res.json();
      setRooms(Array.isArray(data) ? data : []);
    } catch {
      setRooms([]);
    } finally {
      setLoading(false);
    }
  }, [apiUrl]);

  useEffect(() => {
    if (phase !== 'room-list') return;
    fetchRooms();
    const id = setInterval(fetchRooms, 5000);
    return () => clearInterval(id);
  }, [phase, fetchRooms]);

  // Build WebSocket URL and fetch username once a room is selected
  useEffect(() => {
    if (!activeRoomId) return;
    hasJoined.current = false;
    getToken().then(token => {
      if (!token) return;
      const base = apiUrl.replace(/^http/, 'ws');
      setWsUrl(`${base}/api/raid/rooms/${activeRoomId}/ws?token=${token}`);
    });
    getMe()
      .then(r => r.json())
      .then(data => setUsername(data?.username ?? null))
      .catch(() => {});
  }, [activeRoomId, apiUrl, getToken, getMe]);

  const { lastMessage, isConnected, error, send } = useRaidSocket(wsUrl ?? '');
  const { state, isPhase, isLocalAlive } = useRaidState(
    lastMessage,
    userId ?? ''
  );

  // Auto-join once connected and username is ready
  useEffect(() => {
    if (isConnected && username && !hasJoined.current) {
      hasJoined.current = true;
      send({ type: 'join', userId: userId ?? 'anon', username });
    }
  }, [isConnected, username, send, userId]);

  const handleCreateRoom = async () => {
    setCreating(true);
    try {
      const token = await getToken();
      const res = await fetch(`${apiUrl}/api/raid/rooms`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        alert('Failed to create room');
        return;
      }
      const data = await res.json();
      if (data.roomId) {
        setActiveRoomId(data.roomId);
        setPhase('in-room');
      }
    } finally {
      setCreating(false);
    }
  };

  const handleJoinRoom = async (roomId: string) => {
    try {
      const token = await getToken();
      const res = await fetch(`${apiUrl}/api/raid/rooms/${roomId}/join`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        alert('Failed to join room');
        return;
      }
      setActiveRoomId(roomId);
      setPhase('in-room');
    } catch {
      alert('Failed to join room');
    }
  };

  const handleBackToLobby = () => {
    setWsUrl(null);
    setActiveRoomId(null);
    setPhase('room-list');
    setLoading(true);
  };

  if (phase === 'room-list') {
    return (
      <div className="p-8 text-white">
        <h1 className="text-3xl font-bold mb-6">Raid Lobby</h1>
        <button
          onClick={handleCreateRoom}
          disabled={creating}
          className="mb-6 px-6 py-3 bg-red-600 rounded-lg font-bold hover:bg-red-700 disabled:opacity-50"
        >
          {creating ? 'Creating...' : 'Create Room'}
        </button>
        {loading ? (
          <p>Loading rooms...</p>
        ) : rooms.length === 0 ? (
          <p className="text-gray-400">
            No active rooms. Be the first to create one!
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {rooms.map(room => (
              <div
                key={room.roomId}
                className="p-4 bg-gray-800 rounded-lg shadow"
              >
                <div className="flex justify-between items-center mb-2">
                  <span className="font-mono text-lg">{room.roomId}</span>
                  <span className="text-sm text-gray-400">
                    {room.playerCount}/3
                  </span>
                </div>
                <p className="text-sm text-gray-400 mb-3">
                  Host: {room.hostName}
                </p>
                <button
                  onClick={() => handleJoinRoom(room.roomId)}
                  className="w-full py-2 bg-blue-600 rounded hover:bg-blue-700"
                >
                  Join
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // in-room phase
  if (error) {
    return (
      <div className="flex items-center justify-center text-white p-8">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <button
            onClick={handleBackToLobby}
            className="px-4 py-2 bg-gray-700 rounded"
          >
            Back to Lobby
          </button>
        </div>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="flex items-center justify-center text-white p-8">
        <p>Connecting to room {activeRoomId}...</p>
      </div>
    );
  }

  return (
    <div className="text-white">
      {isPhase('lobby') && (
        <RaidLobbyScreen
          players={state.players}
          isHost={state.isHost}
          localUserId={userId ?? ''}
          onStartGame={() => send({ type: 'start_game' })}
        />
      )}
      {isPhase('playing') && (
        <RaidGame
          players={state.players}
          bossHp={state.bossHp}
          bossMaxHp={state.bossMaxHp}
          localText={state.localText}
          isLocalAlive={isLocalAlive}
          localUserId={userId ?? ''}
          onWordComplete={(wordIndex: number) =>
            send({ type: 'word_complete', wordIndex })
          }
        />
      )}
      {isPhase('finished') && (
        <RaidResultScreen
          result={state.result}
          stats={state.stats}
          players={state.players}
          onPlayAgain={handleBackToLobby}
          onHome={() => setCurrentMode('daily')}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
cd frontend && bunx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/RaidView.tsx
git commit -m "feat: add RaidView component with inline room-list and in-room phases"
```

---

### Task 6: Update `App.tsx` to render `RaidView` when mode is raid

**Files:**
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Add RaidView import**

Add this import near the top of `frontend/src/App.tsx`, after the existing component imports:
```tsx
import RaidView from './components/RaidView';
```

- [ ] **Step 2: Add conditional render**

In `GameContent`, replace the block:
```tsx
        <HealthBar />
        <Monster
          key={monstersDefeated}
          monsterFamily={monsterFamily}
          monsterType={monsterType}
          isDefeated={isDefeated}
          color={monsterVisuals.color}
          scale={monsterVisuals.scale}
          shape={monsterShape}
        />
        <SignedIn>
          <PlayerLevel
            level={level}
            currentXp={currentXp}
            xpToNextLevel={xpToNextLevel}
          />
        </SignedIn>
        <TypingInterface
          dailyProgress={dailyProgress}
          reloadPlayerStats={reloadPlayerStats}
        />
        {currentMode === 'daily' && (
          <MilestoneProgress
            completedQuotes={dailyProgress.completedQuotes}
            totalMilestones={3}
          />
        )}
```

with:
```tsx
        {currentMode === 'raid' ? (
          <RaidView />
        ) : (
          <>
            <HealthBar />
            <Monster
              key={monstersDefeated}
              monsterFamily={monsterFamily}
              monsterType={monsterType}
              isDefeated={isDefeated}
              color={monsterVisuals.color}
              scale={monsterVisuals.scale}
              shape={monsterShape}
            />
            <SignedIn>
              <PlayerLevel
                level={level}
                currentXp={currentXp}
                xpToNextLevel={xpToNextLevel}
              />
            </SignedIn>
            <TypingInterface
              dailyProgress={dailyProgress}
              reloadPlayerStats={reloadPlayerStats}
            />
            {currentMode === 'daily' && (
              <MilestoneProgress
                completedQuotes={dailyProgress.completedQuotes}
                totalMilestones={3}
              />
            )}
          </>
        )}
```

- [ ] **Step 3: Type-check**

```bash
cd frontend && bunx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/App.tsx
git commit -m "feat: render RaidView inline when mode is raid"
```

---

### Task 7: Verify end-to-end

- [ ] **Step 1: Lint and format check**

```bash
cd frontend && bun run lint && bun run format:check
```

Expected: no errors or warnings.

- [ ] **Step 2: Start the dev server**

```bash
cd frontend && bun run dev
```

- [ ] **Step 3: Verify Raid tab**

Open the app in a browser. Click the "Raid" tab. Confirm:
- URL stays at `/`
- Brick background and mode tabs remain visible
- Room list UI appears below the mode tabs (shows "No active rooms" or a list)
- "Create Room" button is visible

- [ ] **Step 4: Verify mode switching**

Click Daily or Endless while on Raid. Confirm:
- Normal game (monster, health bar, typing area) returns
- No console errors
- Clicking Raid again returns to room list
