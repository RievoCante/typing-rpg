import {
  useState,
  useEffect,
  type KeyboardEvent,
  useRef,
  useCallback,
  useMemo,
  lazy,
  Suspense,
} from 'react';
import { useGameContext } from '../hooks/useGameContext';
import TypingText from './TypingText';
import { generateText } from '../utils/textGenerator';
import { trackEvent } from '../utils/trackEvent';
import CongratsModal from './CongratsModal';
import OverlayBanner from './OverlayBanner';
import KillResultOverlay, { type KillResult } from './KillResultOverlay';
import WeaponDropModal from './WeaponDropModal';
import WPMDisplay from './WPMDisplay';
import VerticalPlayerHealthBar from './VerticalPlayerHealthBar';
import PotionSlot from './PotionSlot';
import WeaponSlot from './WeaponSlot';
import DailyCompletedOverlay from './DailyCompletedOverlay';
import TypingRestartButton from './TypingRestartButton';
import {
  HitPopups,
  AttackPopups,
  PotionPopups,
  CombatPopups,
  SaveErrorBanner,
} from './TypingPopups';

import { useThemeContext } from '../hooks/useThemeContext';
import ComboMeter from './ComboMeter';
import { useTypingMechanics } from '../hooks/useTypingMechanics';
import { usePerformanceTracking } from '../hooks/usePerformanceTracking';
import { useCompletionDetection } from '../hooks/useCompletionDetection';
import { useCompletionHandler } from '../hooks/useCompletionHandler';
import { useHitPopups } from '../hooks/useHitPopups';
import { useAttackPopups } from '../hooks/useAttackPopups';
import { usePotionPopups } from '../hooks/usePotionPopups';
import { useCombatPopups } from '../hooks/useCombatPopups';
import { useTypingCompletion } from '../hooks/useTypingCompletion';
import type { DailyProgressType } from '../hooks/useDailyProgress';
import type { CompletionResult } from '../types/completion';
import { useFightStats } from '../hooks/useFightStats';
import { useSessionMetrics } from '../hooks/useSessionMetrics';
import { analyzeWords } from '../utils/wordAnalysis';
import { getWpmTitle } from '../utils/wpmTitle';
import WeaponLoadoutPanel from './WeaponLoadoutPanel';

// Lazy-loaded: BattleAvatar pulls in three-vendor via PlayerAvatar3D. Deferring
// it keeps the 3D bundle off the critical path.
const BattleAvatar = lazy(() => import('./BattleAvatar'));

interface TypingInterfaceProps {
  dailyProgress: DailyProgressType;
  reloadPlayerStats: () => Promise<void> | void;
  onXpGain?: (xp: number) => void;
}

// Endless is a continuous word stream: fixed-size blocks are regenerated when
// the player finishes one (the monster's HP — not the word pool — decides death,
// so a block boundary is just a seamless text refill, never a monster kill).
const ENDLESS_BLOCK_WORDS = 50;

// Delay before the result overlay reveals, letting the death animation register
// without making the player wait. Shorter than the full ~1.5s shrink on purpose —
// the centered overlay covers the tail of the animation anyway.
const DEATH_ANIM_MS = 550;

