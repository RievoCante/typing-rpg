import React, { useState, useEffect } from 'react';
import { Sun, Moon, User, X } from 'lucide-react';
import {
  SignedIn,
  SignedOut,
  SignInButton,
  UserButton,
} from '@clerk/clerk-react';

import { useThemeContext } from '../hooks/useThemeContext';

const Header: React.FC = () => {
  const { theme, toggleTheme } = useThemeContext();
  const [showDialog, setShowDialog] = useState(false);

  // Show dialog after a brief delay for smooth entrance
  useEffect(() => {
    const timer = setTimeout(() => setShowDialog(true), 500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <>
      {/* Pulsing animation for JRPG dialog */}
      <style>{`
        @keyframes pulse-glow {
          0%, 100% {
            opacity: 1;
            filter: brightness(1);
          }
          50% {
            opacity: 0.9;
            filter: brightness(1.05);
          }
        }
        .animate-pulse-glow {
          animation: pulse-glow 2s ease-in-out infinite;
        }
        .animate-pulse-glow:hover {
          animation-play-state: paused;
        }
      `}</style>
      <header
        className={`p-4 flex justify-between items-center bg-transparent transition-colors duration-300`}
      >
        <div className="pl-24 sm:pl-28" />

        <div className="flex space-x-2 sm:space-x-4 items-start">
          <SignedOut>
            <div className="relative">
              <SignInButton mode="modal">
                <button
                  className={`p-2 rounded-full transition-colors ${
                    theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                  }`}
                  aria-label="Sign in"
                >
                  <User
                    size={20}
                    className={theme === 'dark' ? 'text-white' : ''}
                  />
                </button>
              </SignInButton>

              {/* JRPG-style dialog box */}
              <div
                onClick={e => e.stopPropagation()}
                className={`absolute right-0 top-full mt-2 w-64 z-50 transition-all duration-300 ease-out pointer-events-auto ${
                  showDialog
                    ? 'opacity-100 translate-y-0'
                    : 'opacity-0 -translate-y-4 pointer-events-none'
                }`}
              >
                <div
                  className={`p-4 rounded-lg border-2 shadow-xl animate-pulse-glow ${
                    theme === 'dark'
                      ? 'bg-[#2A2C3C] border-yellow-400/50 shadow-yellow-400/10'
                      : 'bg-white border-amber-500/50 shadow-amber-500/20'
                  }`}
                >
                  {/* Dialog pointer/triangle */}
                  <div
                    className={`absolute -top-2 right-4 w-4 h-4 rotate-45 border-l-2 border-t-2 ${
                      theme === 'dark'
                        ? 'bg-[#2A2C3C] border-yellow-400/50'
                        : 'bg-white border-amber-500/50'
                    }`}
                  />

                  {/* Close button - stops propagation to prevent triggering SignInButton */}
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      e.preventDefault();
                      setShowDialog(false);
                    }}
                    className={`absolute top-1 right-1 p-2 rounded-full transition-all duration-200 z-50 min-w-[28px] min-h-[28px] flex items-center justify-center ${
                      theme === 'dark'
                        ? 'hover:bg-gray-700 text-gray-400 hover:text-gray-200 active:scale-95'
                        : 'hover:bg-gray-200 text-gray-500 hover:text-gray-700 active:scale-95'
                    }`}
                    aria-label="Close dialog"
                  >
                    <X size={16} strokeWidth={2.5} />
                  </button>

                  {/* Content */}
                  <div className="relative pr-6">
                    <p
                      className={`text-sm leading-relaxed font-medium ${
                        theme === 'dark' ? 'text-yellow-100' : 'text-amber-900'
                      }`}
                    >
                      <span className="text-lg">🛡️</span> Hark, traveler!
                    </p>
                    <p
                      className={`text-xs mt-2 leading-relaxed ${
                        theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
                      }`}
                    >
                      Sign in to begin thy quest, earn experience, and etch thy
                      name upon the leaderboards of legend!
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </SignedOut>
          <SignedIn>
            <UserButton />
          </SignedIn>

          <button
            onClick={toggleTheme}
            className={`p-2 rounded-full transition-colors ${
              theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
            }`}
            aria-label={
              theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'
            }
          >
            {theme === 'dark' ? (
              <Sun size={20} className="text-white" />
            ) : (
              <Moon size={20} />
            )}
          </button>
        </div>
      </header>
    </>
  );
};

export default Header;
