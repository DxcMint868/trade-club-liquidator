'use client';

import { useState, useEffect } from 'react';
import { useAccount, usePublicClient, useWalletClient } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import Link from 'next/link';
import type { Hex } from 'viem';

export default function MatchesPage() {
  const { address, isConnected } = useAccount();
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMatches();
  }, []);

  const fetchMatches = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/matches`);
      const data = await response.json();
      setMatches(data);
    } catch (err) {
      console.error('Failed to fetch matches:', err);
      // Mock data for testing
      setMatches([
        { matchId: 'match-1', name: 'ETH Bulls vs Bears', status: 'active', participants: 12 },
        { matchId: 'match-2', name: 'DeFi Degen Championship', status: 'upcoming', participants: 8 },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  const joinMatch = async (matchId: string) => {
    if (!address || !walletClient || !publicClient) {
      alert('Please connect your wallet');
      return;
    }
    
    try {
      // Step 1: Get smart account address from localStorage
      const smartAccountAddr = localStorage.getItem(`smartAccount_${address}`);
      if (!smartAccountAddr) {
        alert('Please onboard first to create a smart account');
        window.location.href = '/onboarding';
        return;
      }

      alert('Signing delegation... Check your wallet!');

      // Step 2: Get backend address (the Monachad who will execute trades)
      const backendAddress = process.env.NEXT_PUBLIC_BACKEND_ADDRESS as Hex;
      const delegationManager = process.env.NEXT_PUBLIC_DELEGATION_MANAGER_ADDRESS as Hex;
      const chainId = await publicClient.getChainId();

      // Step 3: Create delegation structure following MetaMask Delegation Framework
      const ROOT_AUTHORITY = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff' as Hex;
      const delegation = {
        delegate: backendAddress, // Who can execute (backend)
        delegator: smartAccountAddr as Hex, // Smart account giving permission
        authority: ROOT_AUTHORITY, // Root authority
        caveats: [
          // Add limited calls caveat (max 100 trades)
          {
            enforcer: process.env.NEXT_PUBLIC_LIMITED_CALLS_ENFORCER as Hex,
            terms: '0x0000000000000000000000000000000000000000000000000000000000000064' as Hex, // 100 in hex
            args: '0x' as Hex,
          },
        ],
        salt: `0x${Date.now().toString(16).padStart(64, '0')}` as Hex,
      };

      // Step 4: Sign the delegation with EIP-712
      const signature = await walletClient.signTypedData({
        account: walletClient.account,
        domain: {
          name: 'DelegationManager',
          version: '1',
          chainId,
          verifyingContract: delegationManager,
        },
        types: {
          Delegation: [
            { name: 'delegate', type: 'address' },
            { name: 'delegator', type: 'address' },
            { name: 'authority', type: 'bytes32' },
            { name: 'caveats', type: 'Caveat[]' },
            { name: 'salt', type: 'uint256' },
          ],
          Caveat: [
            { name: 'enforcer', type: 'address' },
            { name: 'terms', type: 'bytes' },
            { name: 'args', type: 'bytes' },
          ],
        },
        primaryType: 'Delegation',
        message: {
          delegate: delegation.delegate,
          delegator: delegation.delegator,
          authority: delegation.authority,
          caveats: delegation.caveats,
          salt: BigInt(delegation.salt),
        },
      });

      const signedDelegation = {
        ...delegation,
        signature,
      };

      // Step 5: Send signed delegation to backend
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/matches/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          matchId, 
          address,
          smartAccountAddress: smartAccountAddr,
          signedDelegation,
        }),
      });

      if (!response.ok) throw new Error('Failed to join match');

      alert('Successfully joined match with delegation! 🎉');
      fetchMatches();
    } catch (err: any) {
      console.error('Failed to join match:', err);
      alert(`Failed: ${err.message}`);
    }
  };

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <Link href="/" className="text-blue-500 hover:text-blue-400">← Back</Link>
          <ConnectButton />
        </div>

        <h1 className="text-4xl font-bold mb-8">Active Matches</h1>

        {!isConnected ? (
          <div className="card">
            <p className="text-gray-400 mb-4">Connect wallet to join matches</p>
            <ConnectButton />
          </div>
        ) : (
          <div className="space-y-6">
            {loading ? (
              <div className="card">Loading matches...</div>
            ) : (
              <>
                {matches.map((match) => (
                  <div key={match.matchId} className="card">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-xl font-semibold mb-2">{match.name}</h3>
                        <p className="text-gray-400 text-sm">Match ID: {match.matchId}</p>
                        <p className="text-gray-400 text-sm">Status: {match.status}</p>
                        <p className="text-gray-400 text-sm">Participants: {match.participants}</p>
                      </div>
                      <button
                        onClick={() => joinMatch(match.matchId)}
                        className="btn btn-primary"
                      >
                        Join Match
                      </button>
                    </div>
                  </div>
                ))}
              </>
            )}

            <div className="card bg-blue-900/20 border-blue-500">
              <h3 className="text-lg font-semibold mb-2">Next Step</h3>
              <p className="text-gray-400 mb-4">After joining a match, create a delegation to start copy trading</p>
              <Link href="/delegation" className="btn btn-primary inline-block">
                Create Delegation →
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
