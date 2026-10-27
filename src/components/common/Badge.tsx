import React from 'react';

export type BadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral' | 'accent';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
  showDot?: boolean;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  size = 'md',
  showDot = false,
  className = '',
  ...props
}) => {
  const variantStyles: Record<BadgeVariant, { bg: string; text: string; border: string; dot: string }> = {
    success: {
      bg: 'bg-emerald-50 dark:bg-[#1E2E24]',
      text: 'text-[#047857] dark:text-[#91B8A0]',
      border: 'border-emerald-200 dark:border-[#385242]',
      dot: 'bg-[#047857] dark:bg-[#91B8A0]',
    },
    warning: {
      bg: 'bg-amber-50 dark:bg-[#332A20]',
      text: 'text-[#B45309] dark:text-[#E5BD76]',
      border: 'border-amber-200 dark:border-[#55462D]',
      dot: 'bg-[#B45309] dark:bg-[#E5BD76]',
    },
    error: {
      bg: 'bg-rose-50 dark:bg-[#341F24]',
      text: 'text-[#BE123C] dark:text-[#E58C91]',
      border: 'border-rose-200 dark:border-[#58333B]',
      dot: 'bg-[#BE123C] dark:bg-[#E58C91]',
    },
    info: {
      bg: 'bg-indigo-50 dark:bg-[#1F2238]',
      text: 'text-[#3730A3] dark:text-[#A5B4FC]',
      border: 'border-indigo-200 dark:border-[#373B60]',
      dot: 'bg-[#3730A3] dark:bg-[#A5B4FC]',
    },
    neutral: {
      bg: 'bg-subtle',
      text: 'text-secondary',
      border: 'border-subtle',
      dot: 'bg-tertiary',
    },
    accent: {
      bg: 'bg-[#FAF0EB] dark:bg-[#2E2222]',
      text: 'text-[#B85C3A] dark:text-[#E8D7C4]',
      border: 'border-[#E8C8BD] dark:border-[#5C3830]',
      dot: 'bg-[#B85C3A] dark:bg-[#D48668]',
    },
  };

  const current = variantStyles[variant];

  const sizeStyles = {
    sm: 'text-[10px] px-2 py-0.5 font-medium',
    md: 'text-xs px-2.5 py-1 font-semibold',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border ${current.bg} ${current.text} ${current.border} ${sizeStyles[size]} ${className}`}
      {...props}
    >
      {showDot && <span className={`w-1.5 h-1.5 rounded-full ${current.dot}`} />}
      {children}
    </span>
  );
};
