// This component displays WPM; blinks white while calculating, turns yellow when done.
import React from 'react';

interface WPMDisplayProps {
  wpm: number;
  isCalculating: boolean;
}

const WPMDisplay: React.FC<WPMDisplayProps> = ({ wpm, isCalculating }) => {
  const colorClasses = isCalculating
    ? 'text-white animate-pulse'
    : 'text-yellow-400';
  return (
    <div className={`text-lg font-extrabold ${colorClasses}`}>
      <span>WPM: {wpm}</span>
    </div>
  );
};

export default WPMDisplay;
