"use client";

import { useEffect, useMemo, useState } from "react";
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { encodeFunctionData, Hex, parseEther } from "viem";

interface TradingPanelProps {
  matchId: string;
  allowedDexes: string[];
}

interface DexMeta {
  name: string;
  address: string;
  logo: string;
  description: string;
  supportsTrading: boolean;
  isMatchAllowed: boolean;
}

const KNOWN_DEXES: Omit<DexMeta, "isMatchAllowed">[] = [
  {
    name: "FUNDex",
    address: "0x16b0c1DCF87EBB4e0A0Ba4514FF0782CCE7889Cb",
    logo: "🎲",
    description: "Trade Club's sandbox perpetuals DEX",
    supportsTrading: true,
  },
  {
    name: "Uniswap v2",
    address: "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
    logo: "🦄",
    description: "Classic AMM pools with deep liquidity",
    supportsTrading: false,
  },
  {
    name: "PancakeSwap",
    address: "0x10ED43C718714eb63d5aA57B78B54704E256024E",
    logo: "🥞",
    description: "BNB Chain DEX powerhouse for alt exposure",
    supportsTrading: false,
  },
  {
    name: "SushiSwap",
    address: "0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F",
    logo: "🍣",
    description: "Cross-chain AMM with farm incentives",
    supportsTrading: false,
  },
];

const FUNDEX_ABI = [
  {
    type: "function",
    name: "openPosition",
    stateMutability: "payable",
    inputs: [
      { name: "assetId", type: "uint256" },
      { name: "positionType", type: "uint8" },
      { name: "leverage", type: "uint256" },
    ],
    outputs: [],
  },
] as const;

const MATCH_MANAGER_ABI = [
  {
    type: "function",
    name: "monachadExecuteTrade",
    stateMutability: "nonpayable",
    inputs: [
      { name: "_matchId", type: "uint256" },
      { name: "_target", type: "address" },
      { name: "_calldata", type: "bytes" },
      { name: "_nativeAmount", type: "uint256" },
    ],
    outputs: [],
  },
] as const;

const formatAddress = (value: string) =>
  `${value.slice(0, 6)}…${value.slice(-4)}`;

