"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import Image from "next/image";
import {
  useAccount,
  usePublicClient,
  useReadContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { encodeFunctionData, formatEther, type Hex } from "viem";
import {
  FUNDEX_ABI,
  POSITION_CLOSED_EVENT,
  POSITION_OPENED_EVENT,
  POSITION_TYPE_LABELS,
  type PositionTypeLabel,
} from "@/lib/fundex";
import { cn } from "../../lib/utils";

const MATCH_MANAGER_ABI = [
  {
    type: "function",
    name: "monachadMatchVaults",
    stateMutability: "view",
    inputs: [
      { name: "matchId", type: "uint256" },
      { name: "monachad", type: "address" },
    ],
    outputs: [{ name: "vault", type: "address" }],
  },
  {
    type: "function",
    name: "monachadExecuteTrade",
    stateMutability: "nonpayable",
    inputs: [
      { name: "matchId", type: "uint256" },
      { name: "target", type: "address" },
      { name: "calldata", type: "bytes" },
      { name: "nativeAmount", type: "uint256" },
    ],
    outputs: [],
  },
] as const;

interface PositionViewModel {
  positionId: bigint;
  assetId: bigint;
  assetSymbol: string;
  positionType: PositionTypeLabel;
  collateral: bigint;
  size: bigint;
  leverage: bigint;
  entryPrice: bigint;
  pnl: bigint;
  openedAt: Date;
  lastPrice: bigint;
}

interface LivePositionsPanelProps {
  matchId: string;
  fundexAddress: string;
  matchManagerAddress: string;
  matchBlockNumber?: number;
  isMonachad: boolean;
  followedMonachadAddress?: string | null;
}

const memeAssets = [
  { src: "/pepemon3.png", size: 200, rotation: "-6deg" },
  { src: "/pepemon5.png", size: 160, rotation: "8deg" },
  { src: "/monachad2.png", size: 220, rotation: "3deg" },
];

function formatUsd(value: bigint | number): string {
  const numeric = typeof value === "number" ? value : Number(value) / 1e18;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(numeric);
}

function formatEth(value: bigint): string {
  const formatted = formatEther(value);
  return `${Number(formatted).toFixed(4)} ETH`;
}

function formatPnl(pnl: bigint): { display: string; positive: boolean } {
  const positive = pnl >= BigInt(0);
  const abs = positive ? pnl : -pnl;
  const formatted = Number(formatEther(abs)).toFixed(4);
  return {
    display: `${positive ? "+" : "-"}${formatted} ETH`,
    positive,
  };
}

export function LivePositionsPanel({
  matchId,
  fundexAddress,
  matchManagerAddress,
  matchBlockNumber,
  isMonachad,
  followedMonachadAddress,
}: LivePositionsPanelProps) {
  const { address: connectedAddress } = useAccount();
  const [smartAccountAddress, setSmartAccountAddress] = useState<Hex | null>(
    null
  );
  const publicClient = usePublicClient();

  const matchIdBigInt = useMemo(() => {
    try {
      return matchId ? BigInt(matchId) : BigInt(BigInt(0));
    } catch {
      return BigInt(BigInt(0));
    }
  }, [matchId]);

  const monachadAddress = isMonachad ? connectedAddress : undefined;

  useEffect(() => {
    const fetchSmartAccountDeploymentStatus = async () => {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/smart-account/check-deployment?ownerAddress=${connectedAddress}`
      );
      const { isDeployed: isSmartAccountDeployed, smartAccountAddress } =
        await res.json();

      if (!isSmartAccountDeployed) return;
      setSmartAccountAddress(smartAccountAddress);
      return smartAccountAddress;
    };

    fetchSmartAccountDeploymentStatus();
  }, [connectedAddress]);

  const { data: vaultAddress } = useReadContract({
    address: matchManagerAddress as Hex,
    abi: MATCH_MANAGER_ABI,
    functionName: "monachadMatchVaults",
    args:
      matchIdBigInt && monachadAddress
        ? ([matchIdBigInt, monachadAddress] as const)
        : undefined,
    query: {
      enabled: Boolean(isMonachad && monachadAddress && matchManagerAddress),
    },
  });

  const [leaderPositions, setLeaderPositions] = useState<PositionViewModel[]>(
    []
  );
  const [supporterPositions, setSupporterPositions] = useState<
    PositionViewModel[]
  >([]);
  const [loadingLeader, setLoadingLeader] = useState(false);
  const [loadingSupporter, setLoadingSupporter] = useState(false);

  const fromBlock = useMemo(() => {
    return matchBlockNumber ? BigInt(matchBlockNumber) : BigInt(BigInt(0));
  }, [matchBlockNumber]);

  const fetchPositionsForTrader = useCallback(
    async (trader: Hex | undefined): Promise<PositionViewModel[]> => {
      if (!publicClient || !trader || !fundexAddress) {
        return [];
      }

      try {
        const [openedLogs, closedLogs] = await Promise.all([
          publicClient.getLogs({
            address: fundexAddress as Hex,
            event: POSITION_OPENED_EVENT,
            args: { trader: trader.toLowerCase() as Hex },
            fromBlock,
          }),
          publicClient.getLogs({
            address: fundexAddress as Hex,
            event: POSITION_CLOSED_EVENT,
            args: { trader: trader.toLowerCase() as Hex },
            fromBlock,
          }),
        ]);

        const closedIds = new Set(
          closedLogs.map((log) => log.args?.positionId?.toString() ?? "")
        );

        const openLogs = openedLogs.filter((log) => {
          const id = log.args?.positionId?.toString();
          return id && !closedIds.has(id);
        });
        console.log("openLogs", openLogs);

        const enriched = await Promise.all(
          openLogs.map(async (log) => {
            console.log("Processing log:", log);
            const args = log.args;
            console.log("Log args:", args);
            if (!args) {
              console.log("No args found, returning null");
              return null;
            }

            const assetId = args.assetId ?? BigInt(0);
            console.log("Fetching asset info for assetId:", assetId);

            let symbol = "UNKNOWN";
            let currentPrice = BigInt(0);

            try {
              const asset = await publicClient.readContract({
                address: fundexAddress as Hex,
                abi: FUNDEX_ABI,
                functionName: "assets",
                args: [assetId],
              });
              console.log("Asset data:", asset);

              // assets() returns a struct directly as an array: [symbol, currentPrice, lastUpdated, isActive]
              if (Array.isArray(asset)) {
                symbol = asset[0] as string;
                currentPrice = asset[1] as bigint;
              } else {
                // Fallback if it's returned as object
                const assetData = asset as unknown as {
                  symbol: string;
                  currentPrice: bigint;
                  lastUpdated: bigint;
                  isActive: boolean;
                };
                symbol = assetData.symbol;
                currentPrice = assetData.currentPrice;
              }
            } catch (error) {
              console.error(`Failed to fetch asset ${assetId}:`, error);
              // Use fallback values but continue processing the position
              symbol = `Asset#${assetId}`;
              currentPrice = args.entryPrice ?? BigInt(0);
            }

            const positionTypeNumeric = Number(args.positionType ?? BigInt(0));
            const size = args.size ?? BigInt(0);
            const entryPrice = args.entryPrice ?? BigInt(0);
            const leverage = args.leverage ?? BigInt(0);
            const collateral = args.collateral ?? BigInt(0);

            const priceDelta = currentPrice - entryPrice;
            const signedDelta =
              positionTypeNumeric === 0 ? priceDelta : -priceDelta;
            const pnl =
              entryPrice === BigInt(0)
                ? BigInt(0)
                : (signedDelta * size) / entryPrice;

            const enrichedPosition = {
              positionId: args.positionId ?? BigInt(0),
              assetId,
              assetSymbol: symbol,
              positionType: POSITION_TYPE_LABELS[positionTypeNumeric] ?? "LONG",
              collateral,
              size,
              leverage,
              entryPrice,
              pnl,
              openedAt: new Date(Number(args.timestamp ?? BigInt(0)) * 1000),
              lastPrice: currentPrice,
            } satisfies PositionViewModel;

            console.log("Enriched position:", enrichedPosition);
            return enrichedPosition;
          })
        );
        console.log("enriched positions", enriched);
        console.log("Filtered positions (non-null):", enriched.filter(Boolean));

        return enriched.filter(Boolean) as PositionViewModel[];
      } catch (error) {
        console.error("Failed to fetch positions", error);
        return [];
      }
    },
    [fromBlock, fundexAddress, publicClient]
  );

  const refreshLeaderPositions = useCallback(async () => {
    if (!isMonachad) return;
    setLoadingLeader(true);
    const positions = await fetchPositionsForTrader(
      (vaultAddress as Hex | undefined) ?? undefined
    );
    setLeaderPositions(positions);
    setLoadingLeader(false);
  }, [fetchPositionsForTrader, isMonachad, vaultAddress]);

  const refreshSupporterPositions = useCallback(async () => {
    if (!smartAccountAddress) return;
    setLoadingSupporter(true);
    const positions = await fetchPositionsForTrader(
      smartAccountAddress ?? undefined
    );
    setSupporterPositions(positions);
    setLoadingSupporter(false);
  }, [smartAccountAddress, fetchPositionsForTrader]);

  useEffect(() => {
    refreshLeaderPositions();
  }, [refreshLeaderPositions]);

  useEffect(() => {
    refreshSupporterPositions();
  }, [refreshSupporterPositions]);

  useEffect(() => {
    if (!isMonachad && !connectedAddress) return;

    const interval = setInterval(() => {
      if (isMonachad) {
        refreshLeaderPositions();
      }
      refreshSupporterPositions();
    }, 15_000);

    return () => clearInterval(interval);
  }, [
    connectedAddress,
    isMonachad,
    refreshLeaderPositions,
    refreshSupporterPositions,
  ]);

  const {
    writeContract: writeMatchManager,
    data: leaderTxHash,
    isPending: leaderPending,
    error: leaderError,
  } = useWriteContract();

  const { isSuccess: leaderSuccess, isLoading: leaderConfirming } =
    useWaitForTransactionReceipt({
      hash: leaderTxHash,
      query: { enabled: Boolean(leaderTxHash) },
    });

  const {
    writeContract: writeFundex,
    data: supporterTxHash,
    isPending: supporterPending,
    error: supporterError,
  } = useWriteContract();

  const { isSuccess: supporterSuccess, isLoading: supporterConfirming } =
    useWaitForTransactionReceipt({
      hash: supporterTxHash,
      query: { enabled: Boolean(supporterTxHash) },
    });

  useEffect(() => {
    if (leaderSuccess) {
      refreshLeaderPositions();
    }
  }, [leaderSuccess, refreshLeaderPositions]);

  useEffect(() => {
    if (supporterSuccess) {
      refreshSupporterPositions();
    }
  }, [supporterSuccess, refreshSupporterPositions]);

  const handleCloseLeaderPosition = async (position: PositionViewModel) => {
    if (!monachadAddress || !matchManagerAddress || !fundexAddress) {
      return;
    }

    const calldata = encodeFunctionData({
      abi: FUNDEX_ABI,
      functionName: "closePosition",
      args: [position.positionId, position.assetId],
    });

    writeMatchManager({
      address: matchManagerAddress as Hex,
      abi: MATCH_MANAGER_ABI,
      functionName: "monachadExecuteTrade",
      args: [matchIdBigInt, fundexAddress as Hex, calldata, BigInt(0)],
      account: monachadAddress as Hex,
    });
  };

  const handleCloseSupporterPosition = async (position: PositionViewModel) => {
    if (!connectedAddress) return;

    writeFundex({
      address: fundexAddress as Hex,
      abi: FUNDEX_ABI,
      functionName: "closePosition",
      args: [position.positionId, position.assetId],
      account: connectedAddress as Hex,
    });
  };

  const renderPositionCard = (
    position: PositionViewModel,
    onClose?: (position: PositionViewModel) => void,
    closingDisabled?: boolean
  ) => {
    const pnl = formatPnl(position.pnl);

    return (
      <div
        key={`${position.positionId.toString()}-${position.assetId.toString()}`}
        className="bg-black/40 border border-purple-500/30 rounded-2xl p-4 shadow-xl shadow-purple-500/10 hover:border-purple-400/40 transition"
      >
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-sm uppercase tracking-wide text-purple-200/70">
              {position.assetSymbol}
            </div>
            <div className="text-xs text-white/50">
              ID #{position.positionId.toString()}
            </div>
          </div>
          <span
            className={cn(
              "px-3 py-1 text-xs font-semibold rounded-full",
              position.positionType === "LONG"
                ? "bg-green-500/20 text-green-300 border border-green-500/30"
                : "bg-red-500/20 text-red-300 border border-red-500/30"
            )}
          >
            {position.positionType}
          </span>
        </div>

        <dl className="grid grid-cols-2 gap-3 text-xs text-white/70">
          <div>
            <dt>Collateral</dt>
            <dd className="text-sm text-white">
              {formatEth(position.collateral)}
            </dd>
          </div>
          <div>
            <dt>Size</dt>
            <dd className="text-sm text-white">{formatEth(position.size)}</dd>
          </div>
          <div>
            <dt>Leverage</dt>
            <dd className="text-sm text-white">
              {position.leverage.toString()}x
            </dd>
          </div>
          <div>
            <dt>Entry Price</dt>
            <dd className="text-sm text-white">
              {formatUsd(position.entryPrice)}
            </dd>
          </div>
          <div>
            <dt>Last Price</dt>
            <dd className="text-sm text-white">
              {formatUsd(position.lastPrice)}
            </dd>
          </div>
          <div>
            <dt>Opened</dt>
            <dd className="text-sm text-white">
              {position.openedAt.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </dd>
          </div>
        </dl>

        <div className="mt-4 flex items-center justify-between">
          <div
            className={cn(
              "text-sm font-semibold",
              pnl.positive ? "text-emerald-400" : "text-rose-400"
            )}
          >
            {pnl.display}
          </div>
          {onClose && (
            <button
              onClick={() => onClose(position)}
              disabled={closingDisabled}
              className="px-3 py-2 text-xs font-semibold rounded-lg bg-purple-500/30 hover:bg-purple-500/50 border border-purple-400/30 text-white transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {closingDisabled ? "Pending..." : "Close Position"}
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <section className="relative mt-14">
      <div className="pointer-events-none absolute inset-0 -z-10 flex items-center justify-center opacity-60">
        <div className="relative h-72 w-full max-w-4xl">
          {memeAssets.map((asset, index) => (
            <Image
              key={asset.src}
              src={asset.src}
              alt="Meme mascot"
              width={asset.size}
              height={asset.size}
              className={cn(
                "absolute drop-shadow-[0_0_40px_rgba(168,85,247,0.45)]",
                index === 0 && "left-0 top-8 rotate-[-8deg]",
                index === 1 && "right-8 top-0 rotate-[7deg]",
                index === 2 && "left-1/2 -translate-x-1/2 bottom-0 rotate-3"
              )}
            />
          ))}
        </div>
      </div>

      <div className="mb-6 text-center">
        <h2 className="text-3xl font-bold text-white tracking-tight">
          Live Position Command Center
        </h2>
        <p className="mt-2 text-sm text-purple-100/80">
          Real-time vault intel, meme-fueled energy, and high-velocity exit
          buttons for Monachads and their legion.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-3xl border border-purple-500/40 bg-gradient-to-br from-purple-900/40 via-purple-800/30 to-black/40 p-6 shadow-2xl shadow-purple-500/20">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-xl font-semibold text-white">
                Monachad Vault Plays
              </h3>
              <p className="text-xs text-white/60 mt-1">
                Close positions straight from your match vault. PnL shown live
                with on-chain pricing.
              </p>
            </div>
            <span className="rounded-full border border-emerald-400/60 bg-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-200">
              Leader Mode
            </span>
          </div>

          {!isMonachad && (
            <p className="mt-6 rounded-xl border border-dashed border-white/20 bg-black/40 p-4 text-sm text-white/60">
              Connect with your Monachad wallet to unlock the vault command
              center.
            </p>
          )}

          {isMonachad && !vaultAddress && (
            <p className="mt-6 rounded-xl border border-yellow-500/40 bg-yellow-500/10 p-4 text-xs text-yellow-100">
              Vault is spawning... once your match vault is assigned this panel
              will light up.
            </p>
          )}

          {isMonachad && vaultAddress && (
            <div className="mt-6 space-y-4">
              {loadingLeader && leaderPositions.length === 0 ? (
                <div className="rounded-2xl border border-purple-500/20 bg-black/30 p-6 text-center text-sm text-white/50">
                  Syncing vault...
                </div>
              ) : leaderPositions.length === 0 ? (
                <div className="rounded-2xl border border-purple-500/20 bg-black/30 p-6 text-center text-sm text-white/50">
                  No open vault positions. Time to farm that green candle
                  energy.
                </div>
              ) : (
                leaderPositions.map((position) =>
                  renderPositionCard(
                    position,
                    handleCloseLeaderPosition,
                    leaderPending || leaderConfirming
                  )
                )
              )}

              {leaderError && (
                <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-200">
                  ⚠️ Failed to close position. Please try again.
                </div>
              )}
              {leaderSuccess && (
                <div className="rounded-xl border border-green-500/40 bg-green-500/10 p-3 text-xs text-green-200">
                  ✅ Position closed successfully!
                </div>
              )}
            </div>
          )}

          <div className="mt-6 flex items-center justify-between rounded-2xl border border-purple-500/20 bg-black/40 p-4 text-xs text-white/60">
            <div>
              Want to resize positions? We&apos;re drafting a MemeFi-friendly
              adjuster UI. Sit tight or spam the fake buttons 👉
            </div>
            <div className="flex gap-2">
              <button className="rounded-lg border border-white/10 bg-white/10 px-3 py-1 text-[11px] uppercase tracking-wide text-white/70">
                Nuke 25%
              </button>
              <button className="rounded-lg border border-white/10 bg-white/10 px-3 py-1 text-[11px] uppercase tracking-wide text-white/70">
                Boost 2x
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-purple-500/40 bg-gradient-to-br from-purple-900/40 via-purple-800/30 to-black/40 p-6 shadow-2xl shadow-purple-500/20">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-xl font-semibold text-white">
                Your Supporter Stack
              </h3>
              <p className="text-xs text-white/60 mt-1">
                Track and close your mirrored positions. Perfect for dodging
                spicy dips.
              </p>
            </div>
            <span className="rounded-full border border-sky-400/60 bg-sky-500/20 px-3 py-1 text-xs font-semibold text-sky-100">
              Supporter Squad
            </span>
          </div>

          {followedMonachadAddress && (
            <div className="mt-4 text-[11px] uppercase tracking-wide text-white/50">
              Following Monachad {followedMonachadAddress.slice(0, 6)}…
            </div>
          )}

          <div className="mt-6 space-y-4">
            {loadingSupporter && supporterPositions.length === 0 ? (
              <div className="rounded-2xl border border-purple-500/20 bg-black/30 p-6 text-center text-sm text-white/50">
                Fetching your current stack...
              </div>
            ) : supporterPositions.length === 0 ? (
              <div className="rounded-2xl border border-purple-500/20 bg-black/30 p-6 text-center text-sm text-white/50">
                No open supporter positions detected. Shadow the Monachad to get
                spicy entries.
              </div>
            ) : (
              supporterPositions.map((position) =>
                renderPositionCard(
                  position,
                  handleCloseSupporterPosition,
                  supporterPending || supporterConfirming
                )
              )
            )}

            {supporterError && (
              <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-200">
                ⚠️ Failed to close position. Please try again.
              </div>
            )}
            {supporterSuccess && (
              <div className="rounded-xl border border-green-500/40 bg-green-500/10 p-3 text-xs text-green-200">
                ✅ Position closed successfully!
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
