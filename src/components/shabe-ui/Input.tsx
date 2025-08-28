import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const inputClass = "w-full rounded-ctl border border-line-200 bg-white px-3 py-2 text-[14px] text-ink-900 placeholder:text-ink-500 shadow-none focus:border-accent-500 focus:ring-[rgba(228,178,0,.25)] focus:outline-none transition-colors duration-150 ease-shabe";

export function Input({ label, error, className = "", ...props }: InputProps) {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-ink-700 mb-2">
          {label}
        </label>
      )}
      <input
        className={`${inputClass} ${error ? 'border-danger-500 focus:border-danger-500 focus:ring-[rgba(224,86,86,.25)]' : ''} ${className}`}
        {...props}
      />
      {error && (
        <p className="mt-1 text-sm text-danger-500">{error}</p>
      )}
    </div>
  );
}

export function Textarea({ label, error, className = "", ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string; error?: string }) {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-ink-700 mb-2">
          {label}
        </label>
      )}
      <textarea
        className={`${inputClass} ${error ? 'border-danger-500 focus:border-danger-500 focus:ring-[rgba(224,86,86,.25)]' : ''} ${className}`}
        {...props}
      />
      {error && (
        <p className="mt-1 text-sm text-danger-500">{error}</p>
      )}
    </div>
  );
}
