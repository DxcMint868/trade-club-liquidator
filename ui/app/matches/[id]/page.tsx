"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import Link from "next/link";
import {
  toMetaMaskSmartAccount,
  Implementation,
  createDelegation,
} from "@metamask/delegation-toolkit";
import { type Hex, formatEther } from "viem";
import { format } from "path";

interface Monachad {
  address: string;
  stakedAmount: string;
  pnl: string;
  roi: string;
  joinedAt: string;
}

interface Match {
  matchId: string;
  creator: string;
  entryMargin: string;
  duration: number;
  maxParticipants: number;
  prizePool: string;
  status: string;
  startTime?: string;
  endTime?: string;
}

export default function MatchDetailPage() {
  const params = useParams();
  const router = useRouter();
  const matchId = params.id as string;

  const { address, isConnected, chain } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  const [match, setMatch] = useState<Match | null>(null);
  const [monachads, setMonachads] = useState<Monachad[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonachad, setSelectedMonachad] = useState<string | null>(null);
  const [isJoining, setIsJoining] = useState(false);
  const [joinMode, setJoinMode] = useState<"monachad" | "supporter" | null>(
    null
  );
  const [customMargin, setCustomMargin] = useState<string>("");
  const [entryFee, setEntryFee] = useState<string>("0");

  useEffect(() => {
    if (matchId) {
      fetchMatchDetails();
      fetchEntryFee();
    }
  }, [matchId]);

  const fetchEntryFee = async () => {
    if (!publicClient) return;

    try {
      const matchManagerAddress = process.env
        .NEXT_PUBLIC_MATCH_MANAGER_ADDRESS as Hex;

      if (!matchManagerAddress) return;

      const fee = await publicClient.readContract({
        address: matchManagerAddress,
        abi: [
          {
            inputs: [
              { internalType: "uint256", name: "_matchId", type: "uint256" },
            ],
            name: "getEntryFee",
            outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
            stateMutability: "view",
            type: "function",
          },
        ],
        functionName: "getEntryFee",
        args: [BigInt(matchId)],
      });
      console.log("Fetched entry fee:", formatEther(fee), "ETH");

      setEntryFee(formatEther(fee));
    } catch (err) {
      console.error("Failed to fetch entry fee:", err);
    }
  };

  const fetchMatchDetails = async () => {
    try {
      setLoading(true);

      // Fetch match details
      const matchRes = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/matches/${matchId}`
      );
      const matchData = await matchRes.json();
      setMatch(matchData);

      // Fetch Monachads in this match
      const monachadsRes = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/matches/${matchId}/monachads`
      );
      const monachadsData = await monachadsRes.json();
      setMonachads(monachadsData.monachads || []);
    } catch (err) {
      console.error("Failed to fetch match details:", err);
      alert("Failed to load match details");
    } finally {
      setLoading(false);
    }
  };

  const joinAsMonachad = async () => {
    if (!address || !isConnected || !walletClient || !publicClient) {
      alert("Please connect your wallet");
      return;
    }

    if (!match) {
      alert("Match data not loaded");
      return;
    }

    // Use custom margin or default to match entry margin
    const marginToUse = customMargin
      ? BigInt(parseFloat(customMargin) * 10 ** 18)
      : BigInt(match.entryMargin);

    // Validate minimum margin
    if (marginToUse < BigInt(match.entryMargin)) {
      alert(`Minimum margin is ${formatEther(BigInt(match.entryMargin))} ETH`);
      return;
    }

    setIsJoining(true);

    try {
      console.log("Joining match as Monachad...");
      console.log("Match ID:", matchId);
      console.log("Margin to stake:", marginToUse.toString(), "wei");

      // Step 1: Call smart contract to join as Monachad
      const matchManagerAddress = process.env
        .NEXT_PUBLIC_MATCH_MANAGER_ADDRESS as Hex;

      if (!matchManagerAddress) {
        throw new Error("NEXT_PUBLIC_MATCH_MANAGER_ADDRESS not configured");
      }

      console.log("Sending transaction to smart contract...");
      console.log("Contract:", matchManagerAddress);
      console.log("Function: joinAsMonachad");
      console.log("Value:", marginToUse.toString(), "wei");

      // Call joinAsMonachad on smart contract
      const hash = await walletClient.writeContract({
        address: matchManagerAddress,
        abi: [
          {
            inputs: [
              { internalType: "uint256", name: "_matchId", type: "uint256" },
            ],
            name: "joinAsMonachad",
            outputs: [],
            stateMutability: "payable",
            type: "function",
          },
        ],
        functionName: "joinAsMonachad",
        args: [BigInt(matchId)],
        value: marginToUse,
      });

      console.log("Transaction sent:", hash);
      console.log("Waiting for confirmation...");

      // Wait for transaction confirmation
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      console.log("Transaction confirmed in block:", receipt.blockNumber);

      // Step 2: Update backend with transaction details
      console.log("Updating backend...");
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/matches/${matchId}/join-as-monachad`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            address: address.toLowerCase(),
            smartAccountAddress: address.toLowerCase(), // Monachads use their EOA
            transactionHash: hash,
            blockNumber: Number(receipt.blockNumber),
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        console.warn("Backend update failed:", errorData.message);
        // Don't throw - blockchain tx succeeded, backend sync can happen later
      } else {
        const result = await response.json();
        console.log("Backend updated:", result);
      }

      alert("🎉 Successfully joined as a competing Monachad!");
      fetchMatchDetails();
      setJoinMode(null);
      setCustomMargin("");
    } catch (err: any) {
      console.error("❌ Failed to join as Monachad:", err);

      // Check if user rejected the transaction
      if (err.message?.includes("User rejected") || err.code === 4001) {
        alert("Transaction cancelled");
      } else if (err.message?.includes("insufficient funds")) {
        alert("Insufficient funds to pay entry fee and gas");
      } else {
        alert(`Failed: ${err.message || "Unknown error"}`);
      }
    } finally {
      setIsJoining(false);
    }
  };

  const followMonachad = async (monachadAddress: string) => {
    if (!address || !walletClient || !publicClient || !chain) {
      alert("Please connect your wallet");
      return;
    }

    const smartAccountAddr = localStorage.getItem(`smartAccount_${address}`);
    if (!smartAccountAddr) {
      alert("Please onboard first to create a smart account");
      router.push("/onboarding");
      return;
    }

    if (!customMargin || parseFloat(customMargin) <= 0) {
      alert("Please enter the amount you want to fund your smart account");
      return;
    }

    const fundingAmount = BigInt(parseFloat(customMargin) * 10 ** 18);
    const entryFeeAmount = BigInt(parseFloat(entryFee) * 10 ** 18);
    const totalAmount = entryFeeAmount + fundingAmount;

    setIsJoining(true);
    setSelectedMonachad(monachadAddress);

    try {
      console.log("Creating delegation to follow Monachad:", monachadAddress);

      // Load smart account
      const smartAccount = await toMetaMaskSmartAccount({
        client: publicClient,
        implementation: Implementation.Hybrid,
        address: smartAccountAddr as Hex,
        signer: { walletClient },
      });

      console.log("Smart account loaded:", smartAccount.address);

      // Create delegation
      const backendAddress = process.env.NEXT_PUBLIC_BACKEND_ADDRESS;

      if (!backendAddress) {
        throw new Error(
          "NEXT_PUBLIC_BACKEND_ADDRESS not configured in environment variables"
        );
      }

      if (!backendAddress.startsWith("0x") || backendAddress.length !== 42) {
        throw new Error(`Invalid backend address format: ${backendAddress}`);
      }

      const delegation = createDelegation({
        environment: smartAccount.environment,
        from: smartAccount.address,
        to: backendAddress as Hex,
        scope: {
          type: "nativeTokenTransferAmount",
          maxAmount: fundingAmount,
        },
        caveats: [],
      });

      console.log("Delegation created, signing...");

      const signature = await smartAccount.signDelegation({
        delegation,
        chainId: chain.id,
      });

      const signedDelegation = {
        ...delegation,
        signature,
      };

      console.log("Delegation signed");

      // Call smart contract to follow and fund account
      const matchManagerAddress = process.env
        .NEXT_PUBLIC_MATCH_MANAGER_ADDRESS as Hex;

      if (!matchManagerAddress) {
        throw new Error("NEXT_PUBLIC_MATCH_MANAGER_ADDRESS not configured");
      }

      console.log("Sending transaction to smart contract...");
      console.log("Total amount:", totalAmount.toString(), "wei");
      console.log("Entry fee:", entryFeeAmount.toString(), "wei");
      console.log("Funding amount:", fundingAmount.toString(), "wei");

      const hash = await walletClient.writeContract({
        address: matchManagerAddress,
        abi: [
          {
            inputs: [
              { internalType: "uint256", name: "_matchId", type: "uint256" },
              { internalType: "address", name: "_monachad", type: "address" },
              {
                internalType: "address payable",
                name: "_smartAccountAddress",
                type: "address",
              },
            ],
            name: "followMonachadAndFundAccount",
            outputs: [],
            stateMutability: "payable",
            type: "function",
          },
        ],
        functionName: "followMonachadAndFundAccount",
        args: [
          BigInt(matchId),
          monachadAddress as Hex,
          smartAccountAddr as Hex,
        ],
        value: totalAmount,
      });

      console.log("Transaction sent:", hash);
      console.log("Waiting for confirmation...");

      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      console.log("Transaction confirmed in block:", receipt.blockNumber);

      // Send to backend
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/matches/${matchId}/follow-monachad`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            supporterAddress: address.toLowerCase(),
            monachadAddress: monachadAddress.toLowerCase(),
            smartAccountAddress: smartAccountAddr.toLowerCase(),
            signedDelegation,
            stakedAmount: fundingAmount.toString(),
            transactionHash: hash,
            blockNumber: Number(receipt.blockNumber),
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        console.warn("Backend update failed:", errorData.message);
      } else {
        const result = await response.json();
        console.log("Backend updated:", result);
      }

      alert(
        `Successfully following Monachad ${monachadAddress.slice(
          0,
          8
        )}... with ${customMargin} ETH!`
      );
      fetchMatchDetails();
      setJoinMode(null);
      setSelectedMonachad(null);
      setCustomMargin("");
    } catch (err: any) {
      console.error("Failed to follow Monachad:", err);

      if (err.message?.includes("User rejected") || err.code === 4001) {
        alert("Transaction cancelled");
      } else if (err.message?.includes("insufficient funds")) {
        alert("Insufficient funds to pay entry fee, funding amount, and gas");
      } else {
        alert(`Failed: ${err.message || "Unknown error"}`);
      }
    } finally {
      setIsJoining(false);
      setSelectedMonachad(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen p-8">
        <div className="max-w-6xl mx-auto">
          <div className="card">Loading match details...</div>
        </div>
      </div>
    );
  }

  if (!match) {
    return (
      <div className="min-h-screen p-8">
        <div className="max-w-6xl mx-auto">
          <div className="card">
            <p className="text-gray-400">Match not found</p>
            <Link href="/matches" className="text-blue-500 mt-4 inline-block">
              ← Back to Matches
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <Link href="/matches" className="text-blue-500 hover:text-blue-400">
            ← Back to Matches
          </Link>
          <ConnectButton />
        </div>

        {/* Match Info */}
        <div className="card mb-6">
          <div className="flex items-center gap-4 mb-4">
            <h1 className="text-4xl font-bold">Match #{matchId}</h1>
            <span
              className={`px-4 py-2 rounded-full font-semibold ${
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

          <div className="grid md:grid-cols-4 gap-6 mb-6">
            <div>
              <p className="text-sm text-gray-500 mb-1">Entry Fee</p>
              <p className="text-2xl font-bold text-blue-400">
                {formatEther(BigInt(match.entryMargin))} ETH
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500 mb-1">Prize Pool</p>
              <p className="text-2xl font-bold text-green-400">
                {formatEther(BigInt(match.prizePool))} ETH
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500 mb-1">Duration</p>
              <p className="text-2xl font-bold">
                {Math.floor(match.duration / 3600)}h
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500 mb-1">Monachads</p>
              <p className="text-2xl font-bold">
                {monachads.length} / {match.maxParticipants}
              </p>
            </div>
          </div>

          {match.startTime && (
            <p className="text-sm text-gray-400">
              🕐 Started: {new Date(match.startTime).toLocaleString()}
            </p>
          )}
        </div>

        {/* Join Mode Selection */}
        {!joinMode && isConnected && (
          <div className="grid md:grid-cols-2 gap-6 mb-8">
            <button
              onClick={() => setJoinMode("monachad")}
              className="card hover:border-blue-500 transition-all text-left p-8"
            >
              <div className="text-4xl mb-4">🎯</div>
              <h3 className="text-2xl font-bold mb-2">Join as Monachad</h3>
              <p className="text-gray-400 mb-4">
                Compete as a skilled trader. Your trades will be visible to
                supporters.
              </p>
              <ul className="text-sm text-gray-500 space-y-1">
                <li>
                  • Stake{" "}
                  {(BigInt(match.entryMargin) / BigInt(10 ** 18)).toString()}{" "}
                  ETH
                </li>
                <li>• Compete for prize pool</li>
                <li>• Attract supporters</li>
              </ul>
              <div className="mt-4 text-blue-400 font-semibold">Continue →</div>
            </button>

            <button
              onClick={() => setJoinMode("supporter")}
              className="card hover:border-purple-500 transition-all text-left p-8"
              disabled={monachads.length === 0}
            >
              <div className="text-4xl mb-4">👥</div>
              <h3 className="text-2xl font-bold mb-2">Follow a Monachad</h3>
              <p className="text-gray-400 mb-4">
                Copy a skilled trader's moves. Your smart account mirrors their
                trades.
              </p>
              <ul className="text-sm text-gray-500 space-y-1">
                <li>• Pay {entryFee} ETH entry fee (10%)</li>
                <li>• Fund your smart account</li>
                <li>• Secure delegations</li>
              </ul>
              {monachads.length === 0 ? (
                <div className="mt-4 text-gray-500 font-semibold">
                  No Monachads yet
                </div>
              ) : (
                <div className="mt-4 text-purple-400 font-semibold">
                  Choose Monachad →
                </div>
              )}
            </button>
          </div>
        )}

        {/* Join as Monachad Flow */}
        {joinMode === "monachad" && (
          <div className="card mb-8">
            <h3 className="text-2xl font-bold mb-4">
              Join as Competing Monachad
            </h3>
            <p className="text-gray-400 mb-6">
              Stake ETH to enter the competition. The minimum is{" "}
              {formatEther(BigInt(match.entryMargin))} ETH, but you can stake
              more to show confidence!
            </p>

            {/* Margin Input */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Amount to Stake (ETH)
              </label>
              <input
                type="number"
                step="0.001"
                min={formatEther(BigInt(match.entryMargin))}
                placeholder={`Minimum: ${formatEther(
                  BigInt(match.entryMargin)
                )} ETH`}
                value={customMargin}
                onChange={(e) => setCustomMargin(e.target.value)}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500 text-white"
              />
              <p className="text-xs text-gray-500 mt-2">
                💡 Higher stakes show your confidence and increase the prize
                pool
              </p>
            </div>

            <div className="flex gap-4">
              <button
                onClick={joinAsMonachad}
                disabled={
                  isJoining ||
                  !customMargin ||
                  parseFloat(customMargin) <
                    parseFloat(formatEther(BigInt(match.entryMargin)))
                }
                className="btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isJoining
                  ? "Joining..."
                  : `Stake ${customMargin || "?"} ETH & Join`}
              </button>
              <button
                onClick={() => {
                  setJoinMode(null);
                  setCustomMargin("");
                }}
                className="btn bg-gray-700 hover:bg-gray-600"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Follow Monachad Flow */}
        {joinMode === "supporter" && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-2xl font-bold">
                Choose a Monachad to Follow
              </h3>
              <button
                onClick={() => {
                  setJoinMode(null);
                  setCustomMargin("");
                }}
                className="text-gray-400 hover:text-white"
              >
                Cancel
              </button>
            </div>

            {/* Cost Breakdown */}
            <div className="card mb-6">
              <h4 className="text-lg font-semibold mb-4">Cost Breakdown</h4>
              <div className="space-y-3 mb-4">
                <div className="flex justify-between">
                  <span className="text-gray-400">
                    Entry Fee (10% of Monachad entry):
                  </span>
                  <span className="font-semibold">{entryFee} ETH</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Smart Account Funding:</span>
                  <input
                    type="number"
                    step="0.001"
                    min="0.001"
                    placeholder="e.g., 0.1"
                    value={customMargin}
                    onChange={(e) => setCustomMargin(e.target.value)}
                    className="w-32 px-3 py-1 bg-gray-800 border border-gray-700 rounded focus:outline-none focus:border-purple-500 text-white text-right"
                  />
                </div>
                <div className="border-t border-gray-700 pt-3 flex justify-between text-lg font-bold">
                  <span>Total:</span>
                  <span className="text-purple-400">
                    {customMargin
                      ? (
                          parseFloat(entryFee) + parseFloat(customMargin)
                        ).toFixed(4)
                      : entryFee}{" "}
                    ETH
                  </span>
                </div>
              </div>
              <p className="text-xs text-gray-500">
                Entry fee goes to prize pool. Funding amount goes to your smart
                account for copy trading.
              </p>
            </div>

            {monachads.length === 0 ? (
              <div className="card">
                <p className="text-gray-400">
                  No Monachads competing yet. Be the first to join!
                </p>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-6">
                {monachads.map((monachad) => (
                  <div
                    key={monachad.address}
                    className="card hover:border-purple-500 transition-all"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <p className="text-sm text-gray-500">Monachad</p>
                        <p className="font-mono text-lg font-bold">
                          {monachad.address.slice(0, 6)}...
                          {monachad.address.slice(-4)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-500">ROI</p>
                        <p
                          className={`text-2xl font-bold ${
                            parseFloat(monachad.roi) >= 0
                              ? "text-green-400"
                              : "text-red-400"
                          }`}
                        >
                          {monachad.roi}%
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                      <div>
                        <p className="text-gray-500">Staked</p>
                        <p>
                          {(
                            BigInt(monachad.stakedAmount) / BigInt(10 ** 18)
                          ).toString()}{" "}
                          ETH
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500">PnL</p>
                        <p
                          className={
                            BigInt(monachad.pnl) >= BigInt(0)
                              ? "text-green-400"
                              : "text-red-400"
                          }
                        >
                          {(BigInt(monachad.pnl) / BigInt(10 ** 18)).toString()}{" "}
                          ETH
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => followMonachad(monachad.address)}
                      disabled={
                        (isJoining && selectedMonachad === monachad.address) ||
                        !customMargin ||
                        parseFloat(customMargin) <= 0
                      }
                      className="btn btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isJoining && selectedMonachad === monachad.address
                        ? "Following..."
                        : "Follow This Monachad"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Monachads Leaderboard */}
        {!joinMode && monachads.length > 0 && (
          <div className="card">
            <h3 className="text-2xl font-bold mb-4">Competing Monachads</h3>
            <div className="space-y-4">
              {monachads.map((monachad, index) => (
                <div
                  key={monachad.address}
                  className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg"
                >
                  <div className="flex items-center gap-4">
                    <div className="text-2xl font-bold text-gray-500">
                      #{index + 1}
                    </div>
                    <div>
                      <p className="font-mono font-semibold">
                        {monachad.address.slice(0, 8)}...
                        {monachad.address.slice(-6)}
                      </p>
                      <p className="text-sm text-gray-500">
                        Joined{" "}
                        {new Date(monachad.joinedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-8">
                    <div className="text-right">
                      <p className="text-sm text-gray-500">PnL</p>
                      <p
                        className={`font-bold ${
                          BigInt(monachad.pnl) >= BigInt(0)
                            ? "text-green-400"
                            : "text-red-400"
                        }`}
                      >
                        {(BigInt(monachad.pnl) / BigInt(10 ** 18)).toString()}{" "}
                        ETH
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-500">ROI</p>
                      <p
                        className={`text-xl font-bold ${
                          parseFloat(monachad.roi) >= 0
                            ? "text-green-400"
                            : "text-red-400"
                        }`}
                      >
                        {monachad.roi}%
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
