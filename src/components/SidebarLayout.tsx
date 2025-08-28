"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/shabe-ui";

interface SidebarLayoutProps {
  children: React.ReactNode;
  sidebar: React.ReactNode;
  defaultSidebarOpen?: boolean;
}

export default function SidebarLayout({ 
  children, 
  sidebar, 
  defaultSidebarOpen = true 
}: SidebarLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(defaultSidebarOpen);

  return (
    <div className="flex h-full w-full min-h-0 relative">
      {/* Sidebar */}
      <div 
        className={`
          transition-all duration-300 ease-in-out
          ${sidebarOpen ? 'w-80' : 'w-0'}
          bg-bg border-r border-line-200
          flex-shrink-0 relative z-50
          ${sidebarOpen ? 'opacity-100' : 'opacity-0 overflow-hidden'}
          
          /* Mobile: Fixed overlay */
          md:relative md:z-auto
          ${sidebarOpen ? 'fixed md:relative inset-y-0 left-0 md:inset-auto' : ''}
        `}
      >
        {/* Sidebar Content */}
        <div className="h-full overflow-hidden">
          {sidebar}
        </div>
      </div>
      
      {/* Toggle Button - Always visible */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className={`
          absolute top-4 z-50 
          ${sidebarOpen ? 'left-80' : 'left-0'}
          bg-bg border border-line-200 shadow-card
          hover:bg-accent-50 w-8 h-8 p-0
          transition-all duration-300 ease-in-out
        `}
      >
        {sidebarOpen ? (
          <ChevronLeft className="h-4 w-4 text-ink-900" />
        ) : (
          <ChevronRight className="h-4 w-4 text-ink-900" />
        )}
      </Button>
      
      {/* Main Content */}
      <div className="flex-1 min-w-0 h-full overflow-hidden">
        {children}
      </div>
      
      {/* Mobile overlay when sidebar is open */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-25 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}