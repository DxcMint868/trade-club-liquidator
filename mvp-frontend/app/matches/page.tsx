"use client";

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import Link from "next/link";

export default function MatchesPage() {
  const { address, isConnected } = useAccount();
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMatches();
  }, []);

  const fetchMatches = async () => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/matches`
      );
      const data = await response.json();
      setMatches(data);
    } catch (err) {
      console.error("Failed to fetch matches:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <Link href="/" className="text-blue-500 hover:text-blue-400">
            ← Back
          </Link>
          <div className="flex gap-4 items-center">
            <Link
              href="/matches/create"
              className="btn bg-green-600 hover:bg-green-700"
            >
              Create Match
            </Link>
            <ConnectButton />
          </div>
        </div>

        <h1 className="text-4xl font-bold mb-8">Active Matches</h1>

        {!isConnected ? (
          <div className="card">
            <p className="text-gray-400 mb-4">
              Connect wallet to explore matches
            </p>
            <ConnectButton />
          </div>
        ) : (
          <div className="space-y-6">
            {loading ? (
              <div className="card">Loading matches...</div>
            ) : matches.length === 0 ? (
              <div className="card">
                <p className="text-gray-400">
                  No matches available. Check back soon!
                </p>
              </div>
            ) : (
              <>
                {matches.map((match) => (
                  <Link
                    key={match.matchId}
                    href={`/matches/${match.matchId}`}
                    className="block"
                  >
                    <div className="card hover:border-blue-500 transition-colors cursor-pointer">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-3">
                            <h3 className="text-2xl font-bold">
                              Match #{match.matchId}
                            </h3>
                            <span
                              className={`text-xs px-3 py-1 rounded-full font-semibold ${
                                match.status === "ACTIVE"
                                  ? "bg-green-600"
                                  : match.status === "CREATED"
                                  ? "bg-blue-600"
                                  : "bg-gray-600"
                              }`}
                            >
                              {match.status}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-4 mb-3">
                            <div>
                              <p className="text-xs text-gray-500">
                                Entry Fee (Monachads)
                              </p>
                              <p className="text-lg font-semibold text-blue-400">
                                {(
                                  BigInt(match.entryMargin) / BigInt(10 ** 18)
                                ).toString()}{" "}
                                ETH
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500">
                                Prize Pool
                              </p>
                              <p className="text-lg font-semibold text-green-400">
                                {(
                                  BigInt(match.prizePool) / BigInt(10 ** 18)
                                ).toString()}{" "}
                                ETH
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500">
                                Competing Traders
                              </p>
                              <p className="text-md">
                                {match.participants?.length || 0} /{" "}
                                {match.maxParticipants} Monachads
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500">Duration</p>
                              <p className="text-md">
                                {Math.floor(match.duration / 3600)} hours
                              </p>
                            </div>
                          </div>

                          {match.startTime && (
                            <p className="text-xs text-gray-400">
                              🕐 Started:{" "}
                              {new Date(match.startTime).toLocaleString()}
                            </p>
                          )}
                        </div>

                        <div className="ml-6 text-right">
                          <div className="text-blue-400 font-semibold mb-2">
                            View Details →
                          </div>
                          <p className="text-xs text-gray-500">
                            Choose your role:
                          </p>
                          <p className="text-xs text-gray-400">
                            • Compete as Monachad
                          </p>
                          <p className="text-xs text-gray-400">
                            • Follow a Monachad
                          </p>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </>
            )}

            <div className="card bg-gradient-to-br from-blue-900/30 to-purple-900/30 border-blue-500">
              <h3 className="text-xl font-bold mb-4">💡 How TradeClub Works</h3>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold text-blue-400 mb-2">
                    For Skilled Traders (Monachads)
                  </h4>
                  <ul className="text-gray-300 space-y-2 text-sm">
                    <li>• Compete against other traders</li>
                    <li>• Attract supporters to follow you</li>
                    <li>• Win prizes based on highest PnL</li>
                    <li>• Build your reputation</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold text-purple-400 mb-2">
                    👥 For Copy Traders (Supporters)
                  </h4>
                  <ul className="text-gray-300 space-y-2 text-sm">
                    <li>• Browse matches and see competing Monachads</li>
                    <li>• Choose a Monachad to follow</li>
                    <li>• Your smart account copies their trades</li>
                    <li>• Secure delegations with spending limits</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
