import React from 'react';
import { Sun, Moon, User } from 'lucide-react';
import {
  SignedIn,
  SignedOut,
  SignInButton,
  UserButton,
} from '@clerk/clerk-react';

import { useThemeContext } from '../hooks/useThemeContext';

const Header: React.FC = () => {
  const { theme, toggleTheme } = useThemeContext();

  return (
    <>
      <header
        className={`p-4 flex justify-between items-center bg-transparent transition-colors duration-300`}
      >
        <div className="pl-24 sm:pl-28" />

        <div className="flex space-x-2 sm:space-x-4">
          <SignedOut>
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
