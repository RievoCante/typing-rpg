import {
  useState,
  useEffect,
  type KeyboardEvent,
  useRef,
  useCallback,
  useMemo,
} from 'react';
import TypingText from './TypingText';
import { generateText } from '../utils/textGenerator';
import CongratsModal from './CongratsModal';
import OverlayBanner from './OverlayBanner';
import { Share2, RotateCcw } from 'lucide-react';
import { getWpmTitle } from '../utils/wpmTitle';
import WPMDisplay from './WPMDisplay';

// Context
import { useGameContext } from '../hooks/useGameContext';
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
  } = useGameContext();
  const { theme } = useThemeContext();

  // Core state - text
  const [text, setText] = useState<string>('');

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
  // HIT popup (re-using the same pattern as +XP)
  const [hitVisible, setHitVisible] = useState(false);
  const [hitShow, setHitShow] = useState(false);
  const [hitPos, setHitPos] = useState<{ topPct: number; leftPct: number }>({
    topPct: 40,
    leftPct: 50,
  });
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

  const containerRef = useRef<HTMLDivElement>(null);

  const [hasStartedTyping, setHasStartedTyping] = useState(false);

  const handleWordCompleted = useCallback(() => {
    decrementRemainingWords();
    // Spawn HIT pop near monster area (similar to +XP pattern)
    const left = 50 + (Math.random() * 24 - 12); // 38% - 62%
    const top = 36 + (Math.random() * 16 - 8); // 28% - 44%
    setHitPos({ topPct: top, leftPct: left });
    setHitVisible(true);
    const t1 = setTimeout(() => setHitShow(true), 10);
    const t2 = setTimeout(() => setHitShow(false), 220);
    const t3 = setTimeout(() => setHitVisible(false), 420);
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
  });

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

  const initializeNewText = useCallback(() => {
    let newText: string;
    if (currentMode === 'daily')
      newText = generateText(currentMode, currentDifficulty);
    else newText = generateText(currentMode);

    setText(newText);
    const wordCount = newText.match(/\S+/g)?.length || 0;
    setTotalWords(wordCount);
    setRemainingWords(wordCount);
    resetTypingState();
    resetSession();
    resetForNewSession();
    setHasStartedTyping(false);
    setIsProcessingCompletion(false);
    setEarnedXp(0);
    if (containerRef.current) containerRef.current.focus();
  }, [
    currentMode,
    currentDifficulty,
    setTotalWords,
    setRemainingWords,
    resetTypingState,
    resetSession,
    resetForNewSession,
  ]);

  useEffect(() => {
    initializeNewText();
  }, [initializeNewText]);

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

      if (!hasStartedTyping || !startTime || text.length === 0) {
        setIsProcessingCompletion(false);
        initializeNewText();
        return;
      }

      if (isSessionAlreadyCompleted) {
        setIsProcessingCompletion(false);
        return;
      }
      markSessionCompleted();

      const stats = calculateFinalStats();
      if (!stats) {
        setIsProcessingCompletion(false);
        initializeNewText();
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
        if (typeof result.xpDelta === 'number') setEarnedXp(result.xpDelta);
        // Refresh player stats from server after any completion
        await reloadPlayerStats();
        switch (result.action) {
          case 'retry':
            if (result.newAttempts !== undefined)
              setCurrentAttempts(result.newAttempts);
            setTimeout(() => {
              setIsProcessingCompletion(false);
              initializeNewText();
            }, 1000);
            break;
          case 'nextQuote':
            if (result.newAttempts !== undefined)
              setCurrentAttempts(result.newAttempts);
            setIsProcessingCompletion(false);
            // Show a brief overlay like Endless for consistency
            setCelebrateText('Next challenge!');
            setCelebrating(true);
            setTimeout(() => setCelebrating(false), 1000);
            break;
          case 'showModal':
            setIsProcessingCompletion(false);
            break;
          case 'loadNewText':
          default:
            if (currentMode === 'endless') {
              setCelebrateText(getWpmTitle(stats.finalWpm));
              setCelebrating(true);
              setTimeout(() => setCelebrating(false), 1000);
            }
            setTimeout(() => {
              setIsProcessingCompletion(false);
              initializeNewText();
            }, 1000);
            break;
        }
      })();
    }
  }, [
    isCompleted,
    isProcessingCompletion,
    isSessionAlreadyCompleted,
    startTime,
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
    initializeNewText,
    completionHandler,
    reloadPlayerStats,
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
    const { key } = e;
    // Allow focus traversal
    if (key === 'Tab') return;
    e.preventDefault();
    if (key === ' ') typingMechanics.handleSpaceBar();
    else if (key === 'Backspace') {
      if (e.ctrlKey || e.altKey) typingMechanics.handleWordDeletion();
      else typingMechanics.handleBackspace();
    } else if (key.length === 1) {
      if (!hasStartedTyping) {
        setHasStartedTyping(true);
        performance.startSession();
      }
      typingMechanics.handleCharacterInput(key);
    }
  };

  const handleModalContinue = () => {
    setShowCongratsModal(false);
  };

  const handleModalClose = () => {
    setShowCongratsModal(false);
  };

  return (
    <>
      <div className="relative max-w-3xl mx-auto mt-8">
        <div
          ref={containerRef}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          tabIndex={0}
          className={`p-8 rounded-lg shadow-xl flex flex-col space-y-6 focus:outline-none transition-colors duration-300 ${
            theme === 'dark'
              ? 'bg-[#2A2C3C] text-white border border-gray-700'
              : 'bg-white text-gray-900 border border-gray-200'
          } ${!isFocused || celebrating || (currentMode === 'daily' && dailyProgress.isCompletedToday) ? 'filter blur-sm brightness-95' : ''}`}
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
        </div>

        {/* Reset button with tooltip and keyboard hint */}
        <div className="absolute bottom-4 right-4 z-10 group">
          <button
            type="button"
            aria-label="Restart typing"
            onClick={initializeNewText}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                initializeNewText();
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

      {hitVisible && (
        <div className="fixed inset-0 pointer-events-none z-40">
          <div
            className={`absolute transition-all ${hitShow ? 'opacity-100 -translate-y-1 scale-110' : 'opacity-0 translate-y-0 scale-95'} duration-200 ease-out`}
            style={{
              top: `${hitPos.topPct}%`,
              left: `${hitPos.leftPct}%`,
              transform: 'translate(-50%, -50%)',
            }}
          >
            <span className="text-red-500 font-extrabold text-xl select-none drop-shadow">
              HIT
            </span>
          </div>
        </div>
      )}
    </>
  );
}