export default function TradingPanel({
  matchId,
  allowedDexes,
}: TradingPanelProps) {
  const { address } = useAccount();
  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const allowedDexSet = useMemo(
    () => new Set(allowedDexes.map((dex) => dex.toLowerCase())),
    [allowedDexes]
  );

  const decoratedDexes = useMemo<DexMeta[]>(() => {
    const normalizedKnown: DexMeta[] = KNOWN_DEXES.map((dex) => ({
      ...dex,
      isMatchAllowed:
        allowedDexSet.size === 0 ||
        allowedDexSet.has(dex.address.toLowerCase()),
    }));

    const unknownAllowed = allowedDexes
      .filter(
        (dex) =>
          !KNOWN_DEXES.some(
            (known) => known.address.toLowerCase() === dex.toLowerCase()
          )
      )
      .map<DexMeta>((dex) => ({
        name: `Custom DEX (${formatAddress(dex)})`,
        address: dex,
        logo: "🧩",
        description: "Provided by match configuration",
        supportsTrading: false,
        isMatchAllowed: true,
      }));

    return [...normalizedKnown, ...unknownAllowed];
  }, [allowedDexSet, allowedDexes]);

  const firstAllowedDex = useMemo(
    () => decoratedDexes.find((dex) => dex.isMatchAllowed) ?? null,
    [decoratedDexes]
  );

  const [selectedDex, setSelectedDex] = useState<string>(
    firstAllowedDex?.address ?? ""
  );
  const [orderType, setOrderType] = useState<"market" | "limit">("market");
  const [positionType, setPositionType] = useState<"LONG" | "SHORT">("LONG");
  const [assetId, setAssetId] = useState("0");
  const [leverage, setLeverage] = useState("2");
  const [collateral, setCollateral] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (
      selectedDex &&
      decoratedDexes.some(
        (dex) => dex.address === selectedDex && dex.isMatchAllowed
      )
    ) {
      return;
    }

    setSelectedDex(firstAllowedDex?.address ?? "");
  }, [decoratedDexes, firstAllowedDex, selectedDex]);

  useEffect(() => {
    if (!actionError) {
      return;
    }

    const timeout = setTimeout(() => setActionError(null), 7000);
    return () => clearTimeout(timeout);
  }, [actionError]);

  const selectedDexMeta = useMemo(
    () =>
      decoratedDexes.find((dex) => dex.address === selectedDex) ??
      firstAllowedDex,
    [decoratedDexes, firstAllowedDex, selectedDex]
  );

  const isTradingSupported = Boolean(selectedDexMeta?.supportsTrading);

  const handleOpenPosition = async () => {
    setActionError(null);

    if (!selectedDexMeta || !selectedDexMeta.isMatchAllowed) {
      setActionError("Select an allowed DEX before opening a position.");
      return;
    }

    if (!selectedDexMeta.supportsTrading) {
      setActionError(
        `${selectedDexMeta.name} trading integration is coming soon.`
      );
      return;
    }

    if (!address) {
      setActionError("Connect your wallet to trade.");
      return;
    }

    const matchManagerAddress = process.env
      .NEXT_PUBLIC_MATCH_MANAGER_ADDRESS as `0x${string}` | undefined;

    if (!matchManagerAddress) {
      setActionError("NEXT_PUBLIC_MATCH_MANAGER_ADDRESS is not configured.");
      return;
    }

    if (!collateral.trim()) {
      setActionError("Enter collateral to size your position.");
      return;
    }

    try {
      parseEther(collateral);
    } catch (error) {
      setActionError("Collateral must be a valid ETH amount.");
      return;
    }

    let normalizedMatchId: bigint;
    try {
      normalizedMatchId = BigInt(matchId);
    } catch (error) {
      setActionError("Invalid match identifier provided.");
      return;
    }

    let encodedTrade: Hex;
    try {
      encodedTrade = encodeFunctionData({
        abi: FUNDEX_ABI,
        functionName: "openPosition",
        args: [
          BigInt(assetId),
          positionType === "LONG" ? 0 : 1,
          BigInt(leverage),
        ],
      });
    } catch (error) {
      console.error("Failed to encode trade calldata", error);
      setActionError("Unable to encode trade calldata for the selected DEX.");
      return;
    }

    try {
      writeContract({
        address: matchManagerAddress,
        abi: MATCH_MANAGER_ABI,
        functionName: "monachadExecuteTrade",
        args: [
          normalizedMatchId,
          selectedDexMeta.address as Hex,
          encodedTrade,
          parseEther(collateral),
        ],
        account: address,
      });
    } catch (error: any) {
      console.error("Failed to open position", error);
      setActionError(error?.shortMessage ?? "Unable to submit transaction.");
    }
  };

  const positionSizeEth = useMemo(() => {
    if (!collateral || !leverage) {
      return "0";
    }

    const base = Number.parseFloat(collateral);
    const lev = Number.parseFloat(leverage);

    if (!Number.isFinite(base) || !Number.isFinite(lev)) {
      return "0";
    }

    return (base * lev).toFixed(4);
  }, [collateral, leverage]);

  return (
    <div className="card space-y-6 bg-slate-900/70 border border-slate-700/60">
      <header className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-semibold text-white">Trading Controls</h3>
          <span className="text-xs text-slate-400 uppercase tracking-wide">
            Match #{matchId.slice(0, 6)}
          </span>
        </div>
        <p className="text-sm text-slate-400">
          Execute positions on the match-approved DEX list. Collateral is posted
          via the delegated smart account tied to your entry.
        </p>
      </header>

      <section className="space-y-3">
        <label className="text-sm font-semibold text-slate-300">
          Select DEX
        </label>
        <div className="grid md:grid-cols-2 gap-2">
          {decoratedDexes.map((dex) => {
            const isActive = selectedDex === dex.address;
            const isAllowed = dex.isMatchAllowed;

            return (
              <button
                key={dex.address}
                onClick={() => {
                  if (!isAllowed) {
                    return;
                  }
                  setSelectedDex(dex.address);
                }}
                disabled={!isAllowed}
                className={`flex flex-col items-start gap-2 rounded-lg border p-3 text-left transition ${
                  isAllowed
                    ? isActive
                      ? "bg-purple-600/30 border-purple-500 text-white"
                      : "bg-slate-800/50 border-slate-700/50 text-slate-200 hover:bg-slate-700/50"
                    : "bg-slate-900/40 border-slate-800/80 text-slate-600 cursor-not-allowed"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{dex.logo}</span>
                  <div>
                    <p className="text-sm font-semibold">{dex.name}</p>
                    <p className="text-xs text-slate-400">{dex.description}</p>
                  </div>
                </div>
                <span className="text-[11px] uppercase tracking-wide text-slate-500">
                  {isAllowed
                    ? dex.supportsTrading
                      ? "Enabled"
                      : "View only (integration soon)"
                    : "Not enabled for this match"}
                </span>
              </button>
            );
          })}
        </div>
        {selectedDexMeta && (
          <p className="text-xs text-slate-500">
            Using {selectedDexMeta.name}
            {selectedDexMeta.supportsTrading
              ? " — positions execute via the match's delegated smart account."
              : ` — trading disabled (address ${formatAddress(
                  selectedDexMeta.address
                )}).`}
          </p>
        )}
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-300">Asset</label>
          <select
            value={assetId}
            onChange={(event) => setAssetId(event.target.value)}
            className="w-full rounded-lg border border-slate-700/50 bg-slate-800/50 px-4 py-3 text-white focus:border-purple-500/50 focus:outline-none"
          >
            <option value="0">BTC/USD</option>
            <option value="1">ETH/USD</option>
            <option value="2">SOL/USD</option>
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-300">
            Order Type
          </label>
          <div className="flex gap-2">
            <button
              onClick={() => setOrderType("market")}
              className={`flex-1 rounded-lg border py-3 text-sm font-semibold transition ${
                orderType === "market"
                  ? "bg-blue-600/30 border-blue-500 text-white"
                  : "bg-slate-800/50 border-slate-700/50 text-slate-400 hover:bg-slate-700/50"
              }`}
            >
              Market
            </button>
            <button
              onClick={() => setOrderType("limit")}
              className={`flex-1 rounded-lg border py-3 text-sm font-semibold transition ${
                orderType === "limit"
                  ? "bg-blue-600/30 border-blue-500 text-white"
                  : "bg-slate-800/50 border-slate-700/50 text-slate-400 hover:bg-slate-700/50"
              }`}
            >
              Limit
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-300">
            Position
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setPositionType("LONG")}
              className={`rounded-lg border py-3 transition ${
                positionType === "LONG"
                  ? "bg-green-600/30 border-green-500 text-white"
                  : "bg-slate-800/50 border-slate-700/50 text-slate-400 hover:bg-slate-700/50"
              }`}
            >
              <div className="text-2xl">📈</div>
              <div className="text-sm font-semibold">LONG</div>
            </button>
            <button
              onClick={() => setPositionType("SHORT")}
              className={`rounded-lg border py-3 transition ${
                positionType === "SHORT"
                  ? "bg-red-600/30 border-red-500 text-white"
                  : "bg-slate-800/50 border-slate-700/50 text-slate-400 hover:bg-slate-700/50"
              }`}
            >
              <div className="text-2xl">📉</div>
              <div className="text-sm font-semibold">SHORT</div>
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <label className="flex items-center justify-between text-sm font-semibold text-slate-300">
            <span>Leverage</span>
            <span className="text-purple-400">{leverage}x</span>
          </label>
          <input
            type="range"
            min="1"
            max="20"
            step="1"
            value={leverage}
            onChange={(event) => setLeverage(event.target.value)}
            className="w-full accent-purple-500"
          />
        </div>
      </section>

      <section className="space-y-2">
        <label className="text-sm font-semibold text-slate-300">
          Collateral (ETH)
        </label>
        <input
          type="number"
          step="0.0001"
          min="0"
          value={collateral}
          onChange={(event) => setCollateral(event.target.value)}
          placeholder="0.00"
          className="w-full rounded-lg border border-slate-700/50 bg-slate-800/50 px-4 py-3 text-white placeholder-slate-500 focus:border-purple-500/50 focus:outline-none"
        />
        {selectedDexMeta && (
          <p className="text-xs text-slate-500">
            Collateral routes to {selectedDexMeta.name} via match escrow.
          </p>
        )}
      </section>

      <section className="space-y-3">
        <button
          onClick={handleOpenPosition}
          disabled={
            !collateral ||
            isPending ||
            isConfirming ||
            !isTradingSupported ||
            !selectedDexMeta?.isMatchAllowed
          }
          className={`w-full rounded-lg py-4 text-lg font-bold text-white transition disabled:cursor-not-allowed disabled:opacity-50 ${
            positionType === "LONG"
              ? "bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
              : "bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700"
          }`}
        >
          {isPending || isConfirming ? (
            <span className="flex items-center justify-center gap-2">
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              Processing...
            </span>
          ) : (
            `Open ${positionType} Position`
          )}
        </button>

        {actionError && (
          <div className="rounded-lg border border-red-500/40 bg-red-900/20 p-3 text-sm text-red-200">
            {actionError}
          </div>
        )}

        {isSuccess && (
          <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-3 text-center text-sm text-green-300">
            ✅ Position submitted. Await settlement on-chain.
          </div>
        )}

        {!isTradingSupported && selectedDexMeta?.isMatchAllowed && (
          <div className="rounded-lg border border-slate-700/60 bg-slate-800/70 p-3 text-xs text-slate-300">
            Trading on {selectedDexMeta.name} is not yet supported. You can
            review match analytics while integrations come online.
          </div>
        )}
      </section>

      <section className="space-y-2 border-t border-slate-700/50 pt-4 text-sm">
        <div className="flex justify-between text-slate-300">
          <span>Position Size</span>
          <span className="text-white font-semibold">
            {positionSizeEth} ETH
          </span>
        </div>
        <div className="flex justify-between text-slate-300">
          <span>Liquidation Price</span>
          <span className="text-white font-semibold">Coming soon</span>
        </div>
      </section>
    </div>
  );
}
