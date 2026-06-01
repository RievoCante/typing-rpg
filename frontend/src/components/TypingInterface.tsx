import {
  useState,
  useEffect,
  type KeyboardEvent,
  useRef,
  useCallback,
  useMemo,
} from 'react';
import { useGameContext } from '../hooks/useGameContext';
import TypingText from './TypingText';
import { generateText } from '../utils/textGenerator';
import { trackEvent } from '../utils/trackEvent';
import CongratsModal from './CongratsModal';
import OverlayBanner from './OverlayBanner';
import KillResultOverlay, { type KillResult } from './KillResultOverlay';
import WPMDisplay from './WPMDisplay';
import VerticalPlayerHealthBar from './VerticalPlayerHealthBar';
import PotionSlot from './PotionSlot';
import DailyCompletedOverlay from './DailyCompletedOverlay';
import TypingRestartButton from './TypingRestartButton';
import {
  HitPopups,
  AttackPopups,
  PotionPopups,
  SaveErrorBanner,
} from './TypingPopups';

import { useThemeContext } from '../hooks/useThemeContext';
import { useTypingMechanics } from '../hooks/useTypingMechanics';
import { usePerformanceTracking } from '../hooks/usePerformanceTracking';
import { useCompletionDetection } from '../hooks/useCompletionDetection';
import { useCompletionHandler } from '../hooks/useCompletionHandler';
import { useHitPopups } from '../hooks/useHitPopups';
import { useAttackPopups } from '../hooks/useAttackPopups';
import { usePotionPopups } from '../hooks/usePotionPopups';
import { useTypingCompletion } from '../hooks/useTypingCompletion';
import type { DailyProgressType } from '../hooks/useDailyProgress';
import type { CompletionResult } from '../types/completion';

interface TypingInterfaceProps {
  dailyProgress: DailyProgressType;
  reloadPlayerStats: () => Promise<void> | void;
  onXpGain?: (xp: number) => void;
}

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
    endlessWordCount,
    endlessDifficulty,
    damagePlayerFromMistake,
    isPlayerDead,
    hasStartedTyping,
    setHasStartedTyping,
    setIsPaused,
    registerCorrectWord,
    drinkPotion,
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

  // Surface the kill reward as a big "+N XP" under the Player Level card.
  useEffect(() => {
    if (earnedXp > 0) onXpGain?.(earnedXp);
  }, [earnedXp, onXpGain]);

  const handleWordCompleted = useCallback(() => {
    decrementRemainingWords();
    triggerHit();
    // Endless potions drop on a word clock; each correct word is a drop check.
    if (currentMode === 'endless') registerCorrectWord();
    // Also notify slime model to flash red
    try {
      window.dispatchEvent(new Event('word-hit'));
    } catch {
      /* ignore */
    }
  }, [decrementRemainingWords, triggerHit, currentMode, registerCorrectWord]);

  const typingMechanics = useTypingMechanics({
    text,
    onWordCompleted: handleWordCompleted,
    onWordMistake: damagePlayerFromMistake,
  });

  const charStatusRef = useRef(typingMechanics.charStatus);
  charStatusRef.current = typingMechanics.charStatus;

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
          : generateText(
              currentMode,
              undefined,
              endlessWordCount,
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
    endlessWordCount,
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
    if (containerRef.current) containerRef.current.focus();
  }, [
    text,
    currentMode,
    resetTypingState,
    resetSession,
    resetForNewSession,
    endlessWordCount,
    setHasStartedTyping,
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
    currentMode,
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

  // Dismiss the post-kill results panel and advance. Endless restarts the
  // session to spawn the next monster; Daily already regenerated the next
  // quote when its handler advanced the difficulty, so it only needs the
  // panel cleared.
  const handleContinue = useCallback(() => {
    if (!awaitingContinue) return;
    setAwaitingContinue(false);
    setKillResult(null);
    if (currentMode === 'endless') restartSession();
    // Clicking the panel can drop focus off the typing surface; restore it so
    // the player can start the next round without re-clicking.
    containerRef.current?.focus();
  }, [awaitingContinue, currentMode, restartSession]);

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (isPlayerDead) return;
    const { key } = e;
    // While the post-kill results panel is up, Space (or any typing key)
    // advances to the next monster/quote instead of feeding the input.
    if (awaitingContinue) {
      if (key === 'Tab') return;
      e.preventDefault();
      if (key === ' ' || key === 'Enter') handleContinue();
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
    dailyLocked;

  return (
    <>
      <div className="relative max-w-4xl mx-auto mt-4 flex items-stretch gap-4">
        <div className="flex-shrink-0 flex items-center">
          <VerticalPlayerHealthBar />
        </div>

        <div className="flex-1 relative">
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
              visible={!isFocused && !dailyLocked}
              message="Click to start fighting!"
              tone="info"
              onClick={() => containerRef.current?.focus()}
            />
          </div>

          <div className="absolute inset-0 flex items-center justify-center rounded-lg overflow-hidden pointer-events-none">
            <KillResultOverlay
              visible={awaitingContinue}
              result={killResult}
              onContinue={handleContinue}
            />
          </div>

          {dailyLocked && (
            <DailyCompletedOverlay resetTimeLeft={resetTimeLeft} />
          )}
        </div>

        {currentMode === 'endless' && (
          <div className="flex-shrink-0 flex items-center">
            <PotionSlot />
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
    </>
  );
}
