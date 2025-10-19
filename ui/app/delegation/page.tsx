'use client';

import { useState } from 'react';
import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import Link from 'next/link';

export default function DelegationPage() {
  const { address, isConnected } = useAccount();
  const [formData, setFormData] = useState({
    matchId: '',
    monachadAddress: '',
    spendingLimit: '',
    allowedTargets: '',
    expiryDays: '7',
  });
  const [isCreating, setIsCreating] = useState(false);
  const [signedDelegation, setSignedDelegation] = useState<any>(null);
  const [error, setError] = useState('');

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const createAndSignDelegation = async () => {
    if (!address) {
      setError('Please connect wallet');
      return;
    }

    setIsCreating(true);
    setError('');

    try {
      // Parse allowed targets (comma separated addresses)
      const targets = formData.allowedTargets
        .split(',')
        .map(t => t.trim())
        .filter(t => t);

      // Calculate expiry timestamp
      const expiryTimestamp = Math.floor(Date.now() / 1000) + (parseInt(formData.expiryDays) * 24 * 60 * 60);

      // Prepare delegation data (simplified for MVP)
      const delegationData = {
        supporter: address,
        monachad: formData.monachadAddress,
        matchId: formData.matchId,
        spendingLimit: formData.spendingLimit,
        allowedTargets: targets,
        expiryTimestamp,
      };

      setSignedDelegation({
        ...delegationData,
        status: 'ready_to_sign',
      });

      // Send to backend to create and store signed delegation
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/delegations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(delegationData),
      });

      if (!response.ok) {
        throw new Error('Backend API call failed');
      }

    } catch (err: any) {
      setError(`Failed to create delegation: ${err.message}`);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <Link href="/" className="text-blue-500 hover:text-blue-400">← Back</Link>
          <ConnectButton />
        </div>

        <h1 className="text-4xl font-bold mb-8">Create Delegation</h1>

        {!isConnected ? (
          <div className="card">
            <p className="text-gray-400 mb-4">Connect wallet to create delegation</p>
            <ConnectButton />
          </div>
        ) : (
          <div className="space-y-6">
            <div className="card">
              <h2 className="text-xl font-semibold mb-6">Delegation Parameters</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Match ID</label>
                  <input
                    type="text"
                    name="matchId"
                    value={formData.matchId}
                    onChange={handleInputChange}
                    placeholder="match-123"
                    className="input"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-2">Monachad Address (Delegate)</label>
                  <input
                    type="text"
                    name="monachadAddress"
                    value={formData.monachadAddress}
                    onChange={handleInputChange}
                    placeholder="0x..."
                    className="input"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-2">Spending Limit (wei)</label>
                  <input
                    type="text"
                    name="spendingLimit"
                    value={formData.spendingLimit}
                    onChange={handleInputChange}
                    placeholder="1000000000000000000"
                    className="input"
                  />
                  <p className="text-xs text-gray-500 mt-1">1 ETH = 1000000000000000000 wei</p>
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-2">Allowed Target Contracts (comma separated)</label>
                  <textarea
                    name="allowedTargets"
                    value={formData.allowedTargets}
                    onChange={handleInputChange}
                    placeholder="0xUniswapRouter, 0xSushiswapRouter"
                    className="input h-24"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-2">Expiry (days)</label>
                  <input
                    type="number"
                    name="expiryDays"
                    value={formData.expiryDays}
                    onChange={handleInputChange}
                    className="input"
                  />
                </div>
              </div>

              {error && (
                <div className="mt-4 p-4 bg-red-900/30 border border-red-500 rounded">
                  <p className="text-red-400">{error}</p>
                </div>
              )}

              <button
                onClick={createAndSignDelegation}
                disabled={isCreating || !formData.matchId || !formData.monachadAddress}
                className="btn btn-primary mt-6 disabled:opacity-50"
              >
                {isCreating ? 'Creating...' : 'Create & Sign Delegation'}
              </button>
            </div>

            {signedDelegation && (
              <div className="card bg-green-900/20 border-green-500">
                <h3 className="text-lg font-semibold mb-4">Delegation Created ✅</h3>
                <pre className="bg-gray-900 p-4 rounded overflow-auto text-xs">
                  {JSON.stringify(signedDelegation, null, 2)}
                </pre>
                <Link href="/view-delegations" className="btn btn-primary mt-4 inline-block">
                  View All Delegations →
                </Link>
              </div>
            )}

            <div className="card bg-blue-900/20 border-blue-500">
              <h3 className="text-lg font-semibold mb-2">Enforcers Explained</h3>
              <ul className="text-gray-400 space-y-2 text-sm">
                <li>• <strong>ValueLte:</strong> Limits total ETH that can be spent</li>
                <li>• <strong>Timestamp:</strong> Delegation only valid within time window</li>
                <li>• <strong>AllowedTargets:</strong> Only specified contract addresses can be called</li>
                <li>• <strong>AllowedMethods:</strong> Only specific functions can be executed</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
