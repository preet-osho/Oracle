"use client";

import { useState } from "react";
import Link from "next/link";

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-[#020711]/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white">
            O
          </div>
          <span className="text-base font-bold tracking-tight text-white">
            ORACLE
          </span>
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          <Link href="/#features" className="text-sm text-white/60 transition hover:text-white">
            Features
          </Link>
          <Link href="/pricing" className="text-sm text-white/60 transition hover:text-white">
            Pricing
          </Link>
          <Link href="/#testimonials" className="text-sm text-white/60 transition hover:text-white">
            Testimonials
          </Link>
          <Link
            href="/app"
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500"
          >
            Open App →
          </Link>
        </div>

        <button
          className="flex h-8 w-8 items-center justify-center rounded-md text-white/60 transition hover:text-white md:hidden"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
          aria-expanded={mobileOpen}
          aria-controls="mobile-menu"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {mobileOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>

      {mobileOpen && (
        <div id="mobile-menu" className="border-t border-white/5 bg-[#020711]/95 backdrop-blur-xl md:hidden">
          <div className="flex flex-col gap-1 px-6 py-4">
            <Link href="/#features" className="rounded-md px-3 py-2 text-sm text-white/60 transition hover:bg-white/5 hover:text-white" onClick={() => setMobileOpen(false)}>
              Features
            </Link>
            <Link href="/pricing" className="rounded-md px-3 py-2 text-sm text-white/60 transition hover:bg-white/5 hover:text-white" onClick={() => setMobileOpen(false)}>
              Pricing
            </Link>
            <Link href="/#testimonials" className="rounded-md px-3 py-2 text-sm text-white/60 transition hover:bg-white/5 hover:text-white" onClick={() => setMobileOpen(false)}>
              Testimonials
            </Link>
            <Link href="/app" className="mt-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-center text-sm font-medium text-white transition hover:bg-indigo-500" onClick={() => setMobileOpen(false)}>
              Open App →
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
