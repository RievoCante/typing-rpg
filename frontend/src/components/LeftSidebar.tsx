// Fixed left sidebar with hamburger trigger and expandable menu
import { useState, useMemo, useRef, useEffect } from 'react';
import { Menu, Clock } from 'lucide-react';
import { FaDiscord } from 'react-icons/fa';
import { useThemeContext } from '../hooks/useThemeContext';
import RecentSessionsModal from './RecentSessionsModal';

type MenuItem = {
  id: string;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
};

export default function LeftSidebar() {
  const { theme } = useThemeContext();
  const [open, setOpen] = useState(false);
  const [showRecent, setShowRecent] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const bg = theme === 'dark' ? '#1D1F2A' : '#f3f4f6';
  const textClass = theme === 'dark' ? 'text-white' : 'text-black';

  const items = useMemo<MenuItem[]>(
    () => [
      {
        id: 'recent-sessions',
        label: 'Recent sessions',
        icon: <Clock size={16} />,
        onClick: () => setShowRecent(true),
      },
      {
        id: 'discord',
        label: 'Discord',
        icon: <FaDiscord size={16} className={textClass} />,
        onClick: () =>
          window.open(
            'https://discord.gg/cdC2fW9HyD',
            '_blank',
            'noopener,noreferrer'
          ),
      },
    ],
    [textClass]
  );

  // click outside to close (simple, robust)
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  return (
    <>
      {/* Container */}
      <div ref={rootRef} className="fixed top-48 left-3 z-[70] select-none">
        {/* Single expanding container */}
        <div
          className={`shadow rounded-2xl transition-[width,max-height,padding,background-color] duration-300 ease-out ${
            open ? 'w-72 max-h-80 p-2' : 'w-12 h-12 p-0'
          }`}
          style={{ background: open ? bg : 'transparent', overflow: 'visible' }}
        >
          {/* Header row with hamburger */}
          <div className="flex items-center relative group">
            <button
              type="button"
              aria-label="Open menu"
              aria-expanded={open}
              onClick={() => setOpen(v => !v)}
              className={`h-12 w-12 flex items-center justify-center rounded-full ${
                open
                  ? ''
                  : theme === 'dark'
                    ? 'hover:bg-white/10'
                    : 'hover:bg-gray-100'
              }`}
            >
              <Menu size={18} className={textClass} />
            </button>
            {/* Tooltip */}
            {!open && (
              <div
                className={`absolute left-full ml-2 top-1/2 -translate-y-1/2 px-2 py-1 text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 delay-0 group-hover:delay-[750ms] whitespace-nowrap pointer-events-none z-[80] ${
                  theme === 'dark'
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-800 text-white'
                }`}
              >
                show menu bar
              </div>
            )}
          </div>

          {/* Items */}
          <div
            className={`transition-opacity duration-200 ${
              open ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
          >
            <ul className="py-2">
              {items.map(item => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      item.onClick();
                    }}
                    className={`w-full px-4 py-3 flex items-center gap-2 hover:bg-black/10 dark:hover:bg-white/10 ${textClass}`}
                  >
                    {item.icon}
                    <span className="text-sm">{item.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <RecentSessionsModal
        open={showRecent}
        onClose={() => setShowRecent(false)}
      />
    </>
  );
}
