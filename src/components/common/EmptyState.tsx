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
    <div className={`p-8 sm:p-12 text-center rounded-xl bg-surface border border-dashed border-subtle space-y-4 max-w-lg mx-auto text-primary ${className}`}>
      <div className="w-12 h-12 rounded-2xl bg-[#FAF0EB] dark:bg-[#2E2222] text-[#B85C3A] dark:text-[#E8D7C4] flex items-center justify-center mx-auto border border-[#E8C8BD]/80 dark:border-[#5C3830] shadow-2xs">
        <Icon className="w-6 h-6" />
      </div>

      <div className="space-y-1.5">
        <h4 className="text-base font-bold text-primary font-serif-heading">
          {title}
        </h4>
        <p className="text-xs sm:text-sm text-secondary leading-relaxed max-w-md mx-auto">
          {description}
        </p>
      </div>

      {(action || secondaryAction) && (
        <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
          {action && (
            <button
              onClick={action.onClick}
              className="px-4 py-2 rounded-lg bg-[#B85C3A] hover:bg-[#9E4B2D] text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-xs cursor-pointer"
            >
              {action.icon && React.createElement(action.icon, { className: 'w-3.5 h-3.5' })}
              <span>{action.label}</span>
            </button>
          )}

          {secondaryAction && (
            <button
              onClick={secondaryAction.onClick}
              className="px-4 py-2 rounded-lg bg-subtle hover:bg-muted text-primary text-xs font-semibold border border-subtle transition cursor-pointer"
            >
              {secondaryAction.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
};
