import React, { useState } from 'react';
import { Sun, Moon, User, Clock } from 'lucide-react';
import { SignedIn, SignedOut, SignInButton, UserButton } from '@clerk/clerk-react';

import { useThemeContext } from '../hooks/useThemeContext';
import RecentSessionsModal from './RecentSessionsModal';


const Header: React.FC = () => {
  const { theme, toggleTheme } = useThemeContext();
  const [showHistory, setShowHistory] = useState(false);

  return (
    <>
    <header
      className={`p-4 flex justify-between items-center border-b ${
        theme === 'dark'
          ? 'bg-[#303446] border-[#303446]'
          : 'bg-white border-gray-200'
      } transition-colors duration-300`}
    >
      <div className="flex items-center">
        <h1
          className={`text-2xl font-bold mr-2 ${
            theme === 'dark' ? 'text-white' : 'text-black'
          }`}
        >
          Typing RPG
        </h1>
        <span
          className={`text-sm px-2 py-1 rounded-full ${
            theme === 'dark'
              ? 'bg-purple-900 text-purple-200'
              : 'bg-purple-100 text-purple-800'
          }`}
        >
          Beta
        </span>
        {/* History button next to logo */}
        <button
          onClick={() => setShowHistory(true)}
          className={`ml-3 p-2 rounded-full transition-colors ${
            theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-gray-100'
          }`}
          aria-label="Recent sessions"
        >
          <Clock size={20} className={theme === 'dark' ? 'text-white' : ''} />
        </button>
        
      </div>

      <div className="flex space-x-2 sm:space-x-4">
        <SignedOut>
          <SignInButton mode="modal">
            <button
              className={`p-2 rounded-full transition-colors ${
                theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
              }`}
              aria-label="Sign in"
            >
              <User size={20} className={theme === 'dark' ? 'text-white' : ''} />
            </button>
          </SignInButton>
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
    <RecentSessionsModal open={showHistory} onClose={() => setShowHistory(false)} />
    </>
  );
};

export default Header;
