import { useEffect, useRef, useState } from 'react';
import { Share2, Trophy, Zap, Swords } from 'lucide-react';

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
  onContinue: () => void;
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
  const [displayXP, setDisplayXP] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  // Animate XP counter on open
  useEffect(() => {
    if (isOpen && totalXP > 0) {
      setIsAnimating(true);
      const duration = 1500;
      const steps = 60;
      const increment = totalXP / steps;
      let current = 0;

      const timer = setInterval(() => {
        current += increment;
        if (current >= totalXP) {
          setDisplayXP(totalXP);
          clearInterval(timer);
          setTimeout(() => setIsAnimating(false), 500);
        } else {
          setDisplayXP(Math.floor(current));
        }
      }, duration / steps);

      return () => clearInterval(timer);
    } else if (!isOpen) {
      setDisplayXP(0);
    }
  }, [isOpen, totalXP]);

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
      navigator.clipboard
        .writeText(shareText)
        .then(() => alert('Share text copied to clipboard!'))
        .catch(err => console.error('Could not copy text: ', err));
    }
  };

  const handleContinue = () => {
    onContinue();
  };

  const getDifficultyConfig = (difficulty: 'easy' | 'medium' | 'hard') => {
    switch (difficulty) {
      case 'easy':
        return {
          label: 'Grunt',
          color: '#22c55e',
          bgColor: 'rgba(34, 197, 94, 0.15)',
          borderColor: 'rgba(34, 197, 94, 0.4)',
          icon: '●',
        };
      case 'medium':
        return {
          label: 'Elite',
          color: '#f59e0b',
          bgColor: 'rgba(245, 158, 11, 0.15)',
          borderColor: 'rgba(245, 158, 11, 0.4)',
          icon: '◆',
        };
      case 'hard':
        return {
          label: 'Boss',
          color: '#ef4444',
          bgColor: 'rgba(239, 68, 68, 0.15)',
          borderColor: 'rgba(239, 68, 68, 0.4)',
          icon: '★',
        };
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop with pixelated vignette */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

      {/* Animated background particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(12)].map((_, i) => (
          <div
            key={i}
            className="absolute w-2 h-2 bg-yellow-400/30"
            style={{
              left: `${10 + i * 7}%`,
              top: `${20 + (i % 3) * 20}%`,
              animation: `pixel-float ${3 + (i % 2)}s ease-in-out infinite`,
              animationDelay: `${i * 0.2}s`,
            }}
          />
        ))}
      </div>

      {/* Modal Card */}
      <div
        ref={modalRef}
        className="relative w-full max-w-lg animate-modal-entry"
        style={{
          animation:
            'modalEntry 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        }}
      >
        {/* Pixel border effect */}
        <div
          className="absolute -inset-1 rounded-lg opacity-60"
          style={{
            background:
              'linear-gradient(135deg, #fbbf24, #f59e0b, #ef4444, #a855f7)',
            backgroundSize: '300% 300%',
            animation: 'gradientShift 4s ease infinite',
          }}
        />

        <div className="relative bg-[#1e1b2e] rounded-lg overflow-hidden">
          {/* Header with trophy */}
          <div className="relative px-6 pt-8 pb-6 text-center">
            {/* Trophy icon with glow */}
            <div className="relative inline-flex mb-4">
              <div className="absolute inset-0 bg-yellow-400/30 blur-xl rounded-full animate-pixel-pulse" />
              <div
                className="relative w-20 h-20 rounded-full flex items-center justify-center"
                style={{
                  background:
                    'linear-gradient(135deg, #fbbf24 0%, #f59e0b 50%, #d97706 100%)',
                  boxShadow:
                    '0 0 30px rgba(251, 191, 36, 0.5), inset 0 2px 4px rgba(255,255,255,0.3)',
                }}
              >
                <Trophy className="w-10 h-10 text-white" strokeWidth={2} />
              </div>
            </div>

            {/* Title with pixel styling */}
            <h2
              className="text-3xl font-bold mb-2 tracking-wide"
              style={{
                fontFamily: "'Roboto Mono', monospace",
                background:
                  'linear-gradient(135deg, #fbbf24 0%, #f59e0b 50%, #fcd34d 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                textShadow: '0 2px 10px rgba(251, 191, 36, 0.3)',
              }}
            >
              VICTORY!
            </h2>
            <p className="text-gray-400 text-sm tracking-wider uppercase">
              Daily Challenge Complete
            </p>
          </div>

          {/* Battle Stats - Horizontal Cards */}
          <div className="px-6 pb-6">
            <div className="flex items-center gap-2 mb-3">
              <Swords className="w-4 h-4 text-gray-500" />
              <span className="text-xs text-gray-500 uppercase tracking-wider">
                Battle Results
              </span>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {quoteStats.map((stat, index) => {
                const config = getDifficultyConfig(stat.difficulty);
                return (
                  <div
                    key={index}
                    className="relative group"
                    style={{
                      animation: `slideUp 0.5s ease ${index * 0.1}s forwards`,
                      opacity: 0,
                      transform: 'translateY(20px)',
                    }}
                  >
                    <div
                      className="rounded-lg p-3 text-center transition-all duration-200 group-hover:scale-105"
                      style={{
                        background: config.bgColor,
                        border: `2px solid ${config.borderColor}`,
                      }}
                    >
                      <div
                        className="text-2xl mb-1"
                        style={{ color: config.color }}
                      >
                        {config.icon}
                      </div>
                      <div className="text-xs text-gray-400 mb-1">
                        {config.label}
                      </div>
                      <div
                        className="text-lg font-bold"
                        style={{
                          color: config.color,
                          fontFamily: "'Roboto Mono', monospace",
                        }}
                      >
                        {stat.wpm}
                      </div>
                      <div className="text-[10px] text-gray-500">WPM</div>
                      {stat.attempts > 1 && (
                        <div className="text-[10px] text-gray-500 mt-1">
                          {stat.attempts}x
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* XP and Stats Row */}
          <div className="px-6 pb-6">
            <div className="grid grid-cols-2 gap-4">
              {/* XP Display */}
              <div
                className="relative rounded-lg p-4 overflow-hidden"
                style={{
                  background:
                    'linear-gradient(135deg, rgba(168, 85, 247, 0.2) 0%, rgba(147, 51, 234, 0.1) 100%)',
                  border: '2px solid rgba(168, 85, 247, 0.4)',
                }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="w-4 h-4 text-purple-400" />
                  <span className="text-xs text-purple-300 uppercase tracking-wider">
                    XP Earned
                  </span>
                </div>
                <div
                  className="text-3xl font-bold"
                  style={{
                    color: '#c084fc',
                    fontFamily: "'Roboto Mono', monospace",
                    textShadow: isAnimating
                      ? '0 0 20px rgba(192, 132, 252, 0.8)'
                      : 'none',
                    transition: 'text-shadow 0.3s ease',
                  }}
                >
                  +{displayXP.toLocaleString()}
                </div>
              </div>

              {/* Average WPM */}
              <div
                className="relative rounded-lg p-4 overflow-hidden"
                style={{
                  background:
                    'linear-gradient(135deg, rgba(34, 197, 94, 0.2) 0%, rgba(22, 163, 74, 0.1) 100%)',
                  border: '2px solid rgba(34, 197, 94, 0.4)',
                }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-4 h-4 rounded-full bg-green-500/30 flex items-center justify-center">
                    <span className="text-[10px] text-green-400">⚡</span>
                  </div>
                  <span className="text-xs text-green-300 uppercase tracking-wider">
                    Avg Speed
                  </span>
                </div>
                <div
                  className="text-3xl font-bold text-green-400"
                  style={{ fontFamily: "'Roboto Mono', monospace" }}
                >
                  {averageWPM}
                </div>
                <div className="text-[10px] text-green-500/70">WPM</div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="px-6 pb-6">
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={handleContinue}
                className="group relative px-4 py-3 rounded-lg font-medium text-sm transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                style={{
                  background:
                    'linear-gradient(135deg, #9333ea 0%, #7c3aed 100%)',
                  boxShadow:
                    '0 4px 14px rgba(147, 51, 234, 0.4), inset 0 1px 0 rgba(255,255,255,0.2)',
                  color: 'white',
                  fontFamily: "'Roboto Mono', monospace",
                }}
              >
                <span className="relative z-10 flex items-center justify-center gap-2">
                  <span>▶</span>
                  <span>Endless Mode</span>
                </span>
              </button>

              <button
                onClick={handleShare}
                className="group relative px-4 py-3 rounded-lg font-medium text-sm transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                style={{
                  background: 'rgba(59, 130, 246, 0.2)',
                  border: '2px solid rgba(59, 130, 246, 0.5)',
                  color: '#60a5fa',
                  fontFamily: "'Roboto Mono', monospace",
                }}
              >
                <span className="relative z-10 flex items-center justify-center gap-2">
                  <Share2 className="w-4 h-4" />
                  <span>Share</span>
                </span>
              </button>
            </div>
          </div>

          {/* Bottom decorative line */}
          <div
            className="h-1 w-full"
            style={{
              background:
                'linear-gradient(90deg, transparent 0%, #fbbf24 20%, #f59e0b 50%, #fbbf24 80%, transparent 100%)',
            }}
          />
        </div>
      </div>

      <style>{`
        @keyframes modalEntry {
          from {
            opacity: 0;
            transform: scale(0.9) translateY(20px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
        
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @keyframes gradientShift {
          0%, 100% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
        }
      `}</style>
    </div>
  );
}
