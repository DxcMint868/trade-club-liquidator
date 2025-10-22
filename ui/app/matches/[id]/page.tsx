"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import {
  Implementation,
  createDelegation,
  toMetaMaskSmartAccount,
} from "@metamask/delegation-toolkit";
import { type Hex, parseEther } from "viem";
import { MatchTradingView } from "@/components/matches/match-trading-view";
import { MonachadProfileModal } from "@/components/matches/monachad-profile-modal";
import { ChartViewOnly } from "@/components/matches/chart-view-only";
import { LivePositionsPanel } from "@/components/matches/live-positions-panel";
import { BattleFeedPanel } from "@/components/matches/battle-feed-panel";
import { useMatchEvents } from "@/hooks/use-match-events";
import { safeFormatEther } from "@/utils/format";
import { getMatchStatusDisplay } from "@/utils/display";
import { match } from "assert/strict";

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

interface DexMeta {
  name: string;
  address: string;
  logo: string;
  description: string;
}

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

const mockChartData = Array.from({ length: 12 }).map((_, index) => ({
  label: `Round ${index + 1}`,
  value: Math.round(50 + Math.random() * 50),
}));

export default function MatchDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const matchId = params?.id ?? "";

  const { address, isConnected, chain } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  // Contract addresses
  const fundexAddress = "0x16b0c1DCF87EBB4e0A0Ba4514FF0782CCE7889Cb";
  const matchManagerAddress =
    process.env.NEXT_PUBLIC_MATCH_MANAGER_ADDRESS ||
    "0x0000000000000000000000000000000000000000";

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

  // Monachad profile modal
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [selectedProfileAddress, setSelectedProfileAddress] = useState<
    string | null
  >(null);

  const openMonachadProfile = (address: string) => {
    setSelectedProfileAddress(address);
    setProfileModalOpen(true);
  };

  const closeMonachadProfile = () => {
    setProfileModalOpen(false);
    setSelectedProfileAddress(null);
  };

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

  // const participants = useMemo(() => match. ?? [], [match]);

  // const supporters = useMemo(() => {
  //   return participants.filter(
  //     (participant) => participant.role === "SUPPORTER"
  //   );
  // }, [participants]);

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

  // WebSocket for real-time copy trade updates
  const {
    allShadowTrades,
    myShadowTrades,
    allOriginalTrades,
    myChadOriginalTrades,
    isConnected: wsConnected,
  } = useMatchEvents({
    matchId,
    userAddress: address,
    followedMonachadAddress: supporterFollowingAddress,
    enabled: match?.status === "ACTIVE", // Only connect when match is active
  });

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

  const hasMonachads = (match?.monachadCount ?? 0) > 0;

  const monachadTotalCommitment = useMemo(() => {
    if (!customMargin) {
      return null;
    }
    const parsed = Number.parseFloat(customMargin);
    if (!Number.isFinite(parsed)) {
      return null;
    }
    return (parsed + entryFee).toFixed(4);
  }, [customMargin, entryFee]);

  const supporterTotalCommitment = useMemo(() => {
    const parsed = Number.parseFloat(customMargin || "0");
    if (!customMargin || !Number.isFinite(parsed)) {
      return entryFee.toFixed(3);
    }
    return (parsed + entryFee).toFixed(4);
  }, [customMargin, entryFee]);

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
    if (!match) return false;

    const isCreator = match.creator?.toLowerCase() === address?.toLowerCase();
    const moreThan1Chad = match.monachadCount >= 2;
    return isCreator && moreThan1Chad;
  }, [isCreated, userRole, match?.monachadCount]);

  const allowedDexes = useMemo(() => {
    return match?.allowedDexes ?? [];
  }, [match?.allowedDexes]);

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

    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/smart-account/check-deployment?ownerAddress=${address}`
    );
    const { isDeployed: isSmartAccountDeployed } = await res.json();
    console.log("isSmartAccountDeployed", isSmartAccountDeployed);
    if (!isSmartAccountDeployed) {
      alert("Please complete onboarding to create a smart account");
      router.push("/onboarding");
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

      const receipt = await publicClient.waitForTransactionReceipt({ hash });

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

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/smart-account/check-deployment?ownerAddress=${address}`
      );
      const { isDeployed: isSmartAccountDeployed, smartAccountAddress } =
        await res.json();
      console.log("isSmartAccountDeployed", isSmartAccountDeployed);
      if (!isSmartAccountDeployed) {
        alert("Please complete onboarding to create a smart account");
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
          address: smartAccountAddress as Hex,
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
            smartAccountAddress as Hex,
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
            smartAccountAddress: smartAccountAddress.toLowerCase(),
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
          )}... with ${customMargin} MON!`
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
      <main className="relative min-h-screen">
        <div className="absolute inset-0 bg-gradient-to-b from-[#080413] via-[#060310] via-30% to-[#04020d] to-black" />
        <div className="relative z-10 flex items-center justify-center min-h-screen">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-purple-500/30 border-t-purple-500" />
        </div>
      </main>
    );
  }

  if (!match) {
    return (
      <main className="relative min-h-screen">
        <div className="absolute inset-0 bg-gradient-to-b from-[#080413] via-[#060310] via-30% to-[#04020d] to-black" />
        <div className="relative z-10 p-8">
          <div className="max-w-6xl mx-auto">
            <div className="bg-black/40 backdrop-blur-md border border-purple-500/20 rounded-2xl p-6 shadow-2xl">
              <p className="text-white/70 mb-4">Match not found</p>
              <Link
                href="/matches"
                className="text-purple-400 hover:text-purple-300 transition-colors"
              >
                ← Back to Matches
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  const leaderboard = match?.topMonachads ?? [];

  return (
    <main className="relative min-h-screen">
      <div className="absolute inset-0 bg-gradient-to-b from-[#080413] via-[#060310] via-30% to-[#04020d] to-black" />
      <div className="relative z-10 p-8">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex justify-between items-center">
            <Link
              href="/matches"
              className="text-purple-400 hover:text-purple-300 transition-colors"
            >
              ← Back to Matches
            </Link>
            <div className="flex items-center gap-3">
              {isRefreshing && (
                <span className="text-xs text-white/50">Refreshing…</span>
              )}
              <button
                onClick={fetchMatchDetails}
                className="px-3 py-1 text-sm rounded-lg border border-purple-500/30 bg-black/40 text-white/70 hover:text-white hover:border-purple-400 transition-all"
              >
                Refresh
              </button>
              <ConnectButton />
            </div>
          </div>

          {/* Error Messages */}
          {loadError && (
            <div className="bg-black/40 backdrop-blur-md border border-red-500/40 rounded-2xl p-6 shadow-2xl bg-red-900/20">
              <p className="font-semibold mb-2 text-red-200">
                Failed to load match
              </p>
              <p className="text-sm text-red-300/70">{loadError}</p>
            </div>
          )}

          {actionError && (
            <div className="bg-black/40 backdrop-blur-md border border-yellow-500/40 rounded-2xl p-6 shadow-2xl bg-yellow-900/20">
              <p className="font-semibold mb-2 text-yellow-200">Heads up</p>
              <p className="text-sm text-yellow-300/70">{actionError}</p>
            </div>
          )}

          {/* Match Header */}
          <div className="bg-black/40 backdrop-blur-md border border-purple-500/20 rounded-2xl p-6 shadow-2xl">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
              <div>
                <p className="text-sm text-white/50 uppercase tracking-widest mb-1">
                  Match #{match.matchId ?? matchId}
                </p>
                <h1 className="text-3xl font-bold text-purple-300">
                  {getMatchStatusDisplay(matchStatus)}
                </h1>
              </div>
              <span
                className={`px-4 py-2 rounded-full font-semibold text-sm border ${
                  isActive
                    ? "bg-green-500/20 text-green-300 border-green-500/40"
                    : isCreated
                    ? "bg-blue-500/20 text-blue-300 border-blue-500/40"
                    : isCompleted
                    ? "bg-purple-500/20 text-purple-300 border-purple-500/40"
                    : "bg-gray-500/20 text-gray-300 border-gray-500/40"
                }`}
              >
                {matchStatus}
              </span>
            </div>

            <div className="grid gap-4 md:grid-cols-4">
              <div className="rounded-lg border border-purple-500/20 bg-purple-500/5 p-4">
                <p className="text-xs text-white/50 uppercase tracking-wide mb-1">
                  Entry Margin
                </p>
                <p className="text-xl font-semibold text-blue-300">
                  {entryMarginEth} MON
                </p>
              </div>
              <div className="rounded-lg border border-purple-500/20 bg-purple-500/5 p-4">
                <p className="text-xs text-white/50 uppercase tracking-wide mb-1">
                  Prize Pool
                </p>
                <p className="text-xl font-semibold text-green-300">
                  {safeFormatEther(match.prizePool)} MON
                </p>
              </div>
              <div className="rounded-lg border border-purple-500/20 bg-purple-500/5 p-4">
                <p className="text-xs text-white/50 uppercase tracking-wide mb-1">
                  Duration
                </p>
                <p className="text-xl font-semibold text-white">
                  {Math.floor((match.duration ?? 0) / 3600)}h
                </p>
              </div>
              <div className="rounded-lg border border-purple-500/20 bg-purple-500/5 p-4">
                <p className="text-xs text-white/50 uppercase tracking-wide mb-1">
                  Participants
                </p>
                <p className="text-xl font-semibold text-white">
                  {match.participantCount} / {match.maxParticipants}
                </p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 mt-4">
              <div className="rounded-lg border border-purple-500/20 bg-purple-500/5 p-4">
                <p className="text-xs text-white/50 uppercase tracking-wide mb-1">
                  Supporters
                </p>
                <p className="text-lg font-semibold text-white">
                  {match?.supporterCount}
                </p>
              </div>
              <div className="rounded-lg border border-purple-500/20 bg-purple-500/5 p-4">
                <p className="text-xs text-white/50 uppercase tracking-wide mb-1">
                  Creator
                </p>
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
            <div className="space-y-6">
              {/* Trading View - Full Width */}
              {userRole === "MONACHAD" ? (
                <MatchTradingView
                  matchId={match.matchId ?? matchId}
                  allowedDexes={allowedDexes}
                  fundexAddress={fundexAddress}
                  matchManagerAddress={matchManagerAddress}
                  onTradeSuccess={fetchMatchDetails}
                />
              ) : (
                <>
                  <ChartViewOnly matchId={match.matchId ?? matchId} />

                  {/* Battle Feed Panel - Real-time Chaos! */}
                  <BattleFeedPanel
                    allShadowTrades={allShadowTrades}
                    myShadowTrades={myShadowTrades}
                    allOriginalTrades={allOriginalTrades}
                    myChadOriginalTrades={myChadOriginalTrades}
                    isConnected={wsConnected}
                  />
                </>
              )}

              <LivePositionsPanel
                matchId={match.matchId ?? matchId}
                fundexAddress={fundexAddress}
                matchManagerAddress={matchManagerAddress}
                matchBlockNumber={match?.blockNumber ? Number(match.blockNumber) : undefined}
                isMonachad={userRole === "MONACHAD"}
                followedMonachadAddress={supporterFollowingAddress ?? null}
              />

              {/* Leaderboard and Stats Section */}
              <div className="grid gap-6 lg:grid-cols-2">
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

                <div className="space-y-6">
                  <div className="card">
                    <h3 className="text-xl font-semibold mb-4">Leaderboard</h3>
                    <div className="space-y-3">
                      {leaderboard.map((entry: any, index: number) => (
                        <button
                          key={entry.address ?? index}
                          onClick={() => openMonachadProfile(entry.address)}
                          className="w-full flex items-center justify-between rounded-lg border border-white/5 bg-white/5 px-4 py-3 hover:bg-white/10 hover:border-purple-500/40 transition-all cursor-pointer group"
                        >
                          <div className="flex items-center gap-3">
                            <p className="text-sm text-gray-400">
                              #{index + 1}
                            </p>
                            <div className="text-left">
                              <p className="font-mono text-sm group-hover:text-purple-300 transition-colors">
                                {entry.address?.slice(0, 8)}...
                                {entry.address?.slice(-4)}
                              </p>
                              <p className="text-xs text-gray-500">
                                Click to view profile
                              </p>
                            </div>
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
                                {entry.pnlEth} MON
                              </p>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="card">
                    <h3 className="text-xl font-semibold mb-4">
                      Supporter Feed
                    </h3>
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
                                Following{" "}
                                {supporter.followingAddress?.slice(0, 6)}…
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs text-gray-400">Margin</p>
                              <p className="text-sm font-semibold">
                                {safeFormatEther(
                                  getParticipantStakeWei(supporter)
                                )}{" "}
                                MON
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
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
                  Prize Pool: {safeFormatEther(match.prizePool)} MON
                </p>
              </div>
            </div>
          )}

          {isCreated && !joinMode && isConnected && (
            <div className="grid gap-6 md:grid-cols-2">
              <button
                onClick={() => {
                  setJoinMode("monachad");
                  setCustomMargin(safeFormatEther(match.entryMargin));
                }}
                className="relative overflow-hidden rounded-3xl border border-blue-500/30 bg-gradient-to-br from-slate-900 via-slate-900/60 to-blue-950/60 p-8 text-left shadow-[0_0_25px_-12px_rgba(56,189,248,0.75)] transition-all duration-300 ease-out hover:-translate-y-1 hover:border-blue-400/70 hover:shadow-[0_0_50px_-18px_rgba(56,189,248,0.95)]"
              >
                <div className="pointer-events-none absolute -right-4 -top-6 h-40 w-40 opacity-90 md:h-48 md:w-48">
                  <Image
                    src="/monachad2.png"
                    alt="Monachad meme"
                    width={220}
                    height={220}
                    className="h-full w-full object-contain drop-shadow-[0_8px_16px_rgba(56,189,248,0.45)]"
                  />
                </div>
                <div className="pointer-events-none absolute -left-20 top-10 h-56 w-56 rounded-full bg-blue-500/10 blur-3xl" />
                <div className="relative flex h-full flex-col gap-6">
                  <span className="inline-flex w-fit items-center gap-2 rounded-full border border-blue-500/40 bg-blue-500/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-blue-200/80">
                    🧠 Chad Brain Mode
                  </span>
                  <div>
                    <h3 className="text-3xl font-black text-blue-100 drop-shadow">Become the Signal</h3>
                    <p className="mt-2 max-w-sm text-sm text-slate-300/90">
                      Stake hard, swing harder. Every winning play beams across Monachad TV and summons your loyal pepes.
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs text-slate-300/80">
                    <div className="rounded-xl border border-blue-500/30 bg-slate-900/60 px-4 py-3">
                      <p className="text-[0.6rem] uppercase tracking-[0.2em] text-blue-300/70">Min Stake</p>
                      <p className="mt-1 text-lg font-bold text-blue-100">{entryMarginEth} MON</p>
                    </div>
                    <div className="rounded-xl border border-blue-500/30 bg-slate-900/60 px-4 py-3">
                      <p className="text-[0.6rem] uppercase tracking-[0.2em] text-blue-300/70">Entry Flex</p>
                      <p className="mt-1 text-lg font-bold text-blue-100">Tx + hype</p>
                    </div>
                  </div>
                  <div className="mt-auto inline-flex items-center gap-2 text-sm font-semibold text-blue-200">
                    Launch the raid
                    <span className="text-xl">🚀</span>
                  </div>
                </div>
              </button>

              <button
                onClick={() => {
                  setJoinMode("supporter");
                  setCustomMargin("");
                }}
                className={`relative overflow-hidden rounded-3xl border border-purple-500/30 bg-gradient-to-br from-slate-900 via-slate-900/60 to-purple-950/70 p-8 text-left shadow-[0_0_25px_-12px_rgba(168,85,247,0.65)] transition-all duration-300 ease-out hover:-translate-y-1 hover:border-purple-400/80 hover:shadow-[0_0_50px_-18px_rgba(168,85,247,0.95)] ${
                  !hasMonachads ? "cursor-not-allowed opacity-70" : ""
                }`}
                disabled={!hasMonachads}
              >
                <div className="pointer-events-none absolute -right-6 -top-10 h-48 w-48 md:-right-2 md:h-56 md:w-56">
                  <Image
                    src="/pepemon4.png"
                    alt="Pepe supporter"
                    width={240}
                    height={240}
                    className="h-full w-full object-contain drop-shadow-[0_10px_18px_rgba(192,132,252,0.5)]"
                  />
                </div>
                <div className="pointer-events-none absolute -left-16 bottom-6 h-56 w-56 rounded-full bg-purple-500/10 blur-3xl" />
                <div className="relative flex h-full flex-col gap-6">
                  <span className="inline-flex w-fit items-center gap-2 rounded-full border border-purple-500/40 bg-purple-500/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-purple-200/80">
                    � Copytrader Squad
                  </span>
                  <div>
                    <h3 className="text-3xl font-black text-purple-100 drop-shadow">Follow a Monachad</h3>
                    <p className="mt-2 max-w-sm text-sm text-slate-200/80">
                      Strap in, delegate the smart account, and vibe as your chosen Chad prints on-chain glory for the culture.
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs text-slate-200/80">
                    <div className="rounded-xl border border-purple-500/30 bg-slate-900/60 px-4 py-3">
                      <p className="text-[0.6rem] uppercase tracking-[0.2em] text-purple-300/70">Entry Fee</p>
                      <p className="mt-1 text-lg font-bold text-purple-100">{entryFee.toFixed(3)} MON</p>
                    </div>
                    <div className="rounded-xl border border-purple-500/30 bg-slate-900/60 px-4 py-3">
                      <p className="text-[0.6rem] uppercase tracking-[0.2em] text-purple-300/70">Mirror Mode</p>
                      <p className="mt-1 text-lg font-bold text-purple-100">Auto-Yeet</p>
                    </div>
                  </div>
                  <div className="mt-auto inline-flex items-center gap-2 text-sm font-semibold text-purple-200">
                    {hasMonachads ? "Pick your captain" : "Waiting for Chads"}
                    <span className="text-xl">✨</span>
                  </div>
                </div>
              </button>
            </div>
          )}

          {isCreated && joinMode === "monachad" && (
            <div className="relative overflow-hidden rounded-3xl border border-blue-500/30 bg-gradient-to-br from-[#0a1020] via-slate-900/90 to-blue-950/70 p-8 shadow-[0_0_40px_-18px_rgba(59,130,246,0.6)] md:p-10">
              <div className="pointer-events-none absolute -right-6 bottom-0 hidden h-60 w-60 rotate-6 opacity-90 sm:block">
                <Image
                  src="/monachad1.png"
                  alt="Monachad flex"
                  width={300}
                  height={300}
                  className="h-full w-full object-contain drop-shadow-[0_18px_35px_rgba(56,189,248,0.45)]"
                />
              </div>
              <div className="pointer-events-none absolute -left-24 top-0 h-72 w-72 rounded-full bg-blue-500/15 blur-3xl" />

              <div className="relative space-y-8">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <span className="inline-flex items-center gap-2 rounded-full border border-blue-500/40 bg-blue-500/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.35em] text-blue-200/80">
                      🪙 You Are The Chad
                    </span>
                    <h3 className="mt-3 text-3xl font-black text-blue-100 drop-shadow">Stake &amp; Compete</h3>
                  </div>
                  <button
                    onClick={() => {
                      setJoinMode(null);
                      setCustomMargin("");
                    }}
                    className="rounded-full border border-transparent bg-slate-900/60 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:border-blue-400/40 hover:text-white"
                  >
                    Cancel
                  </button>
                </div>

                <p className="max-w-2xl text-sm leading-relaxed text-slate-300/85">
                  Minimum stake is {entryMarginEth} MON. Send a bigger bag to amplify
                  the prize pool, flex dominance on stream, and magnetize the supporter swarm.
                </p>

                <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_240px]">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-[0.3em] text-blue-200/70">
                      Amount to Stake (MON)
                    </label>
                    <div className="relative mt-3">
                      <input
                        type="number"
                        step="0.001"
                        min={entryMarginEth}
                        placeholder={`Minimum: ${entryMarginEth} MON`}
                        value={customMargin}
                        onChange={(event) => setCustomMargin(event.target.value)}
                        className="w-full rounded-2xl border border-blue-500/30 bg-slate-900/80 px-4 py-4 text-lg font-semibold text-blue-100 shadow-inner shadow-blue-900/40 outline-none transition focus:border-blue-400 focus:bg-slate-900"
                      />
                      <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold uppercase tracking-[0.3em] text-blue-200/70">
                        MON
                      </span>
                    </div>
                    <p className="mt-3 text-xs text-slate-400">
                      💡 Bigger stakes turbocharge the prize pool and broadcast your entry to every lurking Pepe.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-5 text-blue-100">
                    <p className="text-[0.65rem] uppercase tracking-[0.35em] text-blue-100/70">
                      Total Commitment
                    </p>
                    <p className="mt-3 text-3xl font-black">
                      {monachadTotalCommitment ?? "?.????"} MON
                    </p>
                    <p className="mt-2 text-xs text-blue-100/70">
                      Includes the 10% entry fee ({entryFee.toFixed(3)} MON) destined for the prize pool.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-4">
                  <button
                    onClick={joinAsMonachad}
                    disabled={
                      isJoining ||
                      !customMargin ||
                      Number.parseFloat(customMargin) <
                        Number.parseFloat(entryMarginEth)
                    }
                    className="inline-flex items-center gap-3 rounded-full bg-gradient-to-r from-blue-500 via-violet-500 to-purple-600 px-8 py-3 text-base font-semibold text-white shadow-lg shadow-blue-900/40 transition duration-200 hover:scale-[1.02] hover:shadow-blue-900/50 disabled:scale-100 disabled:opacity-40"
                  >
                    {isJoining ? "Summoning…" : `Join With ${monachadTotalCommitment ?? "?"} MON`}
                  </button>
                  <button
                    onClick={() => {
                      setJoinMode(null);
                      setCustomMargin("");
                    }}
                    className="rounded-full border border-blue-500/30 bg-slate-900/70 px-6 py-3 text-sm font-semibold text-blue-200 transition hover:border-blue-400/50 hover:text-white"
                  >
                    Back
                  </button>
                  <span className="text-xs font-semibold tracking-[0.25em] text-blue-200/60">
                    📡 Chad transmissions go instant once you lock in.
                  </span>
                </div>
              </div>
            </div>
          )}

          {isCreated && joinMode === "supporter" && (
            <div className="space-y-6">
              <div className="relative overflow-hidden rounded-3xl border border-purple-500/30 bg-gradient-to-br from-[#120b1f] via-slate-900/90 to-purple-950/75 p-8 shadow-[0_0_40px_-20px_rgba(168,85,247,0.75)] md:p-10">
                <div className="pointer-events-none absolute -right-6 top-0 hidden h-60 w-60 opacity-80 md:block">
                  <Image
                    src="/pepemon3.png"
                    alt="Supporter pepe"
                    width={300}
                    height={300}
                    className="h-full w-full object-contain drop-shadow-[0_18px_30px_rgba(168,85,247,0.45)]"
                  />
                </div>
                <div className="pointer-events-none absolute -left-24 bottom-0 h-72 w-72 rounded-full bg-purple-500/15 blur-3xl" />

                <div className="relative space-y-8">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <span className="inline-flex items-center gap-2 rounded-full border border-purple-500/40 bg-purple-500/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.35em] text-purple-200/80">
                        🐸 Copytrade Ritual
                      </span>
                      <h3 className="mt-3 text-3xl font-black text-purple-100 drop-shadow">
                        Choose a Monachad
                      </h3>
                    </div>
                    <button
                      onClick={() => {
                        setJoinMode(null);
                        setCustomMargin("");
                      }}
                      className="rounded-full border border-transparent bg-slate-900/60 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:border-purple-400/40 hover:text-white"
                    >
                      Cancel
                    </button>
                  </div>

                  <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_220px]">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between rounded-2xl border border-purple-500/20 bg-purple-500/5 px-4 py-4 text-sm text-purple-100">
                        <span className="uppercase tracking-[0.3em] text-purple-200/75">
                          Entry Fee (10%)
                        </span>
                        <span className="text-xl font-bold">{entryFee.toFixed(3)} MON</span>
                      </div>
                      <div className="rounded-2xl border border-purple-500/20 bg-slate-900/80 px-4 py-4">
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-xs font-semibold uppercase tracking-[0.3em] text-purple-200/70">
                            Smart Account Funding
                          </span>
                          <div className="relative">
                            <input
                              type="number"
                              step="0.001"
                              min="0.001"
                              placeholder="e.g., 0.1"
                              value={customMargin}
                              onChange={(event) => setCustomMargin(event.target.value)}
                              className="w-32 rounded-xl border border-purple-500/30 bg-slate-900 px-3 py-2 text-right text-base font-semibold text-purple-100 outline-none transition focus:border-purple-400"
                            />
                            <span className="pointer-events-none absolute -bottom-5 left-0 text-[0.6rem] uppercase tracking-[0.3em] text-purple-300/60">
                              MON
                            </span>
                          </div>
                        </div>
                        <p className="mt-4 text-xs text-purple-200/70">
                          Fuel this buffer so your smart account can instantly mirror Chad trades without missing the pump.
                        </p>
                      </div>
                    </div>
                    <div className="rounded-2xl border border-purple-400/30 bg-purple-500/10 p-5 text-purple-100">
                      <p className="text-[0.65rem] uppercase tracking-[0.35em] text-purple-100/70">
                        Total Commitment
                      </p>
                      <p className="mt-3 text-3xl font-black">{supporterTotalCommitment} MON</p>
                      <p className="mt-2 text-xs text-purple-100/70">
                        Entry feeds the prize pool. Funding sticks with your smart account to follow every move.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {!hasMonachads ? (
                <div className="relative overflow-hidden rounded-3xl border border-dashed border-purple-500/40 bg-slate-900/80 p-10 text-center">
                  <div className="text-5xl">🕯️</div>
                  <p className="mt-4 text-sm text-purple-200/70">
                    Summon a Monachad first—no one is battling yet. Signal the arena by joining as a Chad above.
                  </p>
                </div>
              ) : (
                <div className="grid gap-6 md:grid-cols-2">
                  {match?.topMonachads.map((monachad, index) => (
                    <div
                      key={monachad.address}
                      className="relative overflow-hidden rounded-3xl border border-purple-500/30 bg-gradient-to-br from-[#181028] via-slate-900/80 to-purple-950/60 p-6 text-purple-50 shadow-[0_0_32px_-22px_rgba(168,85,247,0.75)] transition-all duration-300 hover:-translate-y-1 hover:border-purple-400/70"
                    >
                      <div className="pointer-events-none absolute -right-4 -bottom-2 h-32 w-32 opacity-80">
                        <Image
                          src={index % 2 === 0 ? "/pepemon5.png" : "/pepemon6.png"}
                          alt="Cheering pepe"
                          width={160}
                          height={160}
                          className="h-full w-full object-contain drop-shadow-[0_10px_20px_rgba(168,85,247,0.4)]"
                        />
                      </div>
                      <div className="pointer-events-none absolute -left-14 top-6 h-40 w-40 rounded-full bg-purple-500/10 blur-3xl" />

                      <div className="relative space-y-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <span className="text-[0.6rem] uppercase tracking-[0.3em] text-purple-200/70">
                              Monachad #{index + 1}
                            </span>
                            <p className="mt-2 font-mono text-lg font-bold">
                              {monachad.address.slice(0, 6)}...{monachad.address.slice(-4)}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs uppercase tracking-[0.3em] text-purple-200/70">ROI</p>
                            <p
                              className={`text-2xl font-black ${
                                Number.parseFloat(
                                  calculateRoi(
                                    monachad.pnl,
                                    getParticipantStakeWei(monachad)
                                  )
                                ) >= 0
                                  ? "text-green-300"
                                  : "text-red-300"
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

                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="text-purple-200/70">Staked</p>
                            <p className="font-semibold text-purple-50">
                              {safeFormatEther(getParticipantStakeWei(monachad))} MON
                            </p>
                          </div>
                          <div>
                            <p className="text-purple-200/70">PnL</p>
                            <p
                              className={
                                (monachad.pnl ?? "0").startsWith("-")
                                  ? "font-semibold text-red-300"
                                  : "font-semibold text-green-300"
                              }
                            >
                              {monachad.pnl} MON
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
                          className="relative inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-purple-500 via-fuchsia-500 to-pink-500 px-6 py-3 text-base font-semibold text-white shadow-lg shadow-purple-900/30 transition duration-200 hover:scale-[1.02] hover:shadow-purple-900/40 disabled:scale-100 disabled:opacity-40"
                        >
                          {isJoining && selectedMonachad === monachad.address ? (
                            <>
                              <span className="animate-spin">🌀</span>
                              Following…
                            </>
                          ) : (
                            <>
                              <span>🔥</span>
                              Follow This Monachad
                            </>
                          )}
                        </button>
                      </div>
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
                  <button
                    key={monachad.address}
                    onClick={() => openMonachadProfile(monachad.address)}
                    className="w-full flex items-center justify-between p-4 bg-gray-800/50 rounded-lg hover:bg-gray-800/80 hover:border hover:border-purple-500/40 transition-all cursor-pointer group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="text-2xl font-bold text-gray-500">
                        #{index + 1}
                      </div>
                      <div className="text-left">
                        <p className="font-mono font-semibold group-hover:text-purple-300 transition-colors">
                          {monachad.address.slice(0, 8)}...
                          {monachad.address.slice(-6)}
                        </p>
                        <p className="text-sm text-gray-500">
                          {monachad.joinedAt
                            ? new Date(monachad.joinedAt).toLocaleDateString()
                            : "Click to view profile"}
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
                          {monachad.pnl} MON
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
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Monachad Profile Modal */}
      {selectedProfileAddress && (
        <MonachadProfileModal
          address={selectedProfileAddress}
          isOpen={profileModalOpen}
          onClose={closeMonachadProfile}
        />
      )}
    </main>
  );
}
