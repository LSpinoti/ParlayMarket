'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import WalletConnect from './WalletConnect';

export default function Navigation() {
  const pathname = usePathname();
  const [sliderStyle, setSliderStyle] = useState({ left: 0, width: 0 });
  const navRef = useRef<HTMLDivElement>(null);
  const linkRefs = useRef<(HTMLAnchorElement | null)[]>([]);

  const navLinks = [
    { href: '/', label: 'Home', icon: '⌂' },
    { href: '/create', label: 'Create' },
    { href: '/marketplace', label: 'Marketplace' },
    { href: '/my-parlays', label: 'My Parlays' },
  ];

  useEffect(() => {
    const activeIndex = navLinks.findIndex((link) => link.href === pathname);
    const activeLink = linkRefs.current[activeIndex];
    const nav = navRef.current;

    if (activeLink && nav) {
      const navRect = nav.getBoundingClientRect();
      const linkRect = activeLink.getBoundingClientRect();
      setSliderStyle({
        left: linkRect.left - navRect.left,
        width: linkRect.width,
      });
    }
  }, [pathname]);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 px-6 py-4">
      <div className="flex items-center max-w-7xl mx-auto">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 text-white">
          <span className="text-2xl">✦</span>
          <span className="text-xl font-medium">ParlayMarket</span>
        </Link>

        {/* Centered Pill Navigation - Liquid Glass */}
        <div
          ref={navRef}
          className="hidden md:flex items-center gap-1 bg-white/5 backdrop-blur-xl border border-white/10 rounded-full px-2 py-1.5 shadow-[0_8px_32px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.1)] absolute left-1/2 -translate-x-1/2"
        >
          {/* Sliding indicator */}
          <div
            className="absolute top-1.5 bottom-1.5 bg-white/10 rounded-full shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] transition-all duration-300 ease-out"
            style={{
              left: sliderStyle.left,
              width: sliderStyle.width,
            }}
          />

          {navLinks.map((link, index) => (
            <Link
              key={link.href}
              href={link.href}
              ref={(el) => { linkRefs.current[index] = el; }}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors duration-200 relative z-10 ${
                pathname === link.href
                  ? 'text-white'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              {link.icon && <span className="text-xs">{link.icon}</span>}
              {link.label}
            </Link>
          ))}
        </div>

        {/* Wallet Connect Button */}
        <div className="ml-auto">
          <WalletConnect />
        </div>
      </div>
    </nav>
  );
}
