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
    ? 'bg-[#BE123C] dark:bg-[#E58C91]'
    : percentage >= 85
    ? 'bg-[#B45309] dark:bg-[#E5BD76]'
    : 'bg-[#B85C3A] dark:bg-[#D48668]';

  const heightClass = size === 'sm' ? 'h-1.5' : 'h-2.5';

  return (
    <div className={`space-y-1.5 ${className}`}>
      {(label || showPercentage || formattedValue) && (
        <div className="flex items-center justify-between text-xs font-medium">
          {label && <span className="text-secondary">{label}</span>}
          <div className="flex items-center gap-2 font-mono">
            {formattedValue && (
              <span className={`font-semibold ${isOver ? 'text-[#BE123C] dark:text-[#E58C91]' : 'text-primary'}`}>
                {formattedValue}
              </span>
            )}
            {showPercentage && (
              <span className="text-tertiary text-[11px]">
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
        className={`w-full ${heightClass} bg-muted rounded-full overflow-hidden border border-subtle`}
      >
        <div
          className={`${heightClass} rounded-full ${barColor} transition-all duration-300 ease-out`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};