export default function TypingInterface({
  dailyProgress,
  reloadPlayerStats,
  onXpGain,
}: TypingInterfaceProps) {
  const {
    currentMode,
    setTotalWords,
    setRemainingWords,
    decrementRemainingWords,
    incrementMonstersDefeated,
    endlessDifficulty,
    damagePlayerFromMistake,
    damageMonster,
    registerComboCorrect,
    registerComboWrong,
    equippedWeapon,
    isPlayerDead,
    hasStartedTyping,
    setHasStartedTyping,
    setIsPaused,
    registerCorrectWord,
    drinkPotion,
    monsterHp,
    isCurrentMonsterDefeated,
    currentMonsterVariant,
    resetDefeatState,
    pendingDrop,
    clearPendingDrop,
  } = useGameContext();
  const { theme } = useThemeContext();

  const [text, setText] = useState<string>('');
  const [restartKey, setRestartKey] = useState<number>(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const [currentAttempts, setCurrentAttempts] = useState<number>(1);
  const [showCongratsModal, setShowCongratsModal] = useState<boolean>(false);
  const [earnedXp, setEarnedXp] = useState<number>(0);
  const [isFocused, setIsFocused] = useState(false);
  // Post-kill results panel, held until the player presses Space.
  const [killResult, setKillResult] = useState<KillResult | null>(null);
  const [awaitingContinue, setAwaitingContinue] = useState(false);
  const [resetTimeLeft, setResetTimeLeft] = useState<{
    hours: number;
    minutes: number;
    seconds: number;
  } | null>(null);

  const currentDifficulty = useMemo(
    () => dailyProgress.getCurrentDifficulty(),
    [dailyProgress]
  );
  const completedQuotes = useMemo(
    () => dailyProgress.completedQuotes,
    [dailyProgress.completedQuotes]
  );
  const quoteStats = useMemo(
    () => dailyProgress.quoteStats,
    [dailyProgress.quoteStats]
  );

  const completeCurrentQuote = dailyProgress.completeCurrentQuote;
  const getAverageWPM = dailyProgress.getAverageWPM;
  const getTimeUntilReset = dailyProgress.getTimeUntilReset;

  const [hasShownDailyCompletion, setHasShownDailyCompletion] = useState(false);
  const [isProcessingCompletion, setIsProcessingCompletion] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [pendingRetrySave, setPendingRetrySave] = useState<
    (() => Promise<CompletionResult>) | null
  >(null);

  const containerRef = useRef<HTMLDivElement>(null);

  const { hits, triggerHit } = useHitPopups();
  const attacks = useAttackPopups();
  const potionPopups = usePotionPopups();
  const combatPopups = useCombatPopups();

  const fightStats = useFightStats();
  const sessionMetrics = useSessionMetrics();
  const [loadoutPending, setLoadoutPending] = useState(
    currentMode === 'endless'
  );
  const prevDefeatedRef = useRef(false);
  const fightFinalizedRef = useRef(false);
  const wasDeadRef = useRef(false);

  // Surface the kill reward as a big "+N XP" under the Player Level card.
  useEffect(() => {
    if (earnedXp > 0) onXpGain?.(earnedXp);
  }, [earnedXp, onXpGain]);

  const handleWordCompleted = useCallback(() => {
    triggerHit();
    if (currentMode === 'endless') {
      // Combo-driven damage to the monster's HP. Endless HP is decoupled from
      // the word pool, so we no longer decrement remainingWords here. The
      // equipped weapon (if any) raises crit chance / damage.
      const { damage, crit } = registerComboCorrect(equippedWeapon);
      damageMonster(damage);
      window.dispatchEvent(
        new CustomEvent('combat-hit', { detail: { damage, crit } })
      );
      // Potions still drop on the per-correct-word clock.
      registerCorrectWord();
    } else {
      // Daily/raid: words drive the HP bar, so each correct word drains one.
      decrementRemainingWords();
    }
    // Also notify slime model to flash red
    try {
      window.dispatchEvent(new Event('word-hit'));
    } catch {
      /* ignore */
    }
  }, [
    triggerHit,
    currentMode,
    registerComboCorrect,
    equippedWeapon,
    damageMonster,
    registerCorrectWord,
    decrementRemainingWords,
  ]);

  // Wrong word: always damages the player; in endless it also breaks the combo
  // streak (0 damage dealt) and signals a subtle combo-break cue.
  const handleWordMistake = useCallback(() => {
    damagePlayerFromMistake();
    if (currentMode === 'endless') {
      registerComboWrong();
      window.dispatchEvent(new Event('combo-break'));
    }
  }, [damagePlayerFromMistake, currentMode, registerComboWrong]);

  const typingMechanics = useTypingMechanics({
    text,
    onWordCompleted: handleWordCompleted,
    onWordMistake: handleWordMistake,
    onKeypress: sessionMetrics.recordKeypress,
  });

  const charStatusRef = useRef(typingMechanics.charStatus);
  charStatusRef.current = typingMechanics.charStatus;

  // Latest cursor position, read inside the death-finalizer effect (which isn't
  // keyed on cursorPosition) to bound stats to the words actually typed.
  const cursorPositionRef = useRef(typingMechanics.cursorPosition);
  cursorPositionRef.current = typingMechanics.cursorPosition;

  const performance = usePerformanceTracking({
    text,
    charStatus: typingMechanics.charStatus,
    hasStartedTyping,
    cursorPosition: typingMechanics.cursorPosition,
    overflow: typingMechanics.overflow,
  });

  const completion = useCompletionDetection({
    cursorPosition: typingMechanics.cursorPosition,
    textLength: text.length,
    hasStartedTyping,
  });

  const { resetTypingState } = typingMechanics;
  const { resetSession } = performance;
  const { resetForNewSession } = completion;

  // Regenerate text on mode / settings / restart change. Brief fade-out
  // prevents flicker as the new prompt is computed.
  useEffect(() => {
    setIsTransitioning(true);
    const timeoutId = setTimeout(() => {
      const newText =
        currentMode === 'daily'
          ? generateText(currentMode, currentDifficulty)
          : // TypingInterface is only mounted for daily/endless (raid renders its
            // own surface), so the non-daily branch is always endless.
            generateText(
              'endless',
              undefined,
              ENDLESS_BLOCK_WORDS,
              endlessDifficulty
            );
      setText(newText);
      const wordCount = newText.match(/\S+/g)?.length || 0;
      setTotalWords(wordCount);
      setRemainingWords(wordCount);
      setIsTransitioning(false);
    }, 150);
    return () => clearTimeout(timeoutId);
  }, [
    currentMode,
    currentDifficulty,
    setTotalWords,
    setRemainingWords,
    endlessDifficulty,
    restartKey,
  ]);

  const restartSession = useCallback(() => {
    setRestartKey(prev => prev + 1);
  }, []);

  // When the text actually changes, reset all per-session state.
  useEffect(() => {
    if (text.length === 0) return;
    // Analytics: the player reached a playable battle screen (deduped per page-load).
    trackEvent('reached_game', currentMode);
    resetTypingState();
    resetSession();
    resetForNewSession();
    setHasStartedTyping(false);
    setIsProcessingCompletion(false);
    setEarnedXp(0);
    if (currentMode === 'daily') sessionMetrics.reset();
    if (containerRef.current) containerRef.current.focus();
  }, [
    text,
    currentMode,
    resetTypingState,
    resetSession,
    resetForNewSession,
    setHasStartedTyping,
    sessionMetrics,
  ]);

  // Endless: when the player exhausts a 50-word block but the monster is still
  // alive, fold the finished block's stats into the fight and refill the buffer
  // silently — no overlay, no pause, no fight-stats reset. Guarded by
  // monsterHp > 0 so a kill that lands on the last word of a block is owned by
  // the death finalizer instead (avoids a wrong, post-refill stats snapshot).
  useEffect(() => {
    if (currentMode !== 'endless') return;
    if (!completion.isCompleted) return;
    if (awaitingContinue || isCurrentMonsterDefeated || monsterHp <= 0) return;
    completion.markAsProcessed();
    fightStats.foldBlock(
      analyzeWords(text, charStatusRef.current, typingMechanics.overflow)
    );
    restartSession();
  }, [
    currentMode,
    completion,
    awaitingContinue,
    isCurrentMonsterDefeated,
    monsterHp,
    fightStats,
    text,
    typingMechanics.overflow,
    restartSession,
    charStatusRef,
  ]);

  useEffect(() => {
    if (!dailyProgress.isCompleted) setHasShownDailyCompletion(false);
  }, [dailyProgress.isCompleted]);

  const {
    markAsProcessed,
    markSessionCompleted,
    isCompleted,
    isSessionAlreadyCompleted,
  } = completion;
  const { startTime, calculateFinalStats } = performance;

  const onShowModal = useCallback(() => {
    setShowCongratsModal(true);
    setHasShownDailyCompletion(true);
  }, []);

  const completionHandler = useCompletionHandler({
    // raid never mounts TypingInterface, so the mode is always daily/endless here.
    currentMode: currentMode as 'daily' | 'endless',
    endlessDifficulty,
    completeCurrentQuote,
    getAverageWPM,
    onShowModal,
  });

  // Live countdown for daily reset when completed
  useEffect(() => {
    if (currentMode === 'daily' && dailyProgress.isCompletedToday) {
      setResetTimeLeft(getTimeUntilReset());
      const id = setInterval(() => setResetTimeLeft(getTimeUntilReset()), 1000);
      return () => clearInterval(id);
    }
    setResetTimeLeft(null);
  }, [currentMode, dailyProgress.isCompletedToday, getTimeUntilReset]);

  useTypingCompletion({
    isCompleted,
    isProcessingCompletion,
    isSessionAlreadyCompleted,
    markAsProcessed,
    markSessionCompleted,
    startTime,
    text,
    hasStartedTyping,
    charStatusRef,
    calculateFinalStats,
    finalizeMetrics: sessionMetrics.finalize,
    currentMode,
    currentDifficulty,
    currentAttempts,
    completedQuotes,
    hasShownDailyCompletion,
    completionHandler,
    damagePlayerFromMistake,
    incrementMonstersDefeated,
    reloadPlayerStats,
    restartSession,
    setRemainingWords,
    setIsProcessingCompletion,
    setEarnedXp,
    setCurrentAttempts,
    setKillResult,
    setAwaitingContinue,
    setSaveError,
    setPendingRetrySave,
  });

  // Endless: when the monster dies (defeat flag rises), finalize the fight:
  // snapshot per-fight stats, save the session + preview XP via the endless
  // handler, then reveal the SUPER FAST overlay after the death animation.
  // GameProvider already counted the kill, so we never incrementMonstersDefeated.
  useEffect(() => {
    if (currentMode !== 'endless') {
      prevDefeatedRef.current = isCurrentMonsterDefeated;
      return;
    }
    const rising = isCurrentMonsterDefeated && !prevDefeatedRef.current;
    prevDefeatedRef.current = isCurrentMonsterDefeated;
    if (!rising || !hasStartedTyping || fightFinalizedRef.current) return;
    fightFinalizedRef.current = true;

    // The monster usually dies mid-block, so bound the analysis to the cursor:
    // words past it are untyped and must not count as incorrect (that would
    // zero out the earned XP and report a bogus low accuracy).
    const baseStats = fightStats.finalize(
      analyzeWords(
        text,
        charStatusRef.current,
        typingMechanics.overflow,
        cursorPositionRef.current
      )
    );
    const metrics = sessionMetrics.finalize(baseStats.elapsedMinutes);
    const stats = { ...baseStats, metrics };
    // Only compute + stash the result here. The 1.2s reveal is scheduled by a
    // separate effect keyed on `killResult` (stable state) — NOT here — so the
    // re-renders this async block triggers (setEarnedXp / setKillResult /
    // reloadPlayerStats) can't re-fire this effect and cancel the reveal timer.
    (async () => {
      // currentMonsterVariant still holds the just-killed monster's rarity here;
      // it only resets when the next monster spawns. Scales the awarded XP.
      const result = await completionHandler.handleCompletion(
        stats,
        undefined,
        currentMonsterVariant
      );
      if (result.action === 'saveError') {
        setSaveError(result.message ?? 'Failed to save. Please retry.');
        setPendingRetrySave(() => result.retrySave ?? null);
      }
      if (typeof result.xpDelta === 'number') setEarnedXp(result.xpDelta);
      reloadPlayerStats();
      setKillResult({
        title: getWpmTitle(stats.finalWpm),
        wpm: stats.finalWpm,
        accuracy: metrics.accuracy,
        xp: typeof result.xpDelta === 'number' ? result.xpDelta : undefined,
      });
    })();
  }, [
    currentMode,
    isCurrentMonsterDefeated,
    hasStartedTyping,
    fightStats,
    sessionMetrics,
    text,
    typingMechanics.overflow,
    completionHandler,
    reloadPlayerStats,
    charStatusRef,
    currentMonsterVariant,
  ]);

  // Reveal the post-kill overlay DEATH_ANIM_MS after the result is computed.
  // Depends only on stable state (killResult, awaitingContinue), so the churn
  // of re-renders during the death-animation window can't re-fire it and cancel
  // the timer. Fires once when killResult lands; the timer then flips
  // awaitingContinue, which re-fires this effect into the early-return branch.
  useEffect(() => {
    if (currentMode !== 'endless') return;
    if (!killResult || awaitingContinue) return;
    // Hold the post-kill overlay until the player takes any dropped weapon.
    if (pendingDrop) return;
    const id = window.setTimeout(
      () => setAwaitingContinue(true),
      DEATH_ANIM_MS
    );
    return () => window.clearTimeout(id);
  }, [currentMode, killResult, awaitingContinue, pendingDrop]);

  // Dismiss the post-kill results panel and advance. Endless drives the next
  // fight: reset fight state, clear the defeat flag (App spawns the next
  // monster), and refill the buffer. Daily already regenerated the next quote
  // when its handler advanced the difficulty, so it only needs the panel cleared.
  const handleContinue = useCallback(() => {
    if (!awaitingContinue) return;
    setAwaitingContinue(false);
    setKillResult(null);
    if (currentMode === 'endless') {
      fightStats.resetFight();
      sessionMetrics.reset();
      fightFinalizedRef.current = false;
      prevDefeatedRef.current = false;
      resetDefeatState(); // flag falls -> App spawns the next monster
      restartSession(); // fresh 50-word buffer
    }
    // Clicking the panel can drop focus off the typing surface; restore it so
    // the player can start the next round without re-clicking.
    containerRef.current?.focus();
  }, [
    awaitingContinue,
    currentMode,
    fightStats,
    sessionMetrics,
    resetDefeatState,
    restartSession,
  ]);

  // Acknowledge the dropped weapon. Clicking the Take button can drop focus off
  // the typing surface, so restore it — the kill-result overlay reveals next.
  const handleTakeDrop = useCallback(() => {
    clearPendingDrop();
    containerRef.current?.focus();
  }, [clearPendingDrop]);

  // Show the loadout picker at the start of every endless run: on entering
  // endless, and again after a death reset (revive). Reset fight stats too.
  useEffect(() => {
    if (currentMode === 'endless') {
      setLoadoutPending(true);
      fightStats.resetFight();
      sessionMetrics.reset();
      fightFinalizedRef.current = false;
      prevDefeatedRef.current = false;
    } else {
      setLoadoutPending(false);
    }
  }, [currentMode, fightStats, sessionMetrics]);

  useEffect(() => {
    if (currentMode !== 'endless') return;
    if (wasDeadRef.current && !isPlayerDead) {
      setLoadoutPending(true);
      setAwaitingContinue(false);
      setKillResult(null);
      fightStats.resetFight();
      sessionMetrics.reset();
      fightFinalizedRef.current = false;
      prevDefeatedRef.current = false;
    }
    wasDeadRef.current = isPlayerDead;
  }, [currentMode, isPlayerDead, fightStats, sessionMetrics]);

  const handleLoadoutConfirm = useCallback(() => {
    setLoadoutPending(false);
    containerRef.current?.focus();
  }, []);

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (isPlayerDead) return;
    // Pre-run loadout gate: ignore typing until the player picks a loadout.
    if (loadoutPending) {
      if (e.key !== 'Tab') e.preventDefault();
      return;
    }
    const { key } = e;
    // Top priority: a weapon just dropped. Capture all keys (no leak into the
    // typing buffer); Space/Enter takes it and reveals the kill result next.
    if (pendingDrop) {
      if (key === 'Tab') return;
      e.preventDefault();
      if (key === ' ' || key === 'Enter') handleTakeDrop();
      return;
    }
    // While the post-kill results panel is up, Space (or any typing key)
    // advances to the next monster/quote instead of feeding the input.
    if (awaitingContinue) {
      if (key === 'Tab') return;
      e.preventDefault();
      if (key === ' ' || key === 'Enter') handleContinue();
      return;
    }
    // Endless: monster is dead and playing its death animation; freeze input
    // until the results overlay appears (then the awaitingContinue branch runs).
    if (currentMode === 'endless' && isCurrentMonsterDefeated) {
      e.preventDefault();
      // Safety escape: if the result is already computed but the reveal timer
      // hasn't fired, Space/Enter reveals it now so the player can never get
      // stuck in the blurred death state.
      if ((key === ' ' || key === 'Enter') && killResult) {
        setAwaitingContinue(true);
      }
      return;
    }
    if (key === 'Tab') return;
    // Ctrl+H drinks a potion (endless only). preventDefault stops the browser
    // from opening its history panel. Other modes keep native behaviour.
    if (
      currentMode === 'endless' &&
      e.ctrlKey &&
      (key === 'h' || key === 'H')
    ) {
      e.preventDefault();
      drinkPotion();
      return;
    }
    if (key === ' ') {
      e.preventDefault();
      typingMechanics.handleSpaceBar();
    } else if (key === 'Backspace') {
      e.preventDefault();
      if (e.ctrlKey || e.altKey) typingMechanics.handleWordDeletion();
      else typingMechanics.handleBackspace();
    } else if (key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
      e.preventDefault();
      if (!hasStartedTyping) {
        setHasStartedTyping(true);
        performance.startSession();
        fightStats.startFightIfNeeded();
        sessionMetrics.startIfNeeded();
        trackEvent('started_typing', currentMode);
      }
      typingMechanics.handleCharacterInput(key);
    }
  };

  const handleRetrySave = useCallback(async () => {
    if (!pendingRetrySave) return;
    setSaveError(null);
    const result = await pendingRetrySave();
    if (result.action === 'saveError') {
      setSaveError(result.message ?? 'Failed to save. Please retry.');
      setPendingRetrySave(() => result.retrySave ?? null);
      return;
    }
    if (typeof result.xpDelta === 'number') setEarnedXp(result.xpDelta);
    setPendingRetrySave(null);
    reloadPlayerStats();
    if (result.action === 'showModal') setShowCongratsModal(true);
  }, [pendingRetrySave, reloadPlayerStats]);

  const dailyLocked = currentMode === 'daily' && dailyProgress.isCompletedToday;
  const surfaceBlurred =
    !isFocused ||
    awaitingContinue ||
    isProcessingCompletion ||
    isPlayerDead ||
    dailyLocked ||
    loadoutPending ||
    (currentMode === 'endless' && isCurrentMonsterDefeated);

  return (
    <>
      {currentMode === 'endless' && <ComboMeter />}
      <div className="relative max-w-5xl mx-auto mt-4">
        {/* Side clusters are absolutely positioned so the typing panel stays
            locked to the horizontal center of the screen regardless of their width. */}
        <div className="absolute left-0 top-1/2 -translate-y-1/2 flex items-center gap-4">
          <VerticalPlayerHealthBar />
          <Suspense fallback={<div className="h-44 w-28" />}>
            <BattleAvatar />
          </Suspense>
        </div>

        <div className="mx-auto w-full max-w-2xl relative">
          <div
            ref={containerRef}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              setIsFocused(true);
              setIsPaused(false);
            }}
            onBlur={() => {
              setIsFocused(false);
              setIsPaused(true);
            }}
            tabIndex={0}
            className={`px-12 py-8 rounded-lg shadow-xl flex flex-col space-y-6 focus:outline-none transition-all duration-300 ${
              theme === 'dark'
                ? 'bg-[#2A2C3C] text-white border border-gray-700'
                : 'bg-white text-gray-900 border border-gray-200'
            } ${surfaceBlurred ? 'filter blur-sm brightness-95' : ''} ${isTransitioning ? 'opacity-50' : 'opacity-100'}`}
          >
            <TypingText
              text={text}
              charStatus={typingMechanics.charStatus}
              typedChars={typingMechanics.typedChars}
              cursorPosition={typingMechanics.cursorPosition}
              hasStartedTyping={hasStartedTyping}
              overflow={typingMechanics.overflow}
            />

            <div className="flex justify-between items-center pt-4">
              <WPMDisplay
                wpm={performance.wpm}
                isCalculating={
                  hasStartedTyping &&
                  typingMechanics.cursorPosition < text.length &&
                  !isProcessingCompletion
                }
              />
            </div>

            <TypingRestartButton onRestart={restartSession} />
          </div>

          <div className="absolute inset-0 flex items-center justify-center pointer-events-none rounded-lg overflow-hidden">
            <OverlayBanner
              visible={!isFocused && !dailyLocked && !loadoutPending}
              message="Click to start fighting!"
              tone="info"
              onClick={() => containerRef.current?.focus()}
            />
          </div>

          {currentMode === 'endless' && loadoutPending && (
            <WeaponLoadoutPanel onConfirm={handleLoadoutConfirm} />
          )}

          <div className="absolute inset-0 flex items-center justify-center rounded-lg overflow-hidden pointer-events-none">
            <KillResultOverlay
              visible={awaitingContinue}
              result={killResult}
              onContinue={handleContinue}
            />
          </div>

          {currentMode === 'endless' && pendingDrop && (
            <WeaponDropModal weapon={pendingDrop} onTake={handleTakeDrop} />
          )}

          {dailyLocked && (
            <DailyCompletedOverlay resetTimeLeft={resetTimeLeft} />
          )}
        </div>

        {currentMode === 'endless' && (
          <div className="absolute right-0 top-1/2 -translate-y-1/2 flex flex-col items-center gap-3">
            <PotionSlot />
            <WeaponSlot />
          </div>
        )}
      </div>

      <CongratsModal
        isOpen={showCongratsModal}
        onClose={() => setShowCongratsModal(false)}
        totalXP={earnedXp}
        averageWPM={getAverageWPM()}
        quoteStats={quoteStats}
        onContinue={() => setShowCongratsModal(false)}
      />

      {saveError && (
        <SaveErrorBanner message={saveError} onRetry={handleRetrySave} />
      )}

      <HitPopups hits={hits} />
      <AttackPopups attacks={attacks} />
      <PotionPopups popups={potionPopups} />
      <CombatPopups popups={combatPopups} />
    </>
  );
}
