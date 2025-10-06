import { useState, useCallback, useEffect } from 'react';

interface UseCompletionDetectionProps {
  cursorPosition: number;
  textLength: number;
  hasStartedTyping: boolean;
  onTextChange?: () => void;
}

export const useCompletionDetection = ({
  cursorPosition,
  textLength,
  hasStartedTyping,
  onTextChange,
}: UseCompletionDetectionProps) => {
  const [hasProcessedCompletion, setHasProcessedCompletion] = useState(false);
  const [hasCompletedCurrentSession, setHasCompletedCurrentSession] =
    useState(false);

  // Check if typing is completed
  const isCompleted =
    hasStartedTyping && cursorPosition >= textLength && !hasProcessedCompletion;

  // Mark completion as processed
  const markAsProcessed = useCallback(() => {
    setHasProcessedCompletion(true);
  }, []);

  // Mark session as completed (prevents duplicate completion calls)
  const markSessionCompleted = useCallback(() => {
    setHasCompletedCurrentSession(true);
  }, []);

  // Reset flags for new session
  const resetForNewSession = useCallback(() => {
    setHasProcessedCompletion(false);
    setHasCompletedCurrentSession(false);
  }, []);

  // Check if session was already completed (for duplicate prevention)
  const isSessionAlreadyCompleted = hasCompletedCurrentSession;

  // Reset completion processing flag when text changes
  useEffect(() => {
    setHasProcessedCompletion(false);
    onTextChange?.();
  }, [textLength, onTextChange]);

  return {
    // State
    isCompleted,
    isSessionAlreadyCompleted,
    hasProcessedCompletion,

    // Actions
    markAsProcessed,
    markSessionCompleted,
    resetForNewSession,
  };
};
