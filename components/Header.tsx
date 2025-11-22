"use client";

import Link from "next/link";

export default function Header() {
  return (
    <header className="bg-flare-dark border-b border-gray-700">
      <div className="container mx-auto px-4 py-4">
        <nav className="flex justify-between items-center">
          <Link href="/" className="text-2xl font-bold text-flare-primary">
            🔥 Parlay Market
          </Link>
          <div className="flex gap-6">
            <Link
              href="/"
              className="text-gray-300 hover:text-flare-secondary transition-colors"
            >
              Home
            </Link>
            <Link
              href="/about"
              className="text-gray-300 hover:text-flare-secondary transition-colors"
            >
              About
            </Link>
          </div>
        </nav>
      </div>
    </header>
  );
}
