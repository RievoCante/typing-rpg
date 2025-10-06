import { useEffect, useRef } from 'react';
import { Share2 } from 'lucide-react';

interface QuoteStats {
  difficulty: 'easy' | 'medium' | 'hard';
  wpm: number;
  attempts: number;
}

interface CongratModalProps {
  isOpen: boolean;
  onClose: () => void;
  totalXP: number;
  averageWPM: number;
  quoteStats: QuoteStats[];
  onContinue: () => void; // Switch to endless mode
}

export default function CongratModal({
  isOpen,
  onClose,
  totalXP,
  averageWPM,
  quoteStats,
  onContinue,
}: CongratModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  // Close modal when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        modalRef.current &&
        !modalRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  // Close on escape key
  useEffect(() => {
    function handleEscKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscKey);
    }

    return () => {
      document.removeEventListener('keydown', handleEscKey);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleShare = () => {
    const shareText = `I just completed the Daily Challenge in Typing RPG with ${averageWPM} WPM average and earned ${totalXP} XP! Can you beat my score?`;

    if (navigator.share) {
      navigator
        .share({
          title: 'Typing RPG Daily Challenge',
          text: shareText,
          url: window.location.href,
        })
        .catch(error => console.log('Error sharing', error));
    } else {
      // Fallback for browsers that don't support the Web Share API
      navigator.clipboard
        .writeText(shareText)
        .then(() => alert('Share text copied to clipboard!'))
        .catch(err => console.error('Could not copy text: ', err));
    }
  };

  const handleContinue = () => {
    onContinue(); // Switch to endless mode and close modal
  };

  const getDifficultyLabel = (
    difficulty: 'easy' | 'medium' | 'hard'
  ): string => {
    switch (difficulty) {
      case 'easy':
        return 'Monster';
      case 'medium':
        return 'Mini Boss';
      case 'hard':
        return 'Boss';
    }
  };

  const getDifficultyEmoji = (
    difficulty: 'easy' | 'medium' | 'hard'
  ): string => {
    switch (difficulty) {
      case 'easy':
        return '👹';
      case 'medium':
        return '👺';
      case 'hard':
        return '👾';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div
        ref={modalRef}
        className="bg-gray-800 rounded-lg p-6 shadow-lg w-full max-w-md"
      >
        <div className="text-center">
          <h2 className="text-2xl font-bold text-yellow-400 mb-2">
            Daily Challenge Complete!
          </h2>
          <p className="text-gray-300 mb-6">
            Congratulations on defeating all enemies! 🎉
          </p>

          {/* Quote Performance Stats */}
          <div className="bg-gray-700 rounded-lg p-4 mb-6">
            <h3 className="text-lg font-semibold text-white mb-3">
              Battle Results
            </h3>
            <div className="space-y-3">
              {quoteStats.map((stat, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">
                      {getDifficultyEmoji(stat.difficulty)}
                    </span>
                    <span className="text-gray-300">
                      {getDifficultyLabel(stat.difficulty)}
                    </span>
                    {stat.attempts > 1 && (
                      <span className="text-xs text-gray-400">
                        ({stat.attempts} attempts)
                      </span>
                    )}
                  </div>
                  <span className="font-mono text-green-400">
                    {stat.wpm} WPM
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Total XP Earned */}
          <div className="bg-gray-700 rounded-lg p-4 mb-6">
            <h3 className="text-lg font-semibold text-white mb-1">XP Earned</h3>
            <p className="text-2xl font-mono font-bold text-yellow-400">
              +{totalXP} XP
            </p>
          </div>

          {/* Average WPM */}
          <div className="bg-gray-700 rounded-lg p-4 mb-6">
            <h3 className="text-lg font-semibold text-white mb-1">
              Average Typing Speed
            </h3>
            <p className="text-2xl font-mono font-bold text-green-400">
              {averageWPM} WPM
            </p>
          </div>

          <div className="flex gap-4">
            <button
              onClick={handleContinue}
              className="flex-1 py-2 px-4 bg-purple-600 hover:bg-purple-500 rounded-md transition-colors font-medium"
            >
              Continue to Endless
            </button>
            <button
              onClick={handleShare}
              className="flex-1 py-2 px-4 bg-blue-600 hover:bg-blue-500 rounded-md transition-colors flex items-center justify-center gap-2"
            >
              <Share2 className="w-4 h-4" />
              Share
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
