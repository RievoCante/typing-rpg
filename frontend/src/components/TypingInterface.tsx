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
}

export default function TypingInterface({ dailyProgress }: TypingInterfaceProps) {
  // Context
  const { currentMode, setCurrentMode, setTotalWords, setRemainingWords, decrementRemainingWords } = useGameContext();
  const { theme } = useThemeContext();

  // Core state - text
  const [text, setText] = useState<string>('');
  
  // Daily mode state
  const [currentAttempts, setCurrentAttempts] = useState<number>(1);
  const [showCongratsModal, setShowCongratsModal] = useState<boolean>(false);
  
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
  ]);

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
      <div
        ref={containerRef}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        className={`max-w-3xl mx-auto mt-8 p-8 rounded-lg shadow-xl flex flex-col space-y-6 focus:outline-none transition-colors duration-300 ${
          theme === 'dark' 
            ? 'bg-slate-800 text-white border border-gray-700' 
            : 'bg-white text-gray-900 border border-gray-200'
        }`}
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

      <CongratsModal
        isOpen={showCongratsModal}
        onClose={handleModalClose}
        totalXP={0}
        averageWPM={getAverageWPM()}
        quoteStats={quoteStats}
        onContinue={handleModalContinue}
      />
    </>
  );
}