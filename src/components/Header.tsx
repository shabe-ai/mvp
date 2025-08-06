"use client";

import {
  SignInButton,
  UserButton,
} from "@clerk/nextjs";
import { useUser } from "@clerk/nextjs";
import Link from "next/link";
import Logo from "./Logo";

export default function Header() {
  const { user } = useUser();

  return (
    <header className="bg-white shadow-sm border-b border-[#d9d2c7]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-3">
            <Logo />
            <h1 className="text-xl font-medium text-black">
              Shabe ai
            </h1>
          </div>
          
          <div className="flex items-center space-x-4">
            {user ? (
              <div className="flex items-center space-x-4">
                <Link href="/" className="text-[#d9d2c7] hover:text-black px-4 py-2 text-sm font-medium transition-colors">
                  Home
                </Link>
                <Link href="/admin" className="text-[#d9d2c7] hover:text-black px-4 py-2 text-sm font-medium transition-colors">
                  Admin
                </Link>
                <UserButton />
              </div>
            ) : (
              <SignInButton>
                <button className="bg-[#f3e89a] hover:bg-[#efe076] text-black px-4 py-2 rounded-lg font-medium transition-colors">
                  Sign In
                </button>
              </SignInButton>
            )}
          </div>
        </div>
      </div>
    </header>
  );
} 