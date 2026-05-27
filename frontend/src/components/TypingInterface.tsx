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
import CongratsModal from './CongratsModal';
import OverlayBanner from './OverlayBanner';
import { Share2, RotateCcw } from 'lucide-react';
import { getWpmTitle } from '../utils/wpmTitle';
import WPMDisplay from './WPMDisplay';
import VerticalPlayerHealthBar from './VerticalPlayerHealthBar';

// Context
import { useThemeContext } from '../hooks/useThemeContext';

// Custom Hooks
import { useTypingMechanics } from '../hooks/useTypingMechanics';
import { usePerformanceTracking } from '../hooks/usePerformanceTracking';
import { useCompletionDetection } from '../hooks/useCompletionDetection';
import { useCompletionHandler } from '../hooks/useCompletionHandler';
import type { DailyProgressType } from '../hooks/useDailyProgress';
import type { CompletionContext, CompletionResult } from '../types/completion';

interface TypingInterfaceProps {
  dailyProgress: DailyProgressType;
  reloadPlayerStats: () => Promise<void> | void; // injected from top-level hook
}

export default function TypingInterface({
  dailyProgress,
  reloadPlayerStats,
}: TypingInterfaceProps) {
  // Context
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

  // Core state - text
  const [text, setText] = useState<string>('');
  // Restart key to force text regeneration on manual restart
  const [restartKey, setRestartKey] = useState<number>(0);
  // Transition state for smooth text changes
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Daily mode state
  const [currentAttempts, setCurrentAttempts] = useState<number>(1);
  const [showCongratsModal, setShowCongratsModal] = useState<boolean>(false);
  const [earnedXp, setEarnedXp] = useState<number>(0);
  // XP popup
  const [xpVisible, setXpVisible] = useState(false);
  const [xpShow, setXpShow] = useState(false);
  const [xpPos, setXpPos] = useState<{ topPct: number; leftPct: number }>({
    topPct: 45,
    leftPct: 50,
  });
  // HIT popups - array-based for independent multiple hits
  interface HitItem {
    id: number;
    topPct: number;
    leftPct: number;
    show: boolean;
  }
  const [hits, setHits] = useState<HitItem[]>([]);
  const hitIdRef = useRef(0);

  // ATTACK! popups - array-based for independent multiple attacks
  interface AttackItem {
    id: number;
    topPct: number;
    leftPct: number;
    show: boolean;
  }
  const [attacks, setAttacks] = useState<AttackItem[]>([]);
  const attackIdRef = useRef(0);
  const [isFocused, setIsFocused] = useState(false);
  const [celebrating, setCelebrating] = useState(false);
  const [celebrateText, setCelebrateText] = useState('');
  const [resetTimeLeft, setResetTimeLeft] = useState<{
    hours: number;
    minutes: number;
    seconds: number;
  } | null>(null);

  // Memoize specific values to avoid infinite re-renders
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

  const handleWordCompleted = useCallback(() => {
    decrementRemainingWords();
    // Spawn HIT pop near monster area (independent from other hits)
    const left = 50 + (Math.random() * 24 - 12); // 38% - 62%
    const top = 36 + (Math.random() * 16 - 8); // 28% - 44%
    const id = ++hitIdRef.current;
    const newHit: HitItem = { id, topPct: top, leftPct: left, show: false };
    setHits(prev => [...prev, newHit]);
    // Trigger show animation
    const t1 = setTimeout(() => {
      setHits(prev => prev.map(h => (h.id === id ? { ...h, show: true } : h)));
    }, 10);
    // Start hide animation
    const t2 = setTimeout(() => {
      setHits(prev => prev.map(h => (h.id === id ? { ...h, show: false } : h)));
    }, 600);
    // Remove from array
    const t3 = setTimeout(() => {
      setHits(prev => prev.filter(h => h.id !== id));
    }, 900);
    // Also notify slime model to flash red
    try {
      window.dispatchEvent(new Event('word-hit'));
    } catch {
      /* ignore */
    }
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [decrementRemainingWords]);

  const typingMechanics = useTypingMechanics({
    text,
    onWordCompleted: handleWordCompleted,
    onWordMistake: damagePlayerFromMistake,
  });

  // Ref to read final charStatus inside completion effect without adding it to deps
  const charStatusRef = useRef(typingMechanics.charStatus);
  charStatusRef.current = typingMechanics.charStatus;

  // Handle monster attack event to show ATTACK! popup
  useEffect(() => {
    const handleMonsterAttack = () => {
      // Spawn ATTACK! popup near player health bar area
      const left = 15 + (Math.random() * 10 - 5); // 10% - 20% (left side near health bar)
      const top = 35 + (Math.random() * 20 - 10); // 25% - 45%
      const id = ++attackIdRef.current;
      const newAttack: AttackItem = {
        id,
        topPct: top,
        leftPct: left,
        show: false,
      };
      setAttacks(prev => [...prev, newAttack]);
      // Trigger show animation
      const t1 = setTimeout(() => {
        setAttacks(prev =>
          prev.map(a => (a.id === id ? { ...a, show: true } : a))
        );
      }, 10);
      // Start hide animation
      const t2 = setTimeout(() => {
        setAttacks(prev =>
          prev.map(a => (a.id === id ? { ...a, show: false } : a))
        );
      }, 600);
      // Remove from array
      const t3 = setTimeout(() => {
        setAttacks(prev => prev.filter(a => a.id !== id));
      }, 900);

      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
        clearTimeout(t3);
      };
    };

    window.addEventListener(
      'monster-attack',
      handleMonsterAttack as EventListener
    );
    return () => {
      window.removeEventListener(
        'monster-attack',
        handleMonsterAttack as EventListener
      );
    };
  }, []);

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

  // Effect 1: Generate new text when mode, word count, or restart key changes
  // Uses smooth fade transition to prevent flashing
  useEffect(() => {
    // Start transition - fade out
    setIsTransitioning(true);

    // Generate new text after brief delay for fade-out
    const timeoutId = setTimeout(() => {
      let newText: string;
      if (currentMode === 'daily')
        newText = generateText(currentMode, currentDifficulty);
      else
        newText = generateText(
          currentMode,
          undefined,
          endlessWordCount,
          endlessDifficulty
        );

      setText(newText);
      const wordCount = newText.match(/\S+/g)?.length || 0;
      setTotalWords(wordCount);
      setRemainingWords(wordCount);

      // Fade back in
      setIsTransitioning(false);
    }, 150); // 150ms for smooth fade-out

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

  // Manual restart function - increments restartKey to trigger text regeneration
  const restartSession = useCallback(() => {
    setRestartKey(prev => prev + 1);
  }, []);

  // Effect 2: Reset state when text actually changes
  // Separated from text generation to avoid circular dependency with resetTypingState
  useEffect(() => {
    if (text.length === 0) return; // Skip on initial mount

    resetTypingState();
    resetSession();
    resetForNewSession();
    setHasStartedTyping(false);
    setIsProcessingCompletion(false);
    setEarnedXp(0);
    // Note: Monster only changes when defeated (handled in completion handler)
    if (containerRef.current) containerRef.current.focus();
  }, [
    text,
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

  useEffect(() => {
    if (isCompleted && !isProcessingCompletion) {
      setIsProcessingCompletion(true);
      markAsProcessed();

      // Force health to 0% to trigger defeat state for last word
      // (decrementRemainingWords only fires on space, so last word needs this)
      setRemainingWords(0);

      if (!hasStartedTyping || !startTime || text.length === 0) {
        setIsProcessingCompletion(false);
        restartSession();
        return;
      }

      if (isSessionAlreadyCompleted) {
        setIsProcessingCompletion(false);
        return;
      }
      markSessionCompleted();

      // Check if the last word (no trailing space) has any incorrect chars.
      // Words completed with space already triggered damage in handleSpaceBar.
      // The final word only gets punished here if it was typed wrong.
      const finalCharStatus = charStatusRef.current;
      if (finalCharStatus.length > 0) {
        // Find the start of the last word (after the last space, or start of text)
        let lastWordStart = text.length - 1;
        while (lastWordStart >= 0 && text[lastWordStart] !== ' ') {
          lastWordStart--;
        }
        lastWordStart++; // move past the space (or to 0 if no space found)

        const hasLastWordMistake = finalCharStatus
          .slice(lastWordStart)
          .some(status => status === 'incorrect');
        if (hasLastWordMistake) {
          damagePlayerFromMistake();
        }
      }

      const stats = calculateFinalStats();
      if (!stats) {
        setIsProcessingCompletion(false);
        restartSession();
        return;
      }

      const context: CompletionContext | undefined =
        currentMode === 'daily'
          ? {
              currentAttempts,
              completedQuotes,
              hasShownDailyCompletion,
              currentDifficulty,
            }
          : undefined;

      (async () => {
        const result: CompletionResult =
          await completionHandler.handleCompletion(stats, context);

        if (result.action === 'saveError') {
          setSaveError(result.message ?? 'Failed to save. Please retry.');
          setPendingRetrySave(() => result.retrySave ?? null);
          setIsProcessingCompletion(false);
          return;
        }

        if (typeof result.xpDelta === 'number') setEarnedXp(result.xpDelta);

        // Monster defeated - spawn new one
        incrementMonstersDefeated();

        // Background refresh - don't block UI
        reloadPlayerStats();

        switch (result.action) {
          case 'retry':
            if (result.newAttempts !== undefined)
              setCurrentAttempts(result.newAttempts);
            setTimeout(() => {
              setIsProcessingCompletion(false);
              restartSession();
            }, 400); // Fast spawn
            break;
          case 'nextQuote':
            if (result.newAttempts !== undefined)
              setCurrentAttempts(result.newAttempts);
            setIsProcessingCompletion(false);
            setCelebrateText('Next challenge!');
            setCelebrating(true);
            setTimeout(() => setCelebrating(false), 400);
            break;
          case 'showModal':
            setIsProcessingCompletion(false);
            break;
          case 'loadNewText':
          default:
            if (currentMode === 'endless') {
              setCelebrateText(getWpmTitle(stats.finalWpm));
              setCelebrating(true);
              setTimeout(() => setCelebrating(false), 400);
            }
            setTimeout(() => {
              setIsProcessingCompletion(false);
              restartSession();
            }, 400); // Fast spawn for endless mode
            break;
        }
      })();
    }
  }, [
    isCompleted,
    isProcessingCompletion,
    isSessionAlreadyCompleted,
    startTime,
    text,
    text.length,
    currentMode,
    currentDifficulty,
    currentAttempts,
    completedQuotes,
    hasShownDailyCompletion,
    hasStartedTyping,
    markAsProcessed,
    markSessionCompleted,
    calculateFinalStats,
    restartSession,
    completionHandler,
    reloadPlayerStats,
    incrementMonstersDefeated,
    setRemainingWords,
    damagePlayerFromMistake,
  ]);

  // Trigger XP popup animation when XP earned
  useEffect(() => {
    if (!earnedXp || earnedXp <= 0) return;
    // randomize position around screen center
    const left = 50 + (Math.random() * 30 - 15); // 35% - 65%
    const top = 45 + (Math.random() * 20 - 10); // 35% - 55%
    setXpPos({ topPct: top, leftPct: left });
    setXpVisible(true);
    // enter
    const t1 = setTimeout(() => setXpShow(true), 20);
    // leave
    const t2 = setTimeout(() => setXpShow(false), 1200);
    // unmount
    const t3 = setTimeout(() => setXpVisible(false), 1600);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [earnedXp]);

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    // Prevent all typing when player is dead
    if (isPlayerDead) return;

    const { key } = e;
    // Allow focus traversal and system shortcuts
    if (key === 'Tab') return;

    // Only handle and prevent default for keys we process
    if (key === ' ') {
      e.preventDefault();
      typingMechanics.handleSpaceBar();
    } else if (key === 'Backspace') {
      e.preventDefault();
      if (e.ctrlKey || e.altKey) typingMechanics.handleWordDeletion();
      else typingMechanics.handleBackspace();
    } else if (key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
      // Only typing characters (no modifiers)
      e.preventDefault();
      if (!hasStartedTyping) {
        setHasStartedTyping(true);
        performance.startSession();
      }
      typingMechanics.handleCharacterInput(key);
    }
    // Let all other keys (system shortcuts like cmd+tab) pass through
  };

  const handleModalContinue = () => {
    setShowCongratsModal(false);
  };

  const handleModalClose = () => {
    setShowCongratsModal(false);
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
    if (result.action === 'showModal') {
      setShowCongratsModal(true);
    }
  }, [pendingRetrySave, reloadPlayerStats]);

  return (
    <>
      <div className="relative max-w-4xl mx-auto mt-4 flex items-stretch gap-4">
        {/* Vertical Player Health Bar - Left Side */}
        <div className="flex-shrink-0 flex items-center">
          <VerticalPlayerHealthBar />
        </div>

        {/* Main typing area */}
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
            } ${!isFocused || celebrating || isProcessingCompletion || isPlayerDead || (currentMode === 'daily' && dailyProgress.isCompletedToday) ? 'filter blur-sm brightness-95' : ''} ${isTransitioning ? 'opacity-50' : 'opacity-100'}`}
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

            {/* Reset button with tooltip and keyboard hint */}
            <div className="absolute bottom-4 right-4 z-10 group">
              <button
                type="button"
                aria-label="Restart typing"
                onClick={restartSession}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    restartSession();
                  }
                }}
                tabIndex={0}
                className="rounded-full p-3 transition-colors bg-transparent text-gray-700 hover:bg-black/10 dark:text-gray-200 dark:hover:bg-white/10"
              >
                <RotateCcw size={18} />
              </button>
              <div
                className={`absolute right-full mr-2 top-1/2 -translate-y-1/2 px-2 py-1 text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 delay-0 group-hover:delay-[750ms] whitespace-nowrap ${
                  theme === 'dark'
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-800 text-white'
                }`}
              >
                restart
                <span className="ml-2 opacity-80">
                  <kbd
                    className={`px-1.5 py-0.5 rounded border ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-gray-200 border-gray-300'}`}
                  >
                    tab
                  </kbd>
                  <span className="mx-1">+</span>
                  <kbd
                    className={`px-1.5 py-0.5 rounded border ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-gray-200 border-gray-300'}`}
                  >
                    enter
                  </kbd>
                </span>
              </div>
            </div>
          </div>

          {/* Focus prompt over the panel only */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none rounded-lg overflow-hidden">
            <OverlayBanner
              visible={
                !isFocused &&
                !(currentMode === 'daily' && dailyProgress.isCompletedToday)
              }
              message="Click to start fighting!"
              tone="info"
              onClick={() => containerRef.current?.focus()}
            />
          </div>

          {/* Endless celebration over the panel only */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none rounded-lg overflow-hidden">
            <OverlayBanner
              visible={celebrating}
              message={celebrateText}
              tone="celebrate"
            />
          </div>

          {/* Daily completed overlay over the panel only */}
          {currentMode === 'daily' && dailyProgress.isCompletedToday && (
            <div className="absolute inset-0 flex items-center justify-center rounded-lg overflow-hidden">
              <div className="flex flex-col items-center gap-3 pointer-events-auto">
                <div className="px-6 py-2 rounded-lg text-white font-extrabold text-2xl bg-emerald-600/90 shadow">
                  COMPLETED!
                </div>
                {resetTimeLeft && (
                  <div
                    className="text-xs sm:text-sm -mt-1 text-black dark:text-white"
                    style={{ color: theme === 'dark' ? '#ffffff' : '#000000' }}
                  >
                    Resets in {String(resetTimeLeft.hours).padStart(2, '0')}:
                    {String(resetTimeLeft.minutes).padStart(2, '0')}:
                    {String(resetTimeLeft.seconds).padStart(2, '0')} UTC
                  </div>
                )}
                <button
                  type="button"
                  className="flex items-center gap-2 px-4 py-2 rounded-md bg-white/90 text-black hover:bg-white transition-colors shadow dark:bg-white/10 dark:text-white dark:hover:bg-white/20"
                >
                  <Share2
                    size={16}
                    className="text-black dark:text-white"
                    style={{ color: theme === 'dark' ? '#ffffff' : '#000000' }}
                  />
                  <span
                    className="text-black dark:text-white"
                    style={{ color: theme === 'dark' ? '#ffffff' : '#000000' }}
                  >
                    Share
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <CongratsModal
        isOpen={showCongratsModal}
        onClose={handleModalClose}
        totalXP={earnedXp}
        averageWPM={getAverageWPM()}
        quoteStats={quoteStats}
        onContinue={handleModalContinue}
      />

      {xpVisible && earnedXp > 0 && (
        <div className="fixed inset-0 pointer-events-none z-50">
          <div
            className={`absolute transition-all ${xpShow ? 'opacity-100 -translate-y-2' : 'opacity-0 translate-y-1'} duration-300 ease-out`}
            style={{
              top: `${xpPos.topPct}%`,
              left: `${xpPos.leftPct}%`,
              transform: 'translate(-50%, -50%)',
            }}
          >
            <span className="text-yellow-400 font-bold text-xl select-none drop-shadow">
              +{earnedXp} XP
            </span>
          </div>
        </div>
      )}

      {saveError && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 rounded-lg bg-red-700 text-white shadow-xl">
          <span className="text-sm">{saveError}</span>
          <button
            type="button"
            onClick={handleRetrySave}
            className="px-3 py-1 rounded bg-white text-red-700 text-sm font-semibold hover:bg-red-100 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Multiple independent HIT effects */}
      {hits.map(hit => (
        <div key={hit.id} className="fixed inset-0 pointer-events-none z-40">
          <div
            className={`absolute transition-all ${hit.show ? 'opacity-100 -translate-y-1 scale-110' : 'opacity-0 translate-y-0 scale-95'} duration-500 ease-out`}
            style={{
              top: `${hit.topPct}%`,
              left: `${hit.leftPct}%`,
              transform: 'translate(-50%, -50%)',
            }}
          >
            <span className="text-red-500 font-extrabold text-xl select-none drop-shadow">
              HIT
            </span>
          </div>
        </div>
      ))}

      {/* Multiple independent ATTACK! effects */}
      {attacks.map(attack => (
        <div key={attack.id} className="fixed inset-0 pointer-events-none z-40">
          <div
            className={`absolute transition-all ${attack.show ? 'opacity-100 -translate-y-1 scale-110' : 'opacity-0 translate-y-0 scale-95'} duration-500 ease-out`}
            style={{
              top: `${attack.topPct}%`,
              left: `${attack.leftPct}%`,
              transform: 'translate(-50%, -50%)',
            }}
          >
            <span className="text-purple-500 font-extrabold text-xl select-none drop-shadow">
              ATTACK!
            </span>
          </div>
        </div>
      ))}
    </>
  );
}
