"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

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
          bg-white border-r border-[#d9d2c7]
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
        
        {/* Toggle Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className={`
            absolute top-4 z-10 
            ${sidebarOpen ? '-right-4' : 'right-2'}
            bg-white border border-[#d9d2c7] shadow-sm
            hover:bg-[#f3e89a]/10 w-8 h-8 p-0
          `}
        >
          {sidebarOpen ? (
            <ChevronLeft className="h-4 w-4 text-black" />
          ) : (
            <ChevronRight className="h-4 w-4 text-black" />
          )}
        </Button>
      </div>

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