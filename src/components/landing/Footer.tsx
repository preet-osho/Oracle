import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-white/5 py-12">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-6 md:flex-row">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-indigo-600 text-xs font-bold text-white">
            O
          </div>
          <span className="text-sm font-semibold text-white/60">ORACLE</span>
        </div>
        <div className="flex gap-6">
          <Link href="/#features" className="text-xs text-white/30 transition hover:text-white/60">
            Features
          </Link>
          <Link href="/pricing" className="text-xs text-white/30 transition hover:text-white/60">
            Pricing
          </Link>
          <Link href="/#testimonials" className="text-xs text-white/30 transition hover:text-white/60">
            Testimonials
          </Link>
        </div>
        <p className="text-xs text-white/20">
          &copy; {new Date().getFullYear()} Oracle Digital. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
