"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import {
  Implementation,
  createDelegation,
  toMetaMaskSmartAccount,
} from "@metamask/delegation-toolkit";
import { formatEther, parseEther, type Hex } from "viem";

import TradingPanel from "@/components/match/TradingPanel";

type ParticipantRole = "MONACHAD" | "SUPPORTER";

interface Participant {
  address: string;
  role: ParticipantRole;
  marginAmount?: string;
  entryFeePaid?: string;
  fundedAmount?: string;
  stakedAmount?: string; // legacy fallback
  pnl?: string;
  joinedAt?: string;
  followingAddress?: string | null;
}

interface MatchRecord {
  matchId: string;
  status: string;
  entryMargin: string;
  prizePool: string;
  duration: number;
  maxParticipants: number;
  maxSupporters?: number | null;
  allowedDexes?: string[];
  creator?: string;
  startTime?: string;
  endTime?: string;
  winner?: string | null;
  // participants?: Participant[];
  topMonachads: Participant[];
  monachadCount: number;
  topSupporters: Participant[];
  supporterCount: number;
  participantCount: number;
}

const mockChartData = Array.from({ length: 12 }).map((_, index) => ({
  label: `Round ${index + 1}`,
  value: Math.round(50 + Math.random() * 50),
}));

const fallbackLeaderboard = [
  { address: "0xAlpha...1234", pnl: "+12.4%", pnlValue: 1240 },
  { address: "0xBravo...5678", pnl: "+8.9%", pnlValue: 890 },
  { address: "0xDelta...9abc", pnl: "+4.1%", pnlValue: 410 },
];

const safeFormatEther = (value?: string | bigint | number | null) => {
  try {
    if (value === null || value === undefined) {
      return "0";
    }

    if (typeof value === "bigint") {
      return formatEther(value);
    }

    if (typeof value === "number") {
      return formatEther(BigInt(Math.trunc(value)));
    }

    const normalized = value.toString();
    if (!normalized.length) {
      return "0";
    }

    return formatEther(BigInt(normalized));
  } catch (error) {
    console.warn("Failed to format wei to ether", error);
    return "0";
  }
};

const calculateRoi = (pnl?: string, basis?: string) => {
  try {
    const pnlEth = Number(safeFormatEther(pnl ?? "0"));
    const basisEth = Number(safeFormatEther(basis ?? "0"));
    if (!Number.isFinite(basisEth) || basisEth === 0) {
      return "0.0";
    }

    const roi = (pnlEth / basisEth) * 100;
    return roi.toFixed(1);
  } catch {
    return "0.0";
  }
};

const getParticipantStakeWei = (participant?: Participant | null) => {
  if (participant?.role === "MONACHAD") {
    return participant?.marginAmount ?? "0";
  }
  return participant?.fundedAmount ?? "0";
};

