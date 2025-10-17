'use client';

import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import Link from 'next/link';

export default function ViewDelegationsPage() {
  const { address, isConnected } = useAccount();
  const [delegations, setDelegations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isConnected && address) {
      fetchDelegations();
    }
  }, [isConnected, address]);

  const fetchDelegations = async () => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/delegations?supporter=${address}`
      );
      const data = await response.json();
      setDelegations(data);
    } catch (err) {
      console.error('Failed to fetch delegations:', err);
      // Mock data
      setDelegations([
        {
          id: 'del-1',
          matchId: 'match-1',
          monachad: '0x1234...5678',
          spendingLimit: '1000000000000000000',
          spent: '0',
          status: 'active',
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <Link href="/" className="text-blue-500 hover:text-blue-400">← Back</Link>
          <ConnectButton />
        </div>

        <h1 className="text-4xl font-bold mb-8">My Delegations</h1>

        {!isConnected ? (
          <div className="card">
            <p className="text-gray-400 mb-4">Connect wallet to view delegations</p>
            <ConnectButton />
          </div>
        ) : (
          <div className="space-y-6">
            {loading ? (
              <div className="card">Loading delegations...</div>
            ) : delegations.length === 0 ? (
              <div className="card">
                <p className="text-gray-400 mb-4">No delegations found</p>
                <Link href="/delegation" className="btn btn-primary inline-block">
                  Create First Delegation →
                </Link>
              </div>
            ) : (
              <>
                {delegations.map((delegation) => (
                  <div key={delegation.id} className="card">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-xl font-semibold mb-2">
                          Delegation {delegation.id}
                        </h3>
                        <p className="text-sm text-gray-400">Status: <span className="text-green-400">{delegation.status}</span></p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <p className="text-sm text-gray-400">Match ID</p>
                        <p className="font-mono text-sm">{delegation.matchId}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-400">Monachad (Delegate)</p>
                        <p className="font-mono text-sm">{delegation.monachad}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-400">Spending Limit</p>
                        <p className="font-mono text-sm">{delegation.spendingLimit} wei</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-400">Spent</p>
                        <p className="font-mono text-sm">{delegation.spent} wei</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-400">Expires At</p>
                        <p className="text-sm">{new Date(delegation.expiresAt).toLocaleString()}</p>
                      </div>
                    </div>

                    <details className="mt-4">
                      <summary className="cursor-pointer text-sm text-blue-400 hover:text-blue-300">
                        Show Raw Delegation Data (for debugging)
                      </summary>
                      <pre className="mt-2 bg-gray-900 p-4 rounded overflow-auto text-xs">
                        {JSON.stringify(delegation, null, 2)}
                      </pre>
                    </details>
                  </div>
                ))}
              </>
            )}

            <div className="card bg-blue-900/20 border-blue-500">
              <h3 className="text-lg font-semibold mb-2">What's Next?</h3>
              <p className="text-gray-400 mb-4">
                These delegations allow Monachads to execute copy trades on your behalf.
                Monitor the execution page to see them in action.
              </p>
              <Link href="/execute-trade" className="btn btn-primary inline-block">
                Test Trade Execution →
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
