import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'subtle' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

const baseClasses = "inline-flex items-center justify-center rounded-ctl text-sm font-medium transition-all duration-150 ease-shabe focus:outline-none focus:ring-4";

const variants = {
  primary: `${baseClasses} bg-accent-500 text-black hover:bg-accent-600 focus:ring-[rgba(228,178,0,.25)]`,
  subtle: `${baseClasses} bg-bg hover:shadow-card border border-line-200 text-ink-900`,
  ghost: `${baseClasses} text-ink-700 hover:bg-accent-50`
};

const sizes = {
  sm: 'px-3 py-1.5',
  md: 'px-4 py-2',
  lg: 'px-6 py-3'
};

export function Button({ 
  variant = 'primary', 
  size = 'md', 
  children, 
  className = "", 
  ...props 
}: ButtonProps) {
  const classes = `${variants[variant]} ${sizes[size]} ${className}`;
  
  return (
    <button className={classes} {...props}>
      {children}
    </button>
  );
}
