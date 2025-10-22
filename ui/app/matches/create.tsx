"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount, useWalletClient, usePublicClient } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import Link from "next/link";
import { type Hex, parseEther } from "viem";
import { getActiveDexes } from "@/lib/dex-registry";

export default function CreateMatchPage() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();

  const [entryMargin, setEntryMargin] = useState("0.01");
  const [entryFee, setEntryFee] = useState(0);
  const [duration, setDuration] = useState("2"); // hours
  const [maxMonachads, setMaxMonachads] = useState("5");
  const [maxSupporters, setMaxSupporters] = useState("20");
  const [selectedDexes, setSelectedDexes] = useState<string[]>([]);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (!entryMargin) return;
    setEntryFee(parseFloat(entryMargin) * 0.1);
  }, [entryMargin]);

  const activeDexes = getActiveDexes();

  const toggleDex = (dexAddress: string): void => {
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
      const entryFeeWei = parseEther(entryFee.toString());
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
              {
                internalType: "uint256",
                name: "_entryMargin",
                type: "uint256",
              },
              { internalType: "uint256", name: "_duration", type: "uint256" },
              {
                internalType: "uint256",
                name: "_maxMonachads",
                type: "uint256",
              },
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
        value: entryMarginWei + entryFeeWei,
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
    <main className="relative min-h-screen overflow-hidden bg-[#050214] text-white">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-40 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-purple-500/30 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-96 w-96 translate-x-1/3 translate-y-1/3 rounded-full bg-blue-500/20 blur-3xl" />
        <div
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              "radial-gradient(circle at 30% 20%, rgba(216, 180, 254, 0.12) 0%, transparent 55%), radial-gradient(circle at 70% 60%, rgba(56, 189, 248, 0.08) 0%, transparent 50%)",
          }}
        />
      </div>

      <div className="relative z-10 px-6 py-10 md:px-12 lg:px-16">
        <div className="mx-auto w-full max-w-5xl">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <Link
              href="/matches"
              className="group inline-flex items-center gap-2 rounded-full border border-purple-500/40 bg-black/40 px-5 py-2 text-sm font-medium text-purple-200 transition-all duration-200 hover:border-purple-400/80 hover:text-white hover:shadow-lg hover:shadow-purple-500/30"
            >
              <span className="text-lg transition-transform group-hover:-translate-x-1">
                ←
              </span>
              Back to The Arena
            </Link>
            <ConnectButton />
          </div>

          <section className="relative mt-10 rounded-3xl border border-purple-500/30 bg-black/40 p-[1px] shadow-[0_20px_60px_-25px_rgba(168,85,247,0.8)]">
            <div className="rounded-[calc(1.5rem-2px)] bg-gradient-to-b from-black/80 via-[#120627b8] to-black/60 p-10 md:p-12">
              <div className="mb-12 max-w-2xl">
                <p className="text-sm uppercase tracking-[0.4em] text-purple-300/60">
                  Monachad Forge
                </p>
                <h1 className="mt-4 text-4xl font-bold text-purple-100 md:text-5xl">
                  Bootstrap a TradeClub Showdown
                </h1>
                <p className="mt-4 text-base text-purple-200/70">
                  Configure the stakes, duration, and battlegrounds for your
                  next Monachad clash. Supporters will mirror every decisive
                  move you make across your approved DEX fronts.
                </p>
              </div>

              <div className="grid gap-8 md:grid-cols-2">
                <div className="space-y-8">
                  <div className="rounded-2xl border border-purple-500/20 bg-black/50 p-6 shadow-2xl transition-colors duration-200 hover:border-purple-400/30">
                    <label className="text-xs uppercase tracking-[0.35em] text-purple-300/70">
                      Entry Margin (MON)
                    </label>
                    <div className="mt-4 rounded-xl border border-purple-500/30 bg-black/70 px-4 py-3 focus-within:border-purple-400">
                      <input
                        type="number"
                        step="0.001"
                        min="0.001"
                        value={entryMargin}
                        onChange={(e) => setEntryMargin(e.target.value)}
                        className="w-full bg-transparent text-2xl font-semibold text-purple-100 outline-none placeholder:text-purple-200/40"
                        placeholder="0.01"
                      />
                    </div>
                    <p className="mt-3 text-sm text-purple-200/60">
                      Monachads stake this margin to enter. Supporter fee scales
                      automatically at 10%.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-purple-500/20 bg-black/50 p-6 shadow-2xl transition-colors duration-200 hover:border-purple-400/30">
                    <label className="text-xs uppercase tracking-[0.35em] text-purple-300/70">
                      Match Duration (Hours)
                    </label>
                    <div className="mt-4 rounded-xl border border-purple-500/30 bg-black/70 px-4 py-3 focus-within:border-purple-400">
                      <input
                        type="number"
                        step="1"
                        min="1"
                        max="24"
                        value={duration}
                        onChange={(e) => setDuration(e.target.value)}
                        className="w-full bg-transparent text-2xl font-semibold text-purple-100 outline-none"
                      />
                    </div>
                    <p className="mt-3 text-sm text-purple-200/60">
                      Total arena uptime before PnL seals the scoreboard.
                      Anywhere between 1 and 24 hours.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-purple-500/20 bg-black/50 p-6 shadow-2xl transition-colors duration-200 hover:border-purple-400/30">
                    <label className="text-xs uppercase tracking-[0.35em] text-purple-300/70">
                      Monachad Slots
                    </label>
                    <div className="mt-4 rounded-xl border border-purple-500/30 bg-black/70 px-4 py-3 focus-within:border-purple-400">
                      <input
                        type="number"
                        step="1"
                        min="2"
                        max="10"
                        value={maxMonachads}
                        onChange={(e) => setMaxMonachads(e.target.value)}
                        className="w-full bg-transparent text-2xl font-semibold text-purple-100 outline-none"
                      />
                    </div>
                    <p className="mt-3 text-sm text-purple-200/60">
                      Decide how many elite traders can duel in this bracket.
                      Minimum 2, maximum 10.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-purple-500/20 bg-black/50 p-6 shadow-2xl transition-colors duration-200 hover:border-purple-400/30">
                    <label className="text-xs uppercase tracking-[0.35em] text-purple-300/70">
                      Supporter Capacity per Monachad
                    </label>
                    <div className="mt-4 rounded-xl border border-purple-500/30 bg-black/70 px-4 py-3 focus-within:border-purple-400">
                      <input
                        type="number"
                        step="1"
                        min="1"
                        value={maxSupporters}
                        onChange={(e) => setMaxSupporters(e.target.value)}
                        className="w-full bg-transparent text-2xl font-semibold text-purple-100 outline-none"
                      />
                    </div>
                    <p className="mt-3 text-sm text-purple-200/60">
                      Set how many loyal supporters can shadow-trade each
                      Monachad.
                    </p>
                  </div>
                </div>

                <div className="flex flex-col gap-8">
                  <div className="rounded-2xl border border-blue-500/20 bg-black/50 p-6 shadow-2xl">
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="text-xs uppercase tracking-[0.35em] text-blue-200/70">
                          DEX Frontlines
                        </label>
                        <p className="mt-2 text-sm text-blue-100/70">
                          Arm your match with the venues you trust. Supporters
                          mirror only the checked battlegrounds.
                        </p>
                      </div>
                      <span className="rounded-full border border-blue-500/40 bg-blue-500/10 px-4 py-1 text-xs font-semibold text-blue-200">
                        {selectedDexes.length} selected
                      </span>
                    </div>

                    <div className="mt-6 grid gap-4 md:grid-cols-1">
                      {activeDexes.map((dex) => {
                        const isActive = selectedDexes.includes(dex.address);
                        return (
                          <button
                            key={dex.id}
                            type="button"
                            onClick={() => toggleDex(dex.address)}
                            className={`group relative overflow-hidden rounded-2xl border px-5 py-4 text-left transition-all duration-200 ${
                              isActive
                                ? "border-blue-400/70 bg-blue-500/15 shadow-[0_0_35px_rgba(56,189,248,0.25)]"
                                : "border-blue-400/20 bg-black/60 hover:border-blue-400/40 hover:bg-blue-500/5"
                            }`}
                          >
                            <div className="flex items-center gap-4">
                              <img
                                src={dex.icon}
                                alt={dex.name + " logo"}
                                className="h-10 w-10 rounded-xl bg-black/30 object-contain border border-blue-400/30"
                              />
                              <div>
                                <div className="flex items-center gap-3">
                                  <h3 className="text-lg font-semibold text-blue-100">
                                    {dex.name}
                                  </h3>
                                  {isActive && (
                                    <span className="rounded-full border border-blue-400/50 bg-blue-500/30 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.3em] text-blue-50">
                                      armed
                                    </span>
                                  )}
                                </div>
                                <p className="mt-1 text-xs text-blue-100/60">
                                  {dex.address.slice(0, 6)}...
                                  {dex.address.slice(-4)}
                                </p>
                              </div>
                            </div>
                            <p className="mt-3 text-sm text-blue-100/70">
                              {dex.description}
                            </p>
                          </button>
                        );
                      })}
                    </div>

                    <p className="mt-4 text-xs uppercase tracking-[0.35em] text-blue-200/70">
                      Supporters copy only the approved execution venues
                    </p>
                  </div>

                  <div className="rounded-2xl border border-purple-500/30 bg-black/50 p-6 shadow-2xl">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-sm uppercase tracking-[0.35em] text-purple-200/70">
                          Cost Breakdown
                        </h3>
                        <p className="mt-2 text-sm text-purple-200/70">
                          Preview the capital you deploy and the signal fee your
                          supporters shoulder.
                        </p>
                      </div>
                      <div className="rounded-xl border border-purple-500/40 bg-purple-500/10 px-3 py-2 text-right">
                        <p className="text-xs uppercase tracking-[0.4em] text-purple-200/70">
                          Total Stake
                        </p>
                        <p className="text-lg font-semibold text-purple-100">
                          {(parseFloat(entryMargin) + entryFee).toFixed(4)} MON
                        </p>
                      </div>
                    </div>

                    <div className="mt-6 space-y-4 text-sm">
                      <div className="flex items-center justify-between text-purple-100/80">
                        <span>Monachad entry margin</span>
                        <span className="font-semibold text-purple-50">
                          {entryMargin} MON
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-purple-100/80">
                        <span>Supporter fee (10%)</span>
                        <span className="font-semibold text-purple-50">
                          {(parseFloat(entryMargin) * 0.1).toFixed(4)} MON
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-purple-100/80">
                        <span>Match length</span>
                        <span className="font-semibold text-purple-50">
                          {duration} hours
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-purple-100/80">
                        <span>Live battlegrounds</span>
                        <span className="font-semibold text-purple-50">
                          {selectedDexes.length}
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={createMatch}
                    disabled={
                      isCreating ||
                      !isConnected ||
                      selectedDexes.length === 0 ||
                      parseFloat(entryMargin) <= 0
                    }
                    className="group relative mt-auto flex items-center justify-center gap-3 overflow-hidden rounded-2xl border border-purple-500/50 bg-gradient-to-r from-purple-600 via-fuchsia-600 to-blue-600 px-8 py-4 text-lg font-semibold text-white shadow-[0_0_45px_rgba(129,140,248,0.35)] transition-transform duration-200 hover:scale-[1.015] disabled:cursor-not-allowed disabled:border-purple-500/30 disabled:from-purple-700/40 disabled:via-fuchsia-700/40 disabled:to-blue-700/40 disabled:opacity-60"
                  >
                    {isCreating
                      ? "Forging match on-chain..."
                      : `Ignite Arena • Stake ${(
                          parseFloat(entryMargin) + entryFee
                        ).toFixed(4)} MON`}
                    {!isCreating && (
                      <span className="text-sm uppercase tracking-[0.4em] text-purple-100/80">
                        →
                      </span>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
