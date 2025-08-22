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
    <header className="bg-neutral-primary shadow-sm border-b border-neutral-secondary">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-3">
            <Logo />
            <h1 className="text-xl font-medium text-text-primary font-heading">
              Shabe ai
            </h1>
          </div>
          
          <div className="flex items-center space-x-4">
            {user ? (
              <div className="flex items-center space-x-4">
                <Link href="/" className="text-text-secondary hover:text-text-primary px-4 py-2 text-sm font-medium transition-colors font-body">
                  Home
                </Link>
                <Link href="/admin" className="text-text-secondary hover:text-text-primary px-4 py-2 text-sm font-medium transition-colors font-body">
                  Admin
                </Link>
                <UserButton />
              </div>
            ) : (
              <SignInButton>
                <button className="bg-accent-primary hover:bg-accent-primary-hover text-text-on-accent-primary px-4 py-2 rounded-md font-medium transition-colors font-button">
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