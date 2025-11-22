'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import WalletConnect from './WalletConnect';

export default function Navigation() {
  const pathname = usePathname();

  const navLinks = [
    { href: '/', label: 'Home' },
    { href: '/create', label: 'Create Parlay' },
    { href: '/browse', label: 'Browse Parlays' },
    { href: '/my-parlays', label: 'My Parlays' },
  ];

  return (
    <nav className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-sm sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center gap-8">
            <Link href="/" className="text-2xl font-bold text-white">
              <span className="text-blue-500">Parlay</span>Market
            </Link>
            
            <div className="hidden md:flex gap-6">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`text-sm font-medium transition-colors hover:text-blue-500 ${
                    pathname === link.href ? 'text-blue-500' : 'text-gray-400'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>

          <WalletConnect />
        </div>
      </div>
    </nav>
  );
}