export default function MatchDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const matchId = params?.id ?? "";

  const { address, isConnected, chain } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  const [match, setMatch] = useState<MatchRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isStartingMatch, setIsStartingMatch] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [joinMode, setJoinMode] = useState<"monachad" | "supporter" | null>(
    null
  );
  const [customMargin, setCustomMargin] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  const [selectedMonachad, setSelectedMonachad] = useState<string | null>(null);
  const [userParticipant, setUserParticipant] = useState<Participant | null>(
    null
  );

  const fetchMatchDetails = useCallback(async () => {
    if (!matchId) {
      return;
    }

    const baseUrl = process.env.NEXT_PUBLIC_API_URL;
    if (!baseUrl) {
      setLoadError("NEXT_PUBLIC_API_URL is not configured");
      setLoading(false);
      return;
    }

    try {
      setLoadError(null);
      if (!loading) {
        setIsRefreshing(true);
      }

      const response = await fetch(`${baseUrl}/matches/${matchId}`);
      if (!response.ok) {
        throw new Error(`Failed to load match ${matchId}`);
      }

      const data: MatchRecord = await response.json();
      setMatch(data);
    } catch (error: any) {
      console.error("Failed to fetch match", error);
      setLoadError(error?.message ?? "Unable to load match");
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [matchId, loading]);

  useEffect(() => {
    fetchMatchDetails();
  }, [fetchMatchDetails]);

  useEffect(() => {
    if (match?.status !== "ACTIVE") {
      return;
    }

    const interval = setInterval(fetchMatchDetails, 15000);
    return () => clearInterval(interval);
  }, [match?.status, fetchMatchDetails]);

  useEffect(() => {
    if (joinMode !== "monachad" || !match?.entryMargin) {
      return;
    }

    if (!customMargin) {
      setCustomMargin(safeFormatEther(match.entryMargin));
    }
  }, [joinMode, match?.entryMargin, customMargin]);

  const supporterFollowingAddress = useMemo(() => {
    if (!address) {
      return undefined;
    }

    const supporter = match?.topSupporters.find(
      (participant) =>
        participant.address.toLowerCase() === address.toLowerCase()
    );

    return supporter?.followingAddress ?? undefined;
  }, [address, match?.topSupporters]);

  const watchingLabel = useMemo(() => {
    if (selectedMonachad) {
      return `${selectedMonachad.slice(0, 8)}…${selectedMonachad.slice(-4)}`;
    }

    if (supporterFollowingAddress) {
      const normalized = supporterFollowingAddress;
      return normalized.length > 12
        ? `${normalized.slice(0, 8)}…${normalized.slice(-4)}`
        : normalized;
    }

    return "Not selected";
  }, [selectedMonachad, supporterFollowingAddress]);

  const matchStatus = match?.status ?? "UNKNOWN";
  const isCreated = matchStatus === "CREATED";
  const isActive = matchStatus === "ACTIVE";
  const isCompleted = matchStatus === "COMPLETED";

  const entryMarginEth = match?.entryMargin
    ? safeFormatEther(match.entryMargin)
    : "0";

  const entryFee = useMemo(() => {
    const base = Number(entryMarginEth);
    if (!Number.isFinite(base)) {
      return 0.0;
    }
    return base * 0.1;
  }, [entryMarginEth]);

  useEffect(() => {
    if (!address || !matchId) {
      setUserParticipant(null);
      return;
    }

    const fetchUserParticipant = async () => {
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/matches/${matchId}/participant/${address}`
        );
        if (response.ok) {
          const data = await response.json();
          setUserParticipant(data);
        } else {
          setUserParticipant(null);
        }
      } catch (error) {
        console.error("Failed to fetch user participant", error);
        setUserParticipant(null);
      }
    };

    fetchUserParticipant();
  }, [address, matchId]);

  const userRole = userParticipant?.role ?? null;

  const canStartMatch = useMemo(() => {
    if (!isCreated || userRole !== "MONACHAD") {
      return false;
    }

    return (match?.monachadCount ?? 0) >= 2;
  }, [isCreated, userRole, match?.monachadCount]);

  const allowedDexes = match?.allowedDexes ?? [];

  const handleStartMatch = useCallback(async () => {
    if (!match) {
      return;
    }

    if (!walletClient || !publicClient || !isConnected || !address) {
      setActionError("Connect your wallet before starting the match");
      return;
    }

    const matchManagerAddress = process.env
      .NEXT_PUBLIC_MATCH_MANAGER_ADDRESS as Hex | undefined;

    if (!matchManagerAddress) {
      setActionError("NEXT_PUBLIC_MATCH_MANAGER_ADDRESS is not configured");
      return;
    }

    try {
      setIsStartingMatch(true);
      setActionError(null);

      const normalizedMatchId = BigInt(match.matchId ?? matchId);
      const hash = await walletClient.writeContract({
        address: matchManagerAddress,
        abi: [
          {
            inputs: [
              { internalType: "uint256", name: "_matchId", type: "uint256" },
            ],
            name: "startMatch",
            outputs: [],
            stateMutability: "nonpayable",
            type: "function",
          },
        ],
        functionName: "startMatch",
        args: [normalizedMatchId],
      });

      await publicClient.waitForTransactionReceipt({ hash });
      await fetchMatchDetails();
    } catch (error: any) {
      console.error("Failed to start match", error);
      setActionError(error?.message ?? "Failed to start match");
    } finally {
      setIsStartingMatch(false);
    }
  }, [
    match,
    walletClient,
    publicClient,
    isConnected,
    address,
    fetchMatchDetails,
    matchId,
  ]);

  const joinAsMonachad = useCallback(async () => {
    if (!match || !isCreated) {
      alert("This match is not accepting Monachads right now");
      return;
    }

    if (!walletClient || !publicClient || !isConnected || !address || !chain) {
      alert("Please connect your wallet first");
      return;
    }

    if (!customMargin || Number.parseFloat(customMargin) <= 0) {
      alert("Enter the amount you want to stake");
      return;
    }

    const matchManagerAddress = process.env
      .NEXT_PUBLIC_MATCH_MANAGER_ADDRESS as Hex | undefined;

    if (!matchManagerAddress) {
      alert("NEXT_PUBLIC_MATCH_MANAGER_ADDRESS is not configured");
      return;
    }

    const baseUrl = process.env.NEXT_PUBLIC_API_URL;
    if (!baseUrl) {
      alert("NEXT_PUBLIC_API_URL is not configured");
      return;
    }

    try {
      setIsJoining(true);
      setActionError(null);

      const normalizedMatchId = BigInt(match.matchId ?? matchId);
      const stakeAmount =
        parseEther(customMargin) + parseEther(entryFee.toString());

      const simulation = await publicClient.simulateContract({
        account: address,
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
        args: [normalizedMatchId],
        value: stakeAmount,
      });

      const hash = await walletClient.writeContract(simulation.request);

      // const receipt = await publicClient.waitForTransactionReceipt({ hash });

      // await fetch(`${baseUrl}/matches/${matchId}/join-as-monachad`, {
      //   method: "POST",
      //   headers: { "Content-Type": "application/json" },
      //   body: JSON.stringify({
      //     address: address.toLowerCase(),
      //     smartAccountAddress: smartAccountAddr.toLowerCase(),
      //     transactionHash: hash,
      //     blockNumber: Number(receipt.blockNumber),
      //   }),
      // });

      alert(`You are now competing in match #${matchId}!`);
      setJoinMode(null);
      setCustomMargin("");
      await fetchMatchDetails();
    } catch (error: any) {
      console.error("Failed to join match as Monachad", error);

      if (error?.message?.includes("User rejected") || error?.code === 4001) {
        alert("Transaction cancelled");
      } else {
        const friendlyMessage =
          error?.shortMessage ||
          error?.details ||
          error?.message ||
          "Failed to join match";
        setActionError(friendlyMessage);
        alert(friendlyMessage);
      }
    } finally {
      setIsJoining(false);
    }
  }, [
    match,
    isCreated,
    walletClient,
    publicClient,
    isConnected,
    address,
    chain,
    customMargin,
    router,
    fetchMatchDetails,
    matchId,
  ]);

  const followMonachad = useCallback(
    async (monachadAddress: string) => {
      if (!match || (!isCreated && !isActive)) {
        alert("This match is not accepting supporters right now");
        return;
      }

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

      if (!customMargin || Number.parseFloat(customMargin) <= 0) {
        alert("Please enter the amount you want to fund your smart account");
        return;
      }

      const matchManagerAddress = process.env
        .NEXT_PUBLIC_MATCH_MANAGER_ADDRESS as Hex | undefined;

      if (!matchManagerAddress) {
        alert("NEXT_PUBLIC_MATCH_MANAGER_ADDRESS is not configured");
        return;
      }

      const tradeClubBundlerAddr =
        process.env.NEXT_PUBLIC_TRADE_CLUB_BUNDLER_ADDRESS;
      if (!tradeClubBundlerAddr) {
        alert("NEXT_PUBLIC_TRADE_CLUB_BUNDLER_ADDRESS is not configured");
        return;
      }

      try {
        setIsJoining(true);
        setSelectedMonachad(monachadAddress);

        const fundingAmount = parseEther(customMargin);
        const entryFeeAmount = parseEther(entryFee.toString());
        const totalAmount = fundingAmount + entryFeeAmount;

        const smartAccount = await toMetaMaskSmartAccount({
          client: publicClient,
          implementation: Implementation.Hybrid,
          address: smartAccountAddr as Hex,
          signer: { walletClient },
        });

        const delegation = createDelegation({
          environment: smartAccount.environment,
          from: smartAccount.address,
          to: tradeClubBundlerAddr as Hex,
          scope: {
            type: "nativeTokenTransferAmount",
            maxAmount: fundingAmount,
          },
          caveats: [],
          salt: `0x${Date.now().toString(16)}`,
        });

        const exactCalldataEnforcer =
          smartAccount.environment?.caveatEnforcers?.ExactCalldataEnforcer;
        const sanitizedDelegation = exactCalldataEnforcer
          ? {
              ...delegation,
              caveats: delegation.caveats.filter((caveat) => {
                if (!caveat || typeof caveat.enforcer !== "string") {
                  return true;
                }
                return (
                  caveat.enforcer.toLowerCase() !==
                  exactCalldataEnforcer.toLowerCase()
                );
              }),
            }
          : delegation;

        if (!sanitizedDelegation.caveats.length) {
          throw new Error(
            "Delegation is missing required caveats after sanitization"
          );
        }

        const signature = await smartAccount.signDelegation({
          delegation: sanitizedDelegation,
          chainId: chain.id,
        });
        const signedDelegation = { ...sanitizedDelegation, signature };

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
            BigInt(match.matchId ?? matchId),
            monachadAddress as Hex,
            smartAccountAddr as Hex,
          ],
          value: totalAmount,
        });

        const receipt = await publicClient.waitForTransactionReceipt({ hash });

        const baseUrl = process.env.NEXT_PUBLIC_API_URL;
        if (!baseUrl) {
          alert("NEXT_PUBLIC_API_URL is not configured");
          return;
        }
        // Store off-chain signed delegation
        await fetch(`${baseUrl}/matches/${matchId}/delegate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            supporterAddress: address.toLowerCase(),
            monachadAddress: monachadAddress.toLowerCase(),
            smartAccountAddress: smartAccountAddr.toLowerCase(),
            signedDelegation,
            entryFee: entryFeeAmount.toString(),
            fundedAmount: fundingAmount.toString(),
            // transactionHash: hash,
            transactionHash:
              "0x28ea03610c20384ccf363940054b7044aa15d3c85d74b50dc708f0b87d4bf271",
            // blockNumber: Number(receipt.blockNumber),
            blockNumber: 9445419,
          }),
        });

        alert(
          `Successfully following Monachad ${monachadAddress.slice(
            0,
            8
          )}... with ${customMargin} ETH!`
        );
        setJoinMode(null);
        setSelectedMonachad(null);
        setCustomMargin("");
        await fetchMatchDetails();
      } catch (error: any) {
        console.error("Failed to follow Monachad", error);

        if (error?.message?.includes("User rejected") || error?.code === 4001) {
          alert("Transaction cancelled");
        } else if (error?.message?.includes("insufficient funds")) {
          alert("Insufficient funds to pay entry fee, funding amount, and gas");
        } else {
          alert(error?.message ?? "Failed to follow Monachad");
        }
      } finally {
        setIsJoining(false);
        setSelectedMonachad(null);
      }
    },
    [
      match,
      isCreated,
      isActive,
      address,
      walletClient,
      publicClient,
      chain,
      customMargin,
      entryFee,
      router,
      fetchMatchDetails,
      matchId,
    ]
  );

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

  const leaderboard = match?.topMonachads ?? [];

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <Link href="/matches" className="text-blue-500 hover:text-blue-400">
            ← Back to Matches
          </Link>
          <div className="flex items-center gap-3">
            {isRefreshing && (
              <span className="text-xs text-gray-400">Refreshing…</span>
            )}
            <button
              onClick={fetchMatchDetails}
              className="px-3 py-1 text-sm rounded border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500"
            >
              Refresh
            </button>
            <ConnectButton />
          </div>
        </div>

        {loadError && (
          <div className="card border-red-500/40 bg-red-500/10 text-red-200">
            <p className="font-semibold mb-2">Failed to load match</p>
            <p className="text-sm">{loadError}</p>
          </div>
        )}

        {actionError && (
          <div className="card border-yellow-500/40 bg-yellow-500/10 text-yellow-200">
            <p className="font-semibold mb-2">Heads up</p>
            <p className="text-sm">{actionError}</p>
          </div>
        )}

        <div className="card">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <div>
              <p className="text-sm text-gray-400 uppercase tracking-widest">
                Match #{match.matchId ?? matchId}
              </p>
              <h1 className="text-3xl font-bold">{matchStatus} stage</h1>
            </div>
            <span
              className={`px-4 py-2 rounded-full font-semibold ${
                isActive
                  ? "bg-green-600/80"
                  : isCreated
                  ? "bg-blue-600/80"
                  : isCompleted
                  ? "bg-purple-600/80"
                  : "bg-gray-600/80"
              }`}
            >
              {matchStatus}
            </span>
          </div>

          <div className="grid gap-4 md:grid-cols-4">
            <div className="rounded border border-white/5 bg-white/5 p-4">
              <p className="text-xs text-gray-400">Entry Margin</p>
              <p className="text-xl font-semibold text-blue-300">
                {entryMarginEth} ETH
              </p>
            </div>
            <div className="rounded border border-white/5 bg-white/5 p-4">
              <p className="text-xs text-gray-400">Prize Pool</p>
              <p className="text-xl font-semibold text-green-300">
                {safeFormatEther(match.prizePool)} ETH
              </p>
            </div>
            <div className="rounded border border-white/5 bg-white/5 p-4">
              <p className="text-xs text-gray-400">Duration</p>
              <p className="text-xl font-semibold">
                {Math.floor((match.duration ?? 0) / 3600)}h
              </p>
            </div>
            <div className="rounded border border-white/5 bg-white/5 p-4">
              <p className="text-xs text-gray-400">Participants</p>
              <p className="text-xl font-semibold">
                {match.participantCount} / {match.maxParticipants}
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 mt-6">
            <div className="rounded border border-white/5 bg-white/5 p-4">
              <p className="text-xs text-gray-400">Supporters</p>
              <p className="text-lg font-semibold">{match?.supporterCount}</p>
            </div>
            <div className="rounded border border-white/5 bg-white/5 p-4">
              <p className="text-xs text-gray-400">Creator</p>
              <p className="font-mono text-sm text-gray-300">
                {match.creator ?? "Unknown"}
              </p>
            </div>
          </div>

          {match.startTime && (
            <p className="text-xs text-gray-400 mt-4">
              🕐 Started: {new Date(match.startTime).toLocaleString()}
            </p>
          )}

          {isCreated && userRole === "MONACHAD" && (
            <div className="mt-6 rounded border border-purple-500/30 bg-purple-500/10 p-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-purple-200">
                    Monachad Controls
                  </h3>
                  <p className="text-sm text-purple-100/70">
                    Start the match when all traders are ready.
                  </p>
                </div>
                <button
                  onClick={handleStartMatch}
                  disabled={!canStartMatch || isStartingMatch}
                  className="px-5 py-2 rounded-lg bg-purple-600 text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isStartingMatch ? "Starting…" : "Start Match"}
                </button>
              </div>
              {!canStartMatch && (
                <p className="text-xs text-purple-100/60 mt-3">
                  Need at least two Monachads before the match can start.
                </p>
              )}
            </div>
          )}
        </div>

        {isActive && (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr),minmax(0,1fr)]">
            <div className="space-y-6">
              <div className="card bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900 border-purple-500/30">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-semibold text-white">
                    Live Match Pulse
                  </h2>
                  <span className="px-3 py-1 text-xs font-semibold bg-red-600/20 text-red-300 rounded border border-red-500/40">
                    Broadcasting
                  </span>
                </div>
                <div className="grid gap-4 sm:grid-cols-4">
                  {mockChartData.map((point) => (
                    <div key={point.label} className="flex flex-col">
                      <div
                        className="relative flex-1 rounded bg-slate-800 overflow-hidden"
                        style={{ minHeight: "110px" }}
                      >
                        <div
                          className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-purple-500/70 to-purple-500/10"
                          style={{ height: `${point.value}%` }}
                        />
                      </div>
                      <span className="mt-2 text-xs text-gray-400 text-center">
                        {point.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {userRole === "MONACHAD" ? (
                <TradingPanel
                  matchId={match.matchId ?? matchId}
                  allowedDexes={allowedDexes}
                />
              ) : (
                <div className="card bg-slate-900/60 border border-slate-700/40 p-6 space-y-4">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">🧭</span>
                    <div>
                      <h3 className="text-xl font-semibold text-white">
                        Monachad Trading Terminal
                      </h3>
                      <p className="text-sm text-slate-400">
                        Only competing Monachads can execute trades here. Follow
                        along with live analytics while your chosen trader makes
                        moves.
                      </p>
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-lg border border-slate-700/60 bg-slate-800/40 p-4">
                      <p className="text-xs uppercase tracking-wide text-slate-400">
                        Watching
                      </p>
                      <p className="text-sm font-semibold text-white">
                        {watchingLabel}
                      </p>
                    </div>
                    <div className="rounded-lg border border-slate-700/60 bg-slate-800/40 p-4">
                      <p className="text-xs uppercase tracking-wide text-slate-400">
                        Allowed DEXes
                      </p>
                      <p className="text-sm font-semibold text-white">
                        {allowedDexes.length > 0
                          ? `${allowedDexes.length} configured`
                          : "Match is sandboxed"}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-6">
              <div className="card">
                <h3 className="text-xl font-semibold mb-4">Leaderboard</h3>
                <div className="space-y-3">
                  {leaderboard.map((entry: any, index: number) => (
                    <div
                      key={entry.address ?? index}
                      className="flex items-center justify-between rounded-lg border border-white/5 bg-white/5 px-4 py-3"
                    >
                      <div>
                        <p className="text-sm text-gray-400">#{index + 1}</p>
                        <p className="font-mono text-sm">
                          {entry.address?.slice(0, 8)}...
                          {entry.address?.slice(-4)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p
                          className={`text-lg font-semibold ${
                            (entry.roi ?? entry.pnl ?? "").startsWith("-")
                              ? "text-red-400"
                              : "text-green-400"
                          }`}
                        >
                          {entry.roi ? `${entry.roi}%` : entry.pnl}
                        </p>
                        {entry.pnlEth && (
                          <p className="text-xs text-gray-400">
                            {entry.pnlEth} ETH
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="card">
                <h3 className="text-xl font-semibold mb-4">Supporter Feed</h3>
                {match?.supporterCount === 0 ? (
                  <p className="text-sm text-gray-400">
                    No supporters yet. The crowd is warming up.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {match.topSupporters.slice(0, 5).map((supporter) => (
                      <div
                        key={supporter.address}
                        className="flex items-center justify-between rounded-lg border border-white/5 bg-white/5 px-4 py-3"
                      >
                        <div>
                          <p className="font-mono text-sm">
                            {supporter.address.slice(0, 8)}...
                            {supporter.address.slice(-4)}
                          </p>
                          <p className="text-xs text-gray-500">
                            Following {supporter.followingAddress?.slice(0, 6)}…
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-gray-400">Margin</p>
                          <p className="text-sm font-semibold">
                            {safeFormatEther(getParticipantStakeWei(supporter))}{" "}
                            ETH
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {isCompleted && (
          <div className="card border-green-500/40 bg-green-500/5">
            <div className="flex flex-col gap-3 text-center">
              <div className="text-5xl">🏁</div>
              <h2 className="text-3xl font-bold text-green-200">
                Match Finished
              </h2>
              <p className="text-gray-300">
                {match.winner
                  ? `Winner: ${match.winner}`
                  : "Final results have been recorded."}
              </p>
              <p className="text-sm text-gray-400">
                Prize Pool: {safeFormatEther(match.prizePool)} ETH
              </p>
            </div>
          </div>
        )}

        {isCreated && !joinMode && isConnected && (
          <div className="grid md:grid-cols-2 gap-6">
            <button
              onClick={() => {
                setJoinMode("monachad");
                setCustomMargin(safeFormatEther(match.entryMargin));
              }}
              className="card hover:border-blue-500 transition-all text-left p-8"
            >
              <div className="text-4xl mb-4">🎯</div>
              <h3 className="text-2xl font-bold mb-2">Join as Monachad</h3>
              <p className="text-gray-400 mb-4">
                Compete as a trader. Your plays fuel the broadcast.
              </p>
              <ul className="text-sm text-gray-500 space-y-1">
                <li>• Stake at least {entryMarginEth} ETH</li>
                <li>• Battle for the prize pool</li>
                <li>• Attract supporters</li>
              </ul>
              <div className="mt-4 text-blue-400 font-semibold">Continue →</div>
            </button>

            <button
              onClick={() => {
                setJoinMode("supporter");
                setCustomMargin("");
              }}
              className="card hover:border-purple-500 transition-all text-left p-8"
              disabled={(match?.monachadCount ?? 0) === 0}
            >
              <div className="text-4xl mb-4">👥</div>
              <h3 className="text-2xl font-bold mb-2">Follow a Monachad</h3>
              <p className="text-gray-400 mb-4">
                Copy their moves with your delegated smart account.
              </p>
              <ul className="text-sm text-gray-500 space-y-1">
                <li>• Pay {entryFee} ETH entry fee</li>
                <li>• Fund your smart account</li>
                <li>• Mirror trades automatically</li>
              </ul>
              <div className="mt-4 text-purple-400 font-semibold">
                {match?.monachadCount ?? 0 === 0
                  ? "Waiting for Monachads..."
                  : "Choose a trader →"}
              </div>
            </button>
          </div>
        )}

        {isCreated && joinMode === "monachad" && (
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-2xl font-bold">Stake & Compete</h3>
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

            <p className="text-gray-400 mb-6">
              Minimum stake is {entryMarginEth} ETH. Higher stakes increase the
              prize pool and send a signal to supporters.
            </p>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Amount to Stake (ETH)
              </label>
              <input
                type="number"
                step="0.001"
                min={entryMarginEth}
                placeholder={`Minimum: ${entryMarginEth} ETH`}
                value={customMargin}
                onChange={(event) => setCustomMargin(event.target.value)}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500 text-white"
              />
              <p className="text-xs text-gray-500 mt-2">
                💡 Bigger stakes increase the prize pool and your supporters'
                confidence.
              </p>
            </div>

            <div className="flex gap-4">
              <button
                onClick={joinAsMonachad}
                disabled={
                  isJoining ||
                  !customMargin ||
                  Number.parseFloat(customMargin) <
                    Number.parseFloat(entryMarginEth)
                }
                className="btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isJoining
                  ? "Joining…"
                  : `Join With ${
                      (parseFloat(customMargin) + entryFee).toFixed(4) || "?"
                    } ETH`}
              </button>
              <button
                onClick={() => {
                  setJoinMode(null);
                  setCustomMargin("");
                }}
                className="btn bg-gray-700 hover:bg-gray-600"
              >
                Back
              </button>
            </div>
          </div>
        )}

        {isCreated && joinMode === "supporter" && (
          <div className="space-y-6">
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-2xl font-bold">Choose a Monachad</h3>
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

              <div className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-gray-400">Entry Fee (10%)</span>
                  <span className="font-semibold">{entryFee} ETH</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-gray-400">Smart Account Funding</span>
                  <input
                    type="number"
                    step="0.001"
                    min="0.001"
                    placeholder="e.g., 0.1"
                    value={customMargin}
                    onChange={(event) => setCustomMargin(event.target.value)}
                    className="w-32 px-3 py-1 bg-gray-800 border border-gray-700 rounded focus:outline-none focus:border-purple-500 text-white text-right"
                  />
                </div>
                <div className="border-t border-gray-700 pt-3 flex justify-between text-lg font-bold">
                  <span>Total Commitment</span>
                  <span className="text-purple-400">
                    {customMargin
                      ? (
                          Number.parseFloat(entryFee.toString()) +
                          Number.parseFloat(customMargin)
                        ).toFixed(4)
                      : entryFee}{" "}
                    ETH
                  </span>
                </div>
                <p className="text-xs text-gray-500">
                  Entry fee goes to the prize pool. Funding amount fuels your
                  smart account for mirrored trades.
                </p>
              </div>
            </div>

            {match?.monachadCount === 0 ? (
              <div className="card">
                <p className="text-gray-400">
                  No Monachads competing yet. Be the first to join!
                </p>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-6">
                {match?.topMonachads.map((monachad) => (
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
                            Number.parseFloat(
                              // TODO: correct calculation
                              calculateRoi(
                                monachad.pnl,
                                getParticipantStakeWei(monachad)
                              )
                            ) >= 0
                              ? "text-green-400"
                              : "text-red-400"
                          }`}
                        >
                          {calculateRoi(
                            monachad.pnl,
                            getParticipantStakeWei(monachad)
                          )}
                          %
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                      <div>
                        <p className="text-gray-500">Staked</p>
                        <p>
                          {safeFormatEther(getParticipantStakeWei(monachad))}{" "}
                          ETH
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500">PnL</p>
                        <p
                          className={
                            (monachad.pnl ?? "0").startsWith("-")
                              ? "text-red-400"
                              : "text-green-400"
                          }
                        >
                          {monachad.pnl} ETH
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => followMonachad(monachad.address)}
                      disabled={
                        (isJoining && selectedMonachad === monachad.address) ||
                        !customMargin ||
                        Number.parseFloat(customMargin) <= 0
                      }
                      className="btn btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isJoining && selectedMonachad === monachad.address
                        ? "Following…"
                        : "Follow This Monachad"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {!joinMode && match?.monachadCount > 0 && !isActive && (
          <div className="card">
            <h3 className="text-2xl font-bold mb-4">Competing Monachads</h3>
            <div className="space-y-4">
              {match?.topMonachads.map((monachad, index) => (
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
                        {monachad.joinedAt
                          ? new Date(monachad.joinedAt).toLocaleDateString()
                          : "–"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-8">
                    <div className="text-right">
                      <p className="text-sm text-gray-500">PnL</p>
                      <p
                        className={`font-bold ${
                          (monachad.pnl ?? "0").startsWith("-")
                            ? "text-red-400"
                            : "text-green-400"
                        }`}
                      >
                        {monachad.pnl} ETH
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-500">ROI</p>
                      <p
                        className={`text-xl font-bold ${
                          Number.parseFloat(
                            calculateRoi(
                              monachad.pnl,
                              getParticipantStakeWei(monachad)
                            )
                          ) >= 0
                            ? "text-green-400"
                            : "text-red-400"
                        }`}
                      >
                        {Number.parseFloat(
                          calculateRoi(
                            monachad.pnl,
                            getParticipantStakeWei(monachad)
                          )
                        )}
                        %
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
