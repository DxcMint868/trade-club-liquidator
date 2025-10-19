'use client';

import { useState } from 'react';
import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import Link from 'next/link';

export default function ExecuteTradePage() {
  const { address, isConnected } = useAccount();
  const [selectedDelegations, setSelectedDelegations] = useState<string[]>([]);
  const [tradeParams, setTradeParams] = useState({
    targetContract: '',
    value: '0',
    calldata: '',
  });
  const [isExecuting, setIsExecuting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');

  const executeBatchTrade = async () => {
    if (!address) {
      setError('Connect wallet first');
      return;
    }

    setIsExecuting(true);
    setError('');
    setResult(null);

    try {
      // Send to backend to execute via bundler (Bob-Alice pattern)
      // Backend handles:
      // 1. Fetching signed delegations
      // 2. Building redeemDelegations calldata
      // 3. Creating UserOperation
      // 4. Submitting to bundler
      const executeResponse = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/trades/execute-batch`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            delegationIds: selectedDelegations,
            tradeParams: {
              target: tradeParams.targetContract,
              value: tradeParams.value,
              data: tradeParams.calldata,
            },
          }),
        }
      );

      const executeResult = await executeResponse.json();
      
      if (!executeResponse.ok) {
        throw new Error(executeResult.error || 'Execution failed');
      }

      setResult({
        userOpHash: executeResult.userOpHash,
        status: 'submitted',
        message: 'UserOperation submitted to bundler',
      });

      // Poll for completion (in real app, use WebSocket)
      setTimeout(async () => {
        const statusResponse = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/trades/status/${executeResult.userOpHash}`
        );
        const statusResult = await statusResponse.json();
        
        setResult({
          userOpHash: executeResult.userOpHash,
          status: statusResult.success ? 'success' : 'failed',
          blockNumber: statusResult.blockNumber,
          transactionHash: statusResult.transactionHash,
        });
      }, 5000);

    } catch (err: any) {
      setError(`Execution failed: ${err.message}`);
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <Link href="/" className="text-blue-500 hover:text-blue-400">← Back</Link>
          <ConnectButton />
        </div>

        <h1 className="text-4xl font-bold mb-8">Execute Copy Trade (Bob-Alice Pattern)</h1>

        {!isConnected ? (
          <div className="card">
            <p className="text-gray-400 mb-4">Connect wallet to execute trades</p>
            <ConnectButton />
          </div>
        ) : (
          <div className="space-y-6">
            <div className="card">
              <h2 className="text-xl font-semibold mb-6">Trade Parameters</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Target Contract (DEX Router)</label>
                  <input
                    type="text"
                    value={tradeParams.targetContract}
                    onChange={(e) => setTradeParams({ ...tradeParams, targetContract: e.target.value })}
                    placeholder="0xUniswapRouter..."
                    className="input"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-2">ETH Value (wei)</label>
                  <input
                    type="text"
                    value={tradeParams.value}
                    onChange={(e) => setTradeParams({ ...tradeParams, value: e.target.value })}
                    placeholder="1000000000000000000"
                    className="input"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-2">Calldata (hex)</label>
                  <textarea
                    value={tradeParams.calldata}
                    onChange={(e) => setTradeParams({ ...tradeParams, calldata: e.target.value })}
                    placeholder="0x..."
                    className="input h-32 font-mono text-xs"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-2">Selected Delegations (comma separated IDs)</label>
                  <input
                    type="text"
                    onChange={(e) => setSelectedDelegations(e.target.value.split(',').map(s => s.trim()))}
                    placeholder="delegation-1, delegation-2"
                    className="input"
                  />
                  <p className="text-xs text-gray-500 mt-1">Batch execution will run all at once</p>
                </div>
              </div>

              {error && (
                <div className="mt-4 p-4 bg-red-900/30 border border-red-500 rounded">
                  <p className="text-red-400">{error}</p>
                </div>
              )}

              <button
                onClick={executeBatchTrade}
                disabled={isExecuting || !tradeParams.targetContract || selectedDelegations.length === 0}
                className="btn btn-primary mt-6 disabled:opacity-50"
              >
                {isExecuting ? 'Executing...' : `Execute Batch (${selectedDelegations.length} delegations)`}
              </button>
            </div>

            {result && (
              <div className={`card ${result.status === 'success' ? 'bg-green-900/20 border-green-500' : 'bg-yellow-900/20 border-yellow-500'}`}>
                <h3 className="text-lg font-semibold mb-4">Execution Result</h3>
                <pre className="bg-gray-900 p-4 rounded overflow-auto text-xs">
                  {JSON.stringify(result, null, 2)}
                </pre>
              </div>
            )}

            <div className="card bg-blue-900/20 border-blue-500">
              <h3 className="text-lg font-semibold mb-2">Bob-Alice Pattern</h3>
              <ul className="text-gray-400 space-y-2 text-sm">
                <li>• Bob (delegate/Monachad) gathers signed delegations from supporters (Alice)</li>
                <li>• Bob builds batch execution with DelegationManager.redeemDelegations()</li>
                <li>• Single UserOperation submitted to bundler contains all redemptions</li>
                <li>• Bundler processes atomically - all trades succeed or fail together</li>
                <li>• Gas efficient & leverages Monad's parallel processing</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
