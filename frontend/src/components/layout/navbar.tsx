'use client';

import Link from 'next/link';
import { WalletConnectButton } from '@/components/wallet';

const NAV_ITEMS = [
  { href: '/', label: 'Home' },
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/identity/create', label: 'Create Identity' },
  { href: '/identity/manage', label: 'Manage Identity' },
  { href: '/score', label: 'Credit Score' },
  { href: '/lender', label: 'Lender Portal' },
  { href: '/governance', label: 'Governance' },
];

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 font-bold text-xl">
            <span className="text-primary">✦</span>
            <span>StellarTrust</span>
          </Link>
          <nav className="hidden md:flex items-center gap-4">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        <WalletConnectButton />
      </div>
    </header>
  );
}
