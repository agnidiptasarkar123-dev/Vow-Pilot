import React from 'react';
import { LucideIcon } from 'lucide-react';
import { Card } from './Card';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  badge?: {
    text: string;
    variant: 'success' | 'warning' | 'error' | 'info' | 'neutral' | 'accent';
  };
  onClick?: () => void;
  className?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  badge,
  onClick,
  className = '',
}) => {
  const isClickable = Boolean(onClick);

  return (
    <Card
      variant={isClickable ? 'interactive' : 'default'}
      onClick={onClick}
      className={`relative overflow-hidden ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#6E665E]">
            {title}
          </p>
          <p className="text-2xl sm:text-3xl font-bold font-mono tracking-tight text-[#1F1D1A]">
            {value}
          </p>
          {subtitle && (
            <p className="text-xs text-[#5C554E] pt-0.5">
              {subtitle}
            </p>
          )}
        </div>

        <div className="w-10 h-10 rounded-xl bg-[#FAF0EB] text-[#A2421D] flex items-center justify-center shrink-0 border border-[#F3CEBE]/60">
          <Icon className="w-5 h-5" />
        </div>
      </div>

      {badge && (
        <div className="mt-3 pt-3 border-t border-[#F4EFEA] flex items-center justify-between text-xs">
          <span className="text-[#6E665E]">Status:</span>
          <span className={`font-semibold ${
            badge.variant === 'success' ? 'text-[#047857]' :
            badge.variant === 'warning' ? 'text-[#B45309]' :
            badge.variant === 'error' ? 'text-[#BE123C]' :
            badge.variant === 'accent' ? 'text-[#A2421D]' : 'text-[#5C554E]'
          }`}>
            {badge.text}
          </span>
        </div>
      )}
    </Card>
  );
};
