"use client";

import {
  SignInButton,
  UserButton,
} from "@clerk/nextjs";
import { useUser } from "@clerk/nextjs";
import Link from "next/link";
import Logo from "./Logo";
import SimpleTourButton from "./SimpleTourButton";

export default function Header() {
  const { user } = useUser();

  return (
    <header className="sticky top-0 z-40 bg-bg/80 backdrop-blur border-b border-line-200">
      <div className="mx-auto max-w-7xl px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Logo />
          <span className="font-semibold text-lg tracking-tight text-ink-900">Shabe ai</span>
        </div>
        <nav className="flex items-center gap-6 text-sm text-ink-700">
          {user ? (
            <>
              <Link href="/" className="hover:text-ink-900 transition-colors">Home</Link>
              <Link href="/analytics" className="hover:text-ink-900 transition-colors">Analytics</Link>
              <Link href="/campaign-manager" className="hover:text-ink-900 transition-colors">Campaigns</Link>
              <Link href="/admin" className="hover:text-ink-900 transition-colors">Admin</Link>
              <SimpleTourButton />
              <UserButton />
            </>
          ) : (
            <SignInButton>
              <button className="ml-2 rounded-ctl border border-line-200 px-3 py-1.5 hover:shadow-card transition-shadow duration-150 ease-shabe text-ink-900">
                Take Tour
              </button>
            </SignInButton>
          )}
        </nav>
      </div>
    </header>
  );
} 