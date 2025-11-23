'use client';

import { useState } from 'react';
import { formatAddress, copyToClipboard, openInExplorer } from '@/lib/utils';

interface AddressDisplayProps {
  address: string;
  label?: string;
  chars?: number;
  showCopy?: boolean;
  showExplorer?: boolean;
  chain?: 'coston2' | 'flare';
}

export default function AddressDisplay({
  address,
  label,
  chars = 4,
  showCopy = true,
  showExplorer = true,
  chain = 'coston2',
}: AddressDisplayProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const success = await copyToClipboard(address);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleExplorer = () => {
    openInExplorer(address, chain);
  };

  return (
    <div className="flex items-center gap-2">
      {label && <span className="text-neutral-400 text-sm">{label}:</span>}
      
      <span className="font-mono text-sm">{formatAddress(address, chars)}</span>
      
      {showCopy && (
        <button
          onClick={handleCopy}
          className="text-neutral-400 hover:text-white transition-colors"
          title="Copy address"
        >
          {copied ? '✓' : '📋'}
        </button>
      )}
      
      {showExplorer && (
        <button
          onClick={handleExplorer}
          className="text-neutral-400 hover:text-blue-500 transition-colors"
          title="View in explorer"
        >
          🔗
        </button>
      )}
    </div>
  );
}

