// Fixed site logo not affecting header layout
import { useThemeContext } from '../hooks/useThemeContext';
import { useNavigate } from 'react-router-dom';

export default function SiteLogo() {
  const { theme } = useThemeContext();
  const navigate = useNavigate();
  return (
    <button
      type="button"
      aria-label="Typing RPG Home"
      className="fixed top-3 left-3 z-50 block"
      onClick={() => navigate('/')}
    >
      <img
        src="/typing-rpg-logo.svg"
        alt="Typing RPG"
        className="h-32 sm:h-40 w-auto drop-shadow"
        style={{ filter: theme === 'dark' ? 'none' : 'none' }}
      />
    </button>
  );
}
