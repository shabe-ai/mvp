"use client";

import Link from "next/link";
import Image from 'next/image';
import {
  SignInButton,
  SignUpButton,
  SignedIn,
  SignedOut,
  UserButton,
} from "@clerk/nextjs";
import { useAdminAuth } from "@/lib/adminAuth";


export default function Header() {
  const { isAdmin, isAnalyticsAdmin } = useAdminAuth();

  return (
    <header className="bg-white/80 backdrop-blur-md border-b border-[#d9d2c7] sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-3">
            {/* Logo */}
            <div className="flex items-center space-x-2">
              <Image src="/logo.png" alt="Shabe Logo" width={40} height={40} />
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
  );
} 