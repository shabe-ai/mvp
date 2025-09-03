"use client";

import {
  SignInButton,
  UserButton,
} from "@clerk/nextjs";
import { useUser } from "@clerk/nextjs";
import { useState } from "react";
import Link from "next/link";
import Logo from "./Logo";
import SimpleTourButton from "./SimpleTourButton";
import { Menu, X } from "lucide-react";

export default function Header() {
  const { user } = useUser();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 bg-bg/80 backdrop-blur border-b border-line-200">
      <div className="mx-auto max-w-7xl px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Logo />
          <span className="font-display font-bold text-base tracking-tight text-ink-900">Shabe ai</span>
        </div>
        <nav className="flex items-center gap-2 sm:gap-4 text-sm text-ink-700">
          {user ? (
            <>
              {/* Mobile Menu Button */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 rounded-md hover:bg-accent-50 transition-colors"
                aria-label="Toggle mobile menu"
              >
                {mobileMenuOpen ? (
                  <X className="h-5 w-5 text-ink-700" />
                ) : (
                  <Menu className="h-5 w-5 text-ink-700" />
                )}
              </button>
              
              {/* Desktop Navigation Links */}
              <div className="hidden md:flex items-center gap-4">
                <Link href="/" className="hover:text-ink-900 transition-colors">Home</Link>
                <Link href="/analytics" className="hover:text-ink-900 transition-colors">Dashboards</Link>
                <Link href="/campaign-manager" className="hover:text-ink-900 transition-colors">Campaigns</Link>
                <Link href="/admin" className="hover:text-ink-900 transition-colors">Admin</Link>
              </div>
              
              {/* Tour Button - Only for authenticated users */}
              <SimpleTourButton />
              
              {/* User Button */}
              <UserButton />
            </>
          ) : (
            <>
              {/* Sign In Button - Only for non-authenticated users */}
              <SignInButton>
                <button className="rounded-ctl border border-line-200 px-3 py-1.5 hover:shadow-card transition-shadow duration-150 ease-shabe text-ink-900 text-sm">
                  Sign In
                </button>
              </SignInButton>
            </>
          )}
        </nav>
      </div>
      
      {/* Mobile Menu Dropdown */}
      {user && mobileMenuOpen && (
        <div className="md:hidden border-t border-line-200 bg-bg/95 backdrop-blur">
          <div className="px-6 py-4 space-y-3">
            <Link 
              href="/" 
              className="block py-2 text-ink-700 hover:text-ink-900 transition-colors"
              onClick={() => setMobileMenuOpen(false)}
            >
              Home
            </Link>
            <Link 
              href="/analytics" 
              className="block py-2 text-ink-700 hover:text-ink-900 transition-colors"
              onClick={() => setMobileMenuOpen(false)}
            >
              Dashboards
            </Link>
            <Link 
              href="/campaign-manager" 
              className="block py-2 text-ink-700 hover:text-ink-900 transition-colors"
              onClick={() => setMobileMenuOpen(false)}
            >
              Campaigns
            </Link>
            <Link 
              href="/admin" 
              className="block py-2 text-ink-700 hover:text-ink-900 transition-colors"
              onClick={() => setMobileMenuOpen(false)}
            >
              Admin
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}