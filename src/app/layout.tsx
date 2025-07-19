import React from "react";
import type { Metadata } from "next";
import {
  ClerkProvider,
  SignInButton,
  SignUpButton,
  SignedIn,
  SignedOut,
  UserButton,
} from "@clerk/nextjs";
import Logo from "@/components/Logo";
import "./globals.css";

export const metadata: Metadata = {
  title: "Shabe - Conversational Workspace",
  description: "Enterprise conversational workspace with AI-powered chat, email, events, and reports",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className="bg-gradient-to-br from-amber-50 to-yellow-100 min-h-screen font-['Inter']">
          {/* Modern Header */}
          <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between items-center h-16">
                <div className="flex items-center space-x-3">
                  {/* Logo */}
                  <div className="flex items-center space-x-2">
                    <Logo size="md" />
                    <h1 className="text-xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
                      Shabe
                    </h1>
                  </div>
                  <div className="hidden md:block">
                    <span className="text-sm text-slate-500 font-medium">Conversational Workspace</span>
                  </div>
                </div>
                
                {/* Auth Buttons */}
                <div className="flex items-center space-x-3">
                  <SignedOut>
                    <SignInButton mode="modal">
                      <button className="text-slate-600 hover:text-slate-900 px-4 py-2 text-sm font-medium transition-colors">
                        Sign In
                      </button>
                    </SignInButton>
                    <SignUpButton mode="modal">
                      <button className="bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-600 hover:to-yellow-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 shadow-sm hover:shadow-md">
                        Get Started
                      </button>
                    </SignUpButton>
                  </SignedOut>
                  <SignedIn>
                    <UserButton 
                      appearance={{
                        elements: {
                          avatarBox: "w-8 h-8",
                          userButtonPopoverCard: "shadow-xl border border-slate-200",
                        }
                      }}
                    />
                  </SignedIn>
                </div>
              </div>
            </div>
          </header>
          
          {/* Main Content */}
          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {children}
          </main>
        </body>
      </html>
    </ClerkProvider>
  );
} 