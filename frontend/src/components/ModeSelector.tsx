import { useState, useEffect, useRef } from 'react';
import { ChevronDown } from 'lucide-react';

interface ModeSelectorProps {
  currentMode: 'daily' | 'endless';
  onModeChange: (mode: 'daily' | 'endless') => void;
}

export default function GameModeSelector({
  currentMode,
  onModeChange,
}: ModeSelectorProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  // Close modal when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        modalRef.current &&
        !modalRef.current.contains(event.target as Node)
      ) {
        setIsModalOpen(false);
      }
    }

    if (isModalOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isModalOpen]);

  return (
    <div className="relative">
      <button
        className="flex items-center gap-2 px-4 py-2 bg-gray-700 dark:bg-gray-700 hover:bg-gray-600 dark:hover:bg-gray-600 
                  text-white rounded-md transition-colors duration-200 font-medium shadow-md"
        onClick={() => setIsModalOpen(!isModalOpen)}
        aria-haspopup="true"
        aria-expanded={isModalOpen}
      >
        {currentMode === 'daily' ? 'Daily Mode' : 'Endless Mode'}
        <ChevronDown
          className={`w-4 h-4 transition-transform duration-200 ${isModalOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isModalOpen && (
        <div
          ref={modalRef}
          className="absolute top-full left-0 mt-2 bg-gray-800 dark:bg-gray-800 rounded-md shadow-lg p-2 z-10 w-48 border border-gray-700 dark:border-gray-600"
        >
          <button
            className={`w-full text-left px-4 py-3 rounded-md flex items-center gap-2 transition-colors duration-200
              ${
                currentMode === 'daily'
                  ? 'bg-yellow-500/20 text-yellow-400 font-medium'
                  : 'hover:bg-gray-700 dark:hover:bg-gray-700 text-white'
              }`}
            onClick={() => {
              onModeChange('daily');
              setIsModalOpen(false);
            }}
          >
            <div
              className={`w-3 h-3 rounded-full ${currentMode === 'daily' ? 'bg-yellow-400' : 'bg-gray-600'}`}
            ></div>
            Daily Mode
          </button>
          <button
            className={`w-full text-left px-4 py-3 rounded-md flex items-center gap-2 transition-colors duration-200
              ${
                currentMode === 'endless'
                  ? 'bg-yellow-500/20 text-yellow-400 font-medium'
                  : 'hover:bg-gray-700 dark:hover:bg-gray-700 text-white'
              }`}
            onClick={() => {
              onModeChange('endless');
              setIsModalOpen(false);
            }}
          >
            <div
              className={`w-3 h-3 rounded-full ${currentMode === 'endless' ? 'bg-yellow-400' : 'bg-gray-600'}`}
            ></div>
            Endless Mode
          </button>
        </div>
      )}
    </div>
  );
}
