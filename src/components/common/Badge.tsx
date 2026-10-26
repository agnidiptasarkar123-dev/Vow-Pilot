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
      bg: 'bg-emerald-50',
      text: 'text-[#047857]',
      border: 'border-emerald-200',
      dot: 'bg-[#047857]',
    },
    warning: {
      bg: 'bg-amber-50',
      text: 'text-[#B45309]',
      border: 'border-amber-200',
      dot: 'bg-[#B45309]',
    },
    error: {
      bg: 'bg-rose-50',
      text: 'text-[#BE123C]',
      border: 'border-rose-200',
      dot: 'bg-[#BE123C]',
    },
    info: {
      bg: 'bg-indigo-50',
      text: 'text-[#3730A3]',
      border: 'border-indigo-200',
      dot: 'bg-[#3730A3]',
    },
    neutral: {
      bg: 'bg-[#F4EFEA]',
      text: 'text-[#5C554E]',
      border: 'border-[#E6DFD5]',
      dot: 'bg-[#6E665E]',
    },
    accent: {
      bg: 'bg-[#FAF0EB]',
      text: 'text-[#B85C3A]',
      border: 'border-[#E8C8BD]',
      dot: 'bg-[#B85C3A]',
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
