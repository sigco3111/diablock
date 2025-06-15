
import React from 'react';

interface ProgressBarProps {
  value: number;
  maxValue: number;
  color?: string; // e.g., 'bg-red-500'
  label?: string;
  showPercentage?: boolean;
}

const ProgressBar: React.FC<ProgressBarProps> = ({ value, maxValue, color = 'bg-red-600', label, showPercentage = true }) => {
  const percentage = maxValue > 0 ? (value / maxValue) * 100 : 0;

  return (
    <div className="w-full">
      {label && <div className="text-xs text-gray-400 mb-1">{label}</div>}
      <div className="w-full bg-gray-700 rounded h-4 overflow-hidden border border-gray-600">
        <div
          className={`h-full ${color} transition-all duration-300 ease-out rounded-sm`}
          style={{ width: `${Math.max(0, Math.min(percentage, 100))}%` }}
        ></div>
      </div>
      {showPercentage && (
        <div className="text-xs text-center text-gray-300 mt-1">
          {Math.round(value)} / {Math.round(maxValue)} ({percentage.toFixed(0)}%)
        </div>
      )}
    </div>
  );
};

export default ProgressBar;
