import React from 'react';

interface CardProps {
  title?: string;
  children: React.ReactNode;
  toolbar?: React.ReactNode;
  className?: string;
}

export function Card({ title, children, toolbar, className = "" }: CardProps) {
  return (
    <section className={`rounded-card border border-line-200 bg-white shadow-card ${className}`}>
      {title && (
        <>
          <header className="flex items-center justify-between px-5 py-4">
            <h3 className="text-[15px] font-semibold tracking-tight text-ink-900">{title}</h3>
            {toolbar && <div className="text-ink-500">{toolbar}</div>}
          </header>
          <div className="border-t border-line-100" />
        </>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}
