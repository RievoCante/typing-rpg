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
import WPMDisplay from './WPMDisplay';
import VerticalPlayerHealthBar from './VerticalPlayerHealthBar';
import DailyCompletedOverlay from './DailyCompletedOverlay';
import TypingRestartButton from './TypingRestartButton';
import {
  HitPopups,
  AttackPopups,
  XpPopup,
  SaveErrorBanner,
} from './TypingPopups';

import { useThemeContext } from '../hooks/useThemeContext';
import { useTypingMechanics } from '../hooks/useTypingMechanics';
import { usePerformanceTracking } from '../hooks/usePerformanceTracking';
import { useCompletionDetection } from '../hooks/useCompletionDetection';
import { useCompletionHandler } from '../hooks/useCompletionHandler';
import { useHitPopups } from '../hooks/useHitPopups';
import { useAttackPopups } from '../hooks/useAttackPopups';
import { useXpPopup } from '../hooks/useXpPopup';
import { useTypingCompletion } from '../hooks/useTypingCompletion';
import type { DailyProgressType } from '../hooks/useDailyProgress';
import type { CompletionResult } from '../types/completion';

interface TypingInterfaceProps {
  dailyProgress: DailyProgressType;
  reloadPlayerStats: () => Promise<void> | void;
}

export default function TypingInterface({
  dailyProgress,
  reloadPlayerStats,
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
  } = useGameContext();
  const { theme } = useThemeContext();

  const [text, setText] = useState<string>('');
  const [restartKey, setRestartKey] = useState<number>(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const [currentAttempts, setCurrentAttempts] = useState<number>(1);
  const [showCongratsModal, setShowCongratsModal] = useState<boolean>(false);
  const [earnedXp, setEarnedXp] = useState<number>(0);
  const [isFocused, setIsFocused] = useState(false);
  const [celebrating, setCelebrating] = useState(false);
  const [celebrateText, setCelebrateText] = useState('');
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
  const xpPopup = useXpPopup(earnedXp);

  const handleWordCompleted = useCallback(() => {
    decrementRemainingWords();
    triggerHit();
    // Also notify slime model to flash red
    try {
      window.dispatchEvent(new Event('word-hit'));
    } catch {
      /* ignore */
    }
  }, [decrementRemainingWords, triggerHit]);

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
    setCelebrating,
    setCelebrateText,
    setSaveError,
    setPendingRetrySave,
  });

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (isPlayerDead) return;
    const { key } = e;
    if (key === 'Tab') return;
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
    celebrating ||
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
            className={`p-8 rounded-lg shadow-xl flex flex-col space-y-6 focus:outline-none transition-all duration-300 ${
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

          <div className="absolute inset-0 flex items-center justify-center pointer-events-none rounded-lg overflow-hidden">
            <OverlayBanner
              visible={celebrating}
              message={celebrateText}
              tone="celebrate"
            />
          </div>

          {dailyLocked && (
            <DailyCompletedOverlay resetTimeLeft={resetTimeLeft} />
          )}
        </div>
      </div>

      <CongratsModal
        isOpen={showCongratsModal}
        onClose={() => setShowCongratsModal(false)}
        totalXP={earnedXp}
        averageWPM={getAverageWPM()}
        quoteStats={quoteStats}
        onContinue={() => setShowCongratsModal(false)}
      />

      <XpPopup state={xpPopup} earnedXp={earnedXp} />

      {saveError && (
        <SaveErrorBanner message={saveError} onRetry={handleRetrySave} />
      )}

      <HitPopups hits={hits} />
      <AttackPopups attacks={attacks} />
    </>
  );
}
