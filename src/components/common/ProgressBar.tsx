import React from 'react';

interface ProgressBarProps {
  value: number; // Current value
  max: number;   // Maximum threshold
  label?: string;
  formattedValue?: string;
  showPercentage?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  max,
  label,
  formattedValue,
  showPercentage = true,
  size = 'md',
  className = '',
}) => {
  const percentage = max > 0 ? Math.min(Math.round((value / max) * 100), 100) : 0;
  const isOver = max > 0 && value > max;

  // Determine threshold color:
  // < 85%: terracotta / warm accent
  // 85% - 100%: amber warning
  // > 100%: rose / red overrun
  const barColor = isOver
    ? 'bg-[#BE123C]'
    : percentage >= 85
    ? 'bg-[#B45309]'
    : 'bg-[#A2421D]';

  const heightClass = size === 'sm' ? 'h-1.5' : 'h-2.5';

  return (
    <div className={`space-y-1.5 ${className}`}>
      {(label || showPercentage || formattedValue) && (
        <div className="flex items-center justify-between text-xs font-medium">
          {label && <span className="text-[#5C554E]">{label}</span>}
          <div className="flex items-center gap-2 font-mono">
            {formattedValue && (
              <span className={`font-semibold ${isOver ? 'text-[#BE123C]' : 'text-[#1F1D1A]'}`}>
                {formattedValue}
              </span>
            )}
            {showPercentage && (
              <span className="text-[#6E665E] text-[11px]">
                ({percentage}%)
              </span>
            )}
          </div>
        </div>
      )}

      <div
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={label || 'Progress'}
        className={`w-full ${heightClass} bg-[#F4EFEA] rounded-full overflow-hidden border border-[#E6DFD5]/60`}
      >
        <div
          className={`${heightClass} rounded-full ${barColor} transition-all duration-300 ease-out`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};
