'use client';

import { useState } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import Link from 'next/link';

export default function MonitorPage() {
  const [userOpHash, setUserOpHash] = useState('');
  const [receipt, setReceipt] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const checkUserOpStatus = async () => {
    if (!userOpHash) return;
    
    setLoading(true);
    try {
      // Query bundler for UserOperation receipt
      const response = await fetch(process.env.NEXT_PUBLIC_BUNDLER_URL!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'eth_getUserOperationReceipt',
          params: [userOpHash],
        }),
      });
      
      const data = await response.json();
      setReceipt(data.result);
    } catch (err) {
      console.error('Failed to fetch receipt:', err);
      alert('Failed to fetch UserOperation receipt');
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

        <h1 className="text-4xl font-bold mb-8">Monitor UserOperations</h1>

        <div className="space-y-6">
          <div className="card">
            <h2 className="text-xl font-semibold mb-4">Check UserOperation Status</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">UserOperation Hash</label>
                <input
                  type="text"
                  value={userOpHash}
                  onChange={(e) => setUserOpHash(e.target.value)}
                  placeholder="0x..."
                  className="input"
                />
              </div>

              <button
                onClick={checkUserOpStatus}
                disabled={loading || !userOpHash}
                className="btn btn-primary disabled:opacity-50"
              >
                {loading ? 'Checking...' : 'Check Status'}
              </button>
            </div>

            {receipt && (
              <div className="mt-6">
                <h3 className="text-lg font-semibold mb-2">Receipt</h3>
                <div className={`p-4 rounded ${receipt.success ? 'bg-green-900/20 border border-green-500' : 'bg-red-900/20 border border-red-500'}`}>
                  <p className="mb-2">
                    Status: <span className={receipt.success ? 'text-green-400' : 'text-red-400'}>
                      {receipt.success ? 'SUCCESS ✅' : 'FAILED ❌'}
                    </span>
                  </p>
                  <p className="text-sm text-gray-400">Block: {receipt.receipt?.blockNumber}</p>
                  <p className="text-sm text-gray-400 break-all">Tx Hash: {receipt.receipt?.transactionHash}</p>
                </div>
                <details className="mt-4">
                  <summary className="cursor-pointer text-sm text-blue-400 hover:text-blue-300">
                    Show Full Receipt
                  </summary>
                  <pre className="mt-2 bg-gray-900 p-4 rounded overflow-auto text-xs">
                    {JSON.stringify(receipt, null, 2)}
                  </pre>
                </details>
              </div>
            )}
          </div>

          <div className="card bg-blue-900/20 border-blue-500">
            <h3 className="text-lg font-semibold mb-2">Monitoring Tips</h3>
            <ul className="text-gray-400 space-y-2 text-sm">
              <li>• UserOperation hashes are returned when you execute trades</li>
              <li>• Check status to see if the bundler has included your operation</li>
              <li>• Success means all copy trades in the batch executed properly</li>
              <li>• Failed operations should show revert reason in logs</li>
            </ul>
          </div>

          <div className="card">
            <h3 className="text-lg font-semibold mb-4">Recent Activity</h3>
            <p className="text-gray-400 text-sm">
              (WebSocket integration would go here for live updates)
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
