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

import "./globals.css";
import Link from "next/link";

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
      <html lang="en" className="h-screen w-screen" style={{ maxWidth: '100vw', maxHeight: '100vh' }}>
        <body className="bg-white min-h-screen flex flex-col font-['Inter']" style={{ maxWidth: '100vw', maxHeight: '100vh' }}>
          {/* Modern Header */}
          <header className="bg-white/80 backdrop-blur-md border-b border-[#d9d2c7] sticky top-0 z-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between items-center h-16">
                <div className="flex items-center space-x-3">
                  {/* Logo */}
                  <div className="flex items-center space-x-2">
                    <img src="/logo.png" alt="Shabe Logo" className="h-10 w-10" />
                    <h1 className="text-xl font-medium text-black">
                      Shabe ai
                    </h1>
                  </div>
                </div>
                
                {/* Auth Buttons and Admin Tab */}
                <div className="flex items-center space-x-3">
                  <SignedIn>
                    <Link href="/" className="text-[#d9d2c7] hover:text-black px-4 py-2 text-sm font-medium transition-colors">
                      Home
                    </Link>
                    <Link href="/admin" className="text-[#d9d2c7] hover:text-black px-4 py-2 text-sm font-medium transition-colors">
                      Admin
                    </Link>
                  </SignedIn>
                  <SignedOut>
                    <SignInButton mode="modal">
                      <button className="text-[#d9d2c7] hover:text-black px-4 py-2 text-sm font-medium transition-colors">
                        Sign In
                      </button>
                    </SignInButton>
                    <SignUpButton mode="modal">
                      <button className="bg-[#f3e89a] hover:bg-[#efe076] text-black px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                        Get Started
                      </button>
                    </SignUpButton>
                  </SignedOut>
                  <SignedIn>
                    <UserButton 
                      appearance={{
                        elements: {
                          avatarBox: "w-8 h-8",
                          userButtonPopoverCard: "shadow-xl border border-[#d9d2c7]",
                        }
                      }}
                    />
                  </SignedIn>
                </div>
              </div>
            </div>
          </header>
          
          {/* Main Content */}
          <main className="flex-1 min-h-0 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 bg-white flex flex-col" style={{ maxWidth: '100vw' }}>
            {children}
          </main>
        </body>
      </html>
    </ClerkProvider>
  );
} 