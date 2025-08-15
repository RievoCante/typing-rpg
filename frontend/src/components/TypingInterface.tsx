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

export default function TypingInterface({ dailyProgress, reloadPlayerStats }: TypingInterfaceProps) {
  // Context
  const { currentMode, setCurrentMode, setTotalWords, setRemainingWords, decrementRemainingWords } = useGameContext();
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
  const [xpPos, setXpPos] = useState<{ topPct: number; leftPct: number }>({ topPct: 45, leftPct: 50 });
  // HIT popup (re-using the same pattern as +XP)
  const [hitVisible, setHitVisible] = useState(false);
  const [hitShow, setHitShow] = useState(false);
  const [hitPos, setHitPos] = useState<{ topPct: number; leftPct: number }>({ topPct: 40, leftPct: 50 });
  const [isFocused, setIsFocused] = useState(false);
  const [celebrating, setCelebrating] = useState(false);
  const [celebrateText, setCelebrateText] = useState('');
  
  // Memoize specific values to avoid infinite re-renders
  const currentDifficulty = useMemo(() => dailyProgress.getCurrentDifficulty(), [dailyProgress]);
  const completedQuotes = useMemo(() => dailyProgress.completedQuotes, [dailyProgress.completedQuotes]);
  const quoteStats = useMemo(() => dailyProgress.quoteStats, [dailyProgress.quoteStats]);
  
  const completeCurrentQuote = dailyProgress.completeCurrentQuote;
  const getAverageWPM = dailyProgress.getAverageWPM;

  const [hasShownDailyCompletion, setHasShownDailyCompletion] = useState(false);
  const [isProcessingCompletion, setIsProcessingCompletion] = useState(false);
  
  const containerRef = useRef<HTMLDivElement>(null);

  const [hasStartedTyping, setHasStartedTyping] = useState(false);

  const handleWordCompleted = useCallback(() => {
    decrementRemainingWords();
    // Spawn HIT pop near monster area (similar to +XP pattern)
    const left = 50 + (Math.random() * 24 - 12); // 38% - 62%
    const top = 36 + (Math.random() * 16 - 8);  // 28% - 44%
    setHitPos({ topPct: top, leftPct: left });
    setHitVisible(true);
    const t1 = setTimeout(() => setHitShow(true), 10);
    const t2 = setTimeout(() => setHitShow(false), 220);
    const t3 = setTimeout(() => setHitVisible(false), 420);
    // Also notify slime model to flash red
    try { window.dispatchEvent(new Event('word-hit')); } catch { /* ignore */ }
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
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
    if (currentMode === 'daily') newText = generateText(currentMode, currentDifficulty);
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
  }, [currentMode, currentDifficulty, setTotalWords, setRemainingWords, resetTypingState, resetSession, resetForNewSession]);

  useEffect(() => {
    initializeNewText();
  }, [initializeNewText]);

  useEffect(() => {
    if (!dailyProgress.isCompleted) setHasShownDailyCompletion(false);
  }, [dailyProgress.isCompleted]);

  const { markAsProcessed, markSessionCompleted, isCompleted, isSessionAlreadyCompleted } = completion;
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

      const context: CompletionContext | undefined = currentMode === 'daily' ? {
        currentAttempts,
        completedQuotes,
        hasShownDailyCompletion,
        currentDifficulty,
      } : undefined;

      (async () => {
        const result: CompletionResult = await completionHandler.handleCompletion(stats, context);
        if (typeof result.xpDelta === 'number') setEarnedXp(result.xpDelta);
        // Refresh player stats from server after any completion
        await reloadPlayerStats();
        switch (result.action) {
          case 'retry':
            if (result.newAttempts !== undefined) setCurrentAttempts(result.newAttempts);
            setTimeout(() => { setIsProcessingCompletion(false); initializeNewText(); }, 1000);
            break;
          case 'nextQuote':
            if (result.newAttempts !== undefined) setCurrentAttempts(result.newAttempts);
            setTimeout(() => { setIsProcessingCompletion(false); initializeNewText(); }, 1000);
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
            setTimeout(() => { setIsProcessingCompletion(false); initializeNewText(); }, 1000);
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
    const top = 45 + (Math.random() * 20 - 10);  // 35% - 55%
    setXpPos({ topPct: top, leftPct: left });
    setXpVisible(true);
    // enter
    const t1 = setTimeout(() => setXpShow(true), 20);
    // leave
    const t2 = setTimeout(() => setXpShow(false), 1200);
    // unmount
    const t3 = setTimeout(() => setXpVisible(false), 1600);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [earnedXp]);

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const { key } = e;
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
    setCurrentMode('endless');
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
            ? 'bg-slate-800 text-white border border-gray-700' 
            : 'bg-white text-gray-900 border border-gray-200'
        } ${(!isFocused || celebrating) ? 'filter blur-sm brightness-95' : ''}`}
      >
        <TypingText
          text={text}
          charStatus={typingMechanics.charStatus}
          typedChars={typingMechanics.typedChars}
          cursorPosition={typingMechanics.cursorPosition}
          hasStartedTyping={hasStartedTyping}
        />

        <div className="flex justify-between items-center pt-4">
          <WPMDisplay wpm={performance.wpm} isCalculating={false} />
        </div>
        </div>

      {/* Focus prompt over the panel only */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none rounded-lg overflow-hidden">
        <OverlayBanner
          visible={!isFocused}
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
            style={{ top: `${xpPos.topPct}%`, left: `${xpPos.leftPct}%`, transform: 'translate(-50%, -50%)' }}
          >
            <span className="text-yellow-400 font-bold text-xl select-none drop-shadow">+{earnedXp} XP</span>
          </div>
        </div>
      )}

      {hitVisible && (
        <div className="fixed inset-0 pointer-events-none z-40">
          <div
            className={`absolute transition-all ${hitShow ? 'opacity-100 -translate-y-1 scale-110' : 'opacity-0 translate-y-0 scale-95'} duration-200 ease-out`}
            style={{ top: `${hitPos.topPct}%`, left: `${hitPos.leftPct}%`, transform: 'translate(-50%, -50%)' }}
          >
            <span className="text-red-500 font-extrabold text-xl select-none drop-shadow">HIT</span>
          </div>
        </div>
      )}
    </>
  );
}