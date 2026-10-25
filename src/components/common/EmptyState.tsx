import React from 'react';
import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
    icon?: LucideIcon;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
  className = '',
}) => {
  return (
    <div className={`p-8 sm:p-12 text-center rounded-xl bg-white border border-dashed border-[#D5CCC0] space-y-4 max-w-lg mx-auto ${className}`}>
      <div className="w-12 h-12 rounded-2xl bg-[#FAF0EB] text-[#A2421D] flex items-center justify-center mx-auto border border-[#F3CEBE]/80 shadow-2xs">
        <Icon className="w-6 h-6" />
      </div>

      <div className="space-y-1.5">
        <h4 className="text-base font-bold text-[#1F1D1A] font-serif-heading">
          {title}
        </h4>
        <p className="text-xs sm:text-sm text-[#5C554E] leading-relaxed max-w-md mx-auto">
          {description}
        </p>
      </div>

      {(action || secondaryAction) && (
        <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
          {action && (
            <button
              onClick={action.onClick}
              className="px-4 py-2 rounded-lg bg-[#A2421D] hover:bg-[#863414] text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-xs cursor-pointer"
            >
              {action.icon && React.createElement(action.icon, { className: 'w-3.5 h-3.5' })}
              <span>{action.label}</span>
            </button>
          )}

          {secondaryAction && (
            <button
              onClick={secondaryAction.onClick}
              className="px-4 py-2 rounded-lg bg-[#FAF8F5] hover:bg-[#F4EFEA] text-[#1F1D1A] text-xs font-semibold border border-[#D5CCC0] transition cursor-pointer"
            >
              {secondaryAction.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
};
