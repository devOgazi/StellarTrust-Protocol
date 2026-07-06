import Link from 'next/link';
import { Button } from '@/components/ui';

export default function HomePage() {
  return (
    <div className="flex flex-col items-center space-y-12 py-12">
      <section className="text-center space-y-4 max-w-3xl">
        <h1 className="text-5xl font-bold tracking-tight">
          Decentralized Identity &amp; Credit Scoring on{' '}
          <span className="text-primary">Stellar</span>
        </h1>
        <p className="text-xl text-muted-foreground">
          Open, permissionless, and verifiable financial reputation — for everyone.
          Built on Stellar&apos;s Soroban smart contract platform.
        </p>
        <div className="flex gap-4 justify-center pt-4">
          <Link href="/identity/create">
            <Button size="lg">Create Your Identity</Button>
          </Link>
          <Link href="/score">
            <Button variant="outline" size="lg">View Credit Score</Button>
          </Link>
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl w-full">
        <div className="rounded-lg border p-6 space-y-2">
          <h3 className="font-semibold text-lg">Self-Sovereign Identity</h3>
          <p className="text-sm text-muted-foreground">
            Create a decentralized identifier anchored to your Stellar keypair. Your identity,
            your control.
          </p>
        </div>
        <div className="rounded-lg border p-6 space-y-2">
          <h3 className="font-semibold text-lg">On-Chain Credit Scoring</h3>
          <p className="text-sm text-muted-foreground">
            Transparent, algorithmic credit scores computed from your on-chain Stellar
            activity — no centralized bureau required.
          </p>
        </div>
        <div className="rounded-lg border p-6 space-y-2">
          <h3 className="font-semibold text-lg">Lender SDK</h3>
          <p className="text-sm text-muted-foreground">
            Plug-and-play SDK for lenders to verify identity and query credit scores
            with user consent.
          </p>
        </div>
      </section>
    </div>
  );
}
