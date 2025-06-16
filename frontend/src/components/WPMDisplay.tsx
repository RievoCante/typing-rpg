// This component displays the words per minute (WPM) or a calculating status.
import React from 'react';

interface WPMDisplayProps {
  wpm: number;
  isCalculating: boolean;
}

const WPMDisplay: React.FC<WPMDisplayProps> = ({ wpm, isCalculating }) => {
  return (
    <div className="text-lg font-semibold">
      {isCalculating ? (
        <span className="text-slate-400 animate-pulse">Calculating...</span>
      ) : (
        <span>WPM: {wpm}</span>
      )}
    </div>
  );
};

export default WPMDisplay;
