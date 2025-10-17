'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-12">
          <h1 className="text-4xl font-bold">TradeClub MVP</h1>
          <ConnectButton />
        </div>

        {/* Nav Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Link href="/onboarding" className="card hover:border-blue-500 transition-colors">
            <h2 className="text-2xl font-semibold mb-2">1. Onboarding</h2>
            <p className="text-gray-400">Deploy & manage your MetaMask smart account (DeleGator)</p>
          </Link>

          <Link href="/matches" className="card hover:border-blue-500 transition-colors">
            <h2 className="text-2xl font-semibold mb-2">2. Matches</h2>
            <p className="text-gray-400">Join matches and view active copy trading competitions</p>
          </Link>

          <Link href="/delegation" className="card hover:border-blue-500 transition-colors">
            <h2 className="text-2xl font-semibold mb-2">3. Create Delegation</h2>
            <p className="text-gray-400">Sign delegations with enforcers (spending limits, targets, etc.)</p>
          </Link>

          <Link href="/view-delegations" className="card hover:border-blue-500 transition-colors">
            <h2 className="text-2xl font-semibold mb-2">4. View Delegations</h2>
            <p className="text-gray-400">See all signed delegations and their status</p>
          </Link>

          <Link href="/execute-trade" className="card hover:border-blue-500 transition-colors">
            <h2 className="text-2xl font-semibold mb-2">5. Execute Trade (Bob)</h2>
            <p className="text-gray-400">Test single or batch copy trade execution via delegation</p>
          </Link>

          <Link href="/monitor" className="card hover:border-blue-500 transition-colors">
            <h2 className="text-2xl font-semibold mb-2">6. Monitor</h2>
            <p className="text-gray-400">View trade results, UserOp status, and event logs</p>
          </Link>
        </div>

        {/* Info Section */}
        <div className="mt-12 card">
          <h3 className="text-xl font-semibold mb-4">About This MVP</h3>
          <ul className="text-gray-400 space-y-2">
            <li>• Uses MetaMask Delegation Toolkit for smart account management</li>
            <li>• Implements Bob-Alice delegation pattern with batching support</li>
            <li>• Tests ERC-4337 UserOperation flows on Monad testnet</li>
            <li>• Designed for rapid iteration and backend integration testing</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
