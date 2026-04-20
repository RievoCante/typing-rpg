// Fixed left sidebar with icon-only dock that expands on hover
import { useState, useMemo, useRef, useEffect } from 'react';
import { Clock, Trophy } from 'lucide-react';
import { FaDiscord } from 'react-icons/fa';
import { useThemeContext } from '../hooks/useThemeContext';
import RecentSessionsModal from './RecentSessionsModal';
import { useNavigate } from 'react-router-dom';

type MenuItem = {
  id: string;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
};

export default function LeftSidebar() {
  const { theme } = useThemeContext();
  const [hovered, setHovered] = useState(false);
  const [showRecent, setShowRecent] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const navigate = useNavigate();

  const bg = theme === 'dark' ? '#1D1F2A' : '#f3f4f6';
  const textClass = theme === 'dark' ? 'text-white' : 'text-black';

  const items = useMemo<MenuItem[]>(
    () => [
      {
        id: 'recent-sessions',
        label: 'Recent sessions',
        icon: <Clock size={18} />,
        onClick: () => setShowRecent(true),
      },
      {
        id: 'leaderboard',
        label: 'Leaderboard',
        icon: <Trophy size={18} />,
        onClick: () => navigate('/leaderboard'),
      },
      {
        id: 'discord',
        label: 'Discord',
        icon: <FaDiscord size={18} className={textClass} />,
        onClick: () =>
          window.open(
            'https://discord.gg/cdC2fW9HyD',
            '_blank',
            'noopener,noreferrer'
          ),
      },
    ],
    [textClass, navigate]
  );

  // click outside to collapse (optional UX improvement)
  useEffect(() => {
    if (!hovered) return;
    const onDocClick = (e: MouseEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) setHovered(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [hovered]);

  return (
    <>
      {/* Container */}
      <div
        ref={rootRef}
        className="fixed top-48 left-3 z-[70] select-none"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* Expanding container */}
        <div
          className={`shadow rounded-2xl transition-[width,background-color] duration-300 ease-out overflow-hidden py-3 pl-2 ${
            hovered ? 'w-56 pr-2' : 'w-12 pr-0'
          }`}
          style={{ background: hovered ? bg : 'transparent' }}
        >
          {/* Menu items - icons always visible, text appears on hover */}
          <ul className="flex flex-col gap-1">
            {items.map(item => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => {
                    setHovered(false);
                    item.onClick();
                  }}
                  className={`w-full h-10 flex items-center gap-3 rounded-lg transition-colors hover:bg-black/10 dark:hover:bg-white/10 ${textClass}`}
                >
                  <span className="flex-shrink-0 w-6 flex justify-center ml-1">{item.icon}</span>
                  <span
                    className={`text-sm whitespace-nowrap transition-all duration-300 ease-out overflow-hidden ${
                      hovered ? 'opacity-100 max-w-[200px]' : 'opacity-0 max-w-0'
                    }`}
                  >
                    {item.label}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <RecentSessionsModal
        open={showRecent}
        onClose={() => setShowRecent(false)}
      />
    </>
  );
}
