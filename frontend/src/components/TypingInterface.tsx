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

interface TypingInterfaceProps {
  addXp: (amount: number) => void;
  dailyProgress: DailyProgressType;
}

export default function TypingInterface({ addXp, dailyProgress }: TypingInterfaceProps) {
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
  
  // Use daily progress methods directly (they're already stable)
  const completeCurrentQuote = dailyProgress.completeCurrentQuote;
  const getAverageWPM = dailyProgress.getAverageWPM;

  // Add state to track if daily completion modal has been shown for this completion
  const [hasShownDailyCompletion, setHasShownDailyCompletion] = useState(false);
  const [hasAwardedDailyXP, setHasAwardedDailyXP] = useState(false);
  
  // Add processing flag to prevent duplicate completion processing
  const [isProcessingCompletion, setIsProcessingCompletion] = useState(false);
  
  const containerRef = useRef<HTMLDivElement>(null);

  // Separate hasStartedTyping state to avoid circular dependency
  const [hasStartedTyping, setHasStartedTyping] = useState(false);

  // Create callback for word completion
  const handleWordCompleted = useCallback(() => {
    decrementRemainingWords();
  }, [decrementRemainingWords]);

  // Use custom hooks
  const typingMechanics = useTypingMechanics({
    text,
    onWordCompleted: handleWordCompleted
  });

  const performance = usePerformanceTracking({
    text,
    charStatus: typingMechanics.charStatus,
    hasStartedTyping,
    cursorPosition: typingMechanics.cursorPosition
  });

  const completion = useCompletionDetection({
    cursorPosition: typingMechanics.cursorPosition,
    textLength: text.length,
    hasStartedTyping,
  });

  // Extract reset methods
  const { resetTypingState } = typingMechanics;
  const { resetSession } = performance;
  const { resetForNewSession } = completion;

  // Initialize new text - this is the only place where text changes
  const initializeNewText = useCallback(() => {
    let newText: string;
    
    if (currentMode === 'daily') {
      // Get current difficulty from daily progress
      newText = generateText(currentMode, currentDifficulty);
    } else {
      newText = generateText(currentMode);
    }
    
    setText(newText);
    
    // Calculate and set word counts for GameContext
    const wordCount = newText.match(/\S+/g)?.length || 0;
    setTotalWords(wordCount);
    setRemainingWords(wordCount);
    
    resetTypingState();
    resetSession();
    resetForNewSession();
    setHasStartedTyping(false);
    setIsProcessingCompletion(false); // Reset processing flag for new text
    
    if (containerRef.current) {
      containerRef.current.focus();
    }
  }, [currentMode, currentDifficulty, setTotalWords, setRemainingWords, resetTypingState, resetSession, resetForNewSession]);

  useEffect(() => {
    initializeNewText();
  }, [initializeNewText]);

  // Reset daily completion modal state when daily progress is reset or when not completed
  useEffect(() => {
    if (!dailyProgress.isCompleted) {
      setHasShownDailyCompletion(false);
      setHasAwardedDailyXP(false);
    }
  }, [dailyProgress.isCompleted]);

  // Extract methods to avoid dependency issues
  const { markAsProcessed, markSessionCompleted, isCompleted, isSessionAlreadyCompleted } = completion;
  const { startTime, calculateFinalStats } = performance;

  // Create stable callback for modal showing to prevent handler recreation
  const onShowModal = useCallback(() => {
    setShowCongratsModal(true);
    setHasShownDailyCompletion(true);
  }, []);

  // Completion handler for clean separation of concerns
  const completionHandler = useCompletionHandler({
    currentMode,
    addXp,
    completeCurrentQuote,
    getAverageWPM,
    onShowModal
  });

  // Handle completion when detected
  useEffect(() => {
    if (isCompleted && !isProcessingCompletion) {
      setIsProcessingCompletion(true);
      markAsProcessed();
      
      // Basic validation
      if (!hasStartedTyping || !startTime || text.length === 0) {
        setIsProcessingCompletion(false);
        initializeNewText();
        return;
      }

      // Prevent duplicate completion calls
      if (isSessionAlreadyCompleted) {
        console.log('Completion already processed for this session, skipping...');
        setIsProcessingCompletion(false);
        return;
      }
      markSessionCompleted();

      // Calculate final performance stats
      const stats = calculateFinalStats();
      if (!stats) {
        setIsProcessingCompletion(false);
        initializeNewText();
        return;
      }

      // Use the completion handler to process the result
      const context = currentMode === 'daily' ? {
        currentAttempts,
        completedQuotes,
        hasShownDailyCompletion,
        currentDifficulty
      } : undefined;

      const result = completionHandler.handleCompletion(stats, context);

      // Handle the result based on the action
      switch (result.action) {
        case 'retry':
          if (result.newAttempts !== undefined) {
            setCurrentAttempts(result.newAttempts);
          }
          // Delay text initialization to keep WPM visible briefly
          setTimeout(() => {
            setIsProcessingCompletion(false);
            initializeNewText();
          }, 1000);
          break;
          
        case 'nextQuote':
          if (result.newAttempts !== undefined) {
            setCurrentAttempts(result.newAttempts);
          }
          // Delay text initialization to keep WPM visible briefly
          setTimeout(() => {
            setIsProcessingCompletion(false);
            initializeNewText();
          }, 1000);
          break;
          
        case 'showModal':
          // Modal will be shown by the handler's onShowModal callback
          // Don't load new text, let modal handle continuation
          setIsProcessingCompletion(false);
          break;
          
        case 'loadNewText':
          // Delay text initialization to keep WPM visible briefly
          setTimeout(() => {
            setIsProcessingCompletion(false);
            initializeNewText();
          }, 1000);
          break;
          
        default:
          // Fallback - load new text
          setTimeout(() => {
            setIsProcessingCompletion(false);
            initializeNewText();
          }, 1000);
          break;
      }
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
    completionHandler
  ]);

  // Main keyboard handler
  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    e.preventDefault();

    const { key } = e;

    if (key === ' ') {
      typingMechanics.handleSpaceBar();
    } else if (key === 'Backspace') {
      if (e.ctrlKey || e.altKey) {
        typingMechanics.handleWordDeletion();
      } else {
        typingMechanics.handleBackspace();
      }
    } else if (key.length === 1) {
      // Start performance tracking on first character
      if (!hasStartedTyping) {
        setHasStartedTyping(true);
        performance.startSession();
      }
      typingMechanics.handleCharacterInput(key);
    }
  };

  // Calculate total XP for daily completion (500 base + performance bonus)
  const calculateDailyXP = (): number => {
    // Base XP: 500
    // Performance bonus: +10 XP per WPM over 30, max +200
    const avgWpm = getAverageWPM();
    const performanceBonus = Math.min(Math.max(0, avgWpm - 30) * 10, 200);
    return 500 + performanceBonus;
  };

  const handleModalContinue = () => {
    // Award daily completion XP only once
    if (!hasAwardedDailyXP) {
      addXp(calculateDailyXP());
      setHasAwardedDailyXP(true);
    }
    
    setCurrentMode('endless'); // Switch to endless mode
    setShowCongratsModal(false);
  };

  const handleModalClose = () => {
    // Award daily completion XP only once
    if (!hasAwardedDailyXP) {
      addXp(calculateDailyXP());
      setHasAwardedDailyXP(true);
    }
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

      {/* Congratulations Modal for Daily Challenge Completion */}
      <CongratsModal
        isOpen={showCongratsModal}
        onClose={handleModalClose}
        totalXP={calculateDailyXP()}
        averageWPM={getAverageWPM()}
        quoteStats={quoteStats}
        onContinue={handleModalContinue}
      />
    </>
  );
}