'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useRef, useState, useEffect } from 'react';
import WalletConnect from './WalletConnect';

export default function Navigation() {
  const pathname = usePathname();
  const navRef = useRef<HTMLDivElement>(null);
  const linkRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const [sliderStyle, setSliderStyle] = useState({ left: 0, width: 0 });

  const navLinks = [
    { href: '/', label: 'Home' },
    { href: '/create', label: 'Create Parlay' },
    { href: '/my-parlays', label: 'My Parlays' },
  ];

  useEffect(() => {
    const activeIndex = navLinks.findIndex(link => link.href === pathname);
    if (activeIndex === -1 || !linkRefs.current[activeIndex] || !navRef.current) {
      return;
    }

    const activeLink = linkRefs.current[activeIndex];
    const navContainer = navRef.current;
    
    if (activeLink) {
      const navRect = navContainer.getBoundingClientRect();
      const linkRect = activeLink.getBoundingClientRect();
      
      setSliderStyle({
        left: linkRect.left - navRect.left,
        width: linkRect.width,
      });
    }
  }, [pathname]);

  return (
    <nav className="border-b border-neutral-900 bg-neutral-900/50 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center gap-8">
            <Link href="/" className="text-2xl font-bold text-white">
              <span className="text-blue-500">Parlay</span>Market
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

