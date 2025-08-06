import React from "react";
import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";

import "./globals.css";
import { safePostHog } from "@/lib/posthog";
import PostHogProvider from "@/components/PostHogProvider";
import Header from "@/components/Header";

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
          <Header />
          
          {/* Main Content */}
          <main className="flex-1 min-h-0 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 bg-white flex flex-col" style={{ maxWidth: '100vw' }}>
            <PostHogProvider>
              {children}
            </PostHogProvider>
          </main>
        </body>
      </html>
    </ClerkProvider>
  );
} 