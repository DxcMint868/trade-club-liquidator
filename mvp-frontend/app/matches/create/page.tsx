"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount, useWalletClient, usePublicClient } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import Link from "next/link";
import { type Hex, parseEther, formatEther } from "viem";
import { getActiveDexes, type DexInfo } from "@/lib/dex-registry";

export default function CreateMatchPage() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();

  const [entryMargin, setEntryMargin] = useState("0.01");
  const [duration, setDuration] = useState("2"); // hours
  const [maxMonachads, setMaxMonachads] = useState("5");
  const [maxSupporters, setMaxSupporters] = useState("20");
  const [selectedDexes, setSelectedDexes] = useState<string[]>([]);
  const [isCreating, setIsCreating] = useState(false);

  const activeDexes = getActiveDexes();

  const toggleDex = (dexAddress: string) => {
    setSelectedDexes((prev) =>
      prev.includes(dexAddress)
        ? prev.filter((addr) => addr !== dexAddress)
        : [...prev, dexAddress]
    );
  };

  const createMatch = async () => {
    if (!address || !isConnected || !walletClient || !publicClient) {
      alert("Please connect your wallet");
      return;
    }

    if (selectedDexes.length === 0) {
      alert("Please select at least one DEX");
      return;
    }

    setIsCreating(true);

    try {
      const matchManagerAddress = process.env
        .NEXT_PUBLIC_MATCH_MANAGER_ADDRESS as Hex;

      if (!matchManagerAddress) {
        throw new Error("NEXT_PUBLIC_MATCH_MANAGER_ADDRESS not configured");
      }

      const entryMarginWei = parseEther(entryMargin);
      const durationSeconds = BigInt(parseInt(duration) * 3600);
      const maxMonachadsNum = BigInt(maxMonachads);
      const maxSupportersNum = BigInt(maxSupporters);

      console.log("Creating match...");
      console.log("Entry Margin:", entryMargin, "ETH");
      console.log("Duration:", duration, "hours");
      console.log("Max Monachads:", maxMonachads);
      console.log("Max Supporters per Monachad:", maxSupporters);
      console.log("Selected DEXes:", selectedDexes);

      const hash = await walletClient.writeContract({
        address: matchManagerAddress,
        abi: [
          {
            inputs: [
              { internalType: "uint256", name: "_entryMargin", type: "uint256" },
              { internalType: "uint256", name: "_duration", type: "uint256" },
              { internalType: "uint256", name: "_maxMonachads", type: "uint256" },
              {
                internalType: "uint256",
                name: "_maxSupportersPerMonachad",
                type: "uint256",
              },
              {
                internalType: "address[]",
                name: "_allowedDexes",
                type: "address[]",
              },
            ],
            name: "createMatch",
            outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
            stateMutability: "payable",
            type: "function",
          },
        ],
        functionName: "createMatch",
        args: [
          entryMarginWei,
          durationSeconds,
          maxMonachadsNum,
          maxSupportersNum,
          selectedDexes as Hex[],
        ],
        value: entryMarginWei,
      });

      console.log("Transaction sent:", hash);
      console.log("Waiting for confirmation...");

      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      console.log("Transaction confirmed in block:", receipt.blockNumber);

      alert("Match created successfully!");
      router.push("/matches");
    } catch (err: any) {
      console.error("Failed to create match:", err);

      if (err.message?.includes("User rejected") || err.code === 4001) {
        alert("Transaction cancelled");
      } else if (err.message?.includes("insufficient funds")) {
        alert("Insufficient funds");
      } else {
        alert(`Failed: ${err.message || "Unknown error"}`);
      }
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <Link href="/matches" className="text-blue-500 hover:text-blue-400">
            ← Back to Matches
          </Link>
          <ConnectButton />
        </div>

        <div className="card">
          <h1 className="text-4xl font-bold mb-2">Create New Match</h1>
          <p className="text-gray-400 mb-8">
            Set up a competitive trading match for Monachads and their supporters
          </p>

          <div className="space-y-6">
            {/* Entry Margin */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Entry Margin (ETH)
              </label>
              <input
                type="number"
                step="0.001"
                min="0.001"
                value={entryMargin}
                onChange={(e) => setEntryMargin(e.target.value)}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500 text-white"
              />
              <p className="text-xs text-gray-500 mt-1">
                Minimum ETH required for Monachads to join
              </p>
            </div>

            {/* Duration */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Duration (hours)
              </label>
              <input
                type="number"
                step="1"
                min="1"
                max="24"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500 text-white"
              />
              <p className="text-xs text-gray-500 mt-1">
                Match duration (1-24 hours)
              </p>
            </div>

            {/* Max Monachads */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Max Monachads
              </label>
              <input
                type="number"
                step="1"
                min="2"
                max="10"
                value={maxMonachads}
                onChange={(e) => setMaxMonachads(e.target.value)}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500 text-white"
              />
              <p className="text-xs text-gray-500 mt-1">
                Maximum competing traders (2-10)
              </p>
            </div>

            {/* Max Supporters per Monachad */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Max Supporters per Monachad
              </label>
              <input
                type="number"
                step="1"
                min="1"
                value={maxSupporters}
                onChange={(e) => setMaxSupporters(e.target.value)}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500 text-white"
              />
              <p className="text-xs text-gray-500 mt-1">
                How many supporters each Monachad can have
              </p>
            </div>

            {/* DEX Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-3">
                Select DEXes to Monitor
              </label>
              <div className="grid md:grid-cols-2 gap-4">
                {activeDexes.map((dex) => (
                  <button
                    key={dex.id}
                    onClick={() => toggleDex(dex.address)}
                    className={`p-4 rounded-lg border-2 transition-all text-left ${
                      selectedDexes.includes(dex.address)
                        ? "border-blue-500 bg-blue-500/10"
                        : "border-gray-700 hover:border-gray-600"
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-3xl">{dex.icon}</span>
                      <div>
                        <h3 className="font-bold">{dex.name}</h3>
                        <p className="text-xs text-gray-500">
                          {dex.address.slice(0, 6)}...{dex.address.slice(-4)}
                        </p>
                      </div>
                    </div>
                    <p className="text-sm text-gray-400">{dex.description}</p>
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Trades on selected DEXes will be monitored and copied for
                supporters
              </p>
            </div>

            {/* Cost Breakdown */}
            <div className="bg-gray-800/50 p-4 rounded-lg">
              <h3 className="font-semibold mb-3">Cost Summary</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Entry Margin (you pay):</span>
                  <span className="font-semibold">{entryMargin} ETH</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Supporter Entry Fee:</span>
                  <span className="font-semibold">
                    {(parseFloat(entryMargin) * 0.1).toFixed(4)} ETH (10%)
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Duration:</span>
                  <span className="font-semibold">{duration} hours</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Selected DEXes:</span>
                  <span className="font-semibold">{selectedDexes.length}</span>
                </div>
              </div>
            </div>

            {/* Create Button */}
            <button
              onClick={createMatch}
              disabled={
                isCreating ||
                !isConnected ||
                selectedDexes.length === 0 ||
                parseFloat(entryMargin) <= 0
              }
              className="btn btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCreating
                ? "Creating Match..."
                : `Create Match & Stake ${entryMargin} ETH`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
