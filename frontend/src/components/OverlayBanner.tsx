// Centered message overlay used for focus prompt and celebration.
interface OverlayBannerProps {
  visible: boolean;
  message: string;
  tone?: 'info' | 'celebrate';
  onClick?: () => void;
}

export default function OverlayBanner({
  visible,
  message,
  tone = 'info',
  onClick,
}: OverlayBannerProps) {
  if (!visible) return null;
  const color = tone === 'celebrate' ? 'text-yellow-400' : 'text-gray-200';
  const bg = tone === 'celebrate' ? 'bg-black/20' : 'bg-black/30';
  return (
    <div
      className={`absolute inset-0 ${bg} flex items-center justify-center z-10 ${onClick ? 'cursor-pointer' : ''}`}
      onClick={onClick}
    >
      <div
        className={`px-4 py-2 rounded-lg backdrop-blur-sm transition-all duration-200 ease-out ${color} font-semibold text-lg sm:text-xl drop-shadow`}
      >
        {message}
      </div>
    </div>
  );
}
