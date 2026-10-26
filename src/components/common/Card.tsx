import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  variant?: 'default' | 'subtle' | 'interactive';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  className?: string;
}

export const Card: React.FC<CardProps> = ({
  children,
  variant = 'default',
  padding = 'md',
  className = '',
  ...props
}) => {
  const variantStyles = {
    default: 'bg-surface border border-subtle shadow-[0_1px_3px_rgba(31,29,26,0.06),0_1px_2px_rgba(31,29,26,0.04)] dark:shadow-[0_1px_3px_rgba(0,0,0,0.3)] text-primary',
    subtle: 'bg-subtle border border-subtle text-primary',
    interactive: 'bg-surface border border-subtle shadow-[0_1px_3px_rgba(31,29,26,0.06)] hover:shadow-[0_4px_12px_rgba(31,29,26,0.08)] dark:hover:shadow-[0_4px_12px_rgba(0,0,0,0.4)] hover:-translate-y-0.5 transition-all duration-200 cursor-pointer text-primary',
  };

  const paddingStyles = {
    none: 'p-0',
    sm: 'p-4',
    md: 'p-5 sm:p-6',
    lg: 'p-6 sm:p-8',
  };

  return (
    <div
      className={`rounded-xl ${variantStyles[variant]} ${paddingStyles[padding]} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};
