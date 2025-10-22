"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { getActiveDexes } from "@/lib/dex-registry";
import { parseEther, formatEther, encodeFunctionData } from "viem";
import { Hex } from "viem";
import { FUNDEX_ABI } from "@/lib/fundex";

const TradingChart = dynamic(() => import("@/components/trading-chart"), {
  ssr: false,
});

const initialAssets = [
  {
    id: "ETH",
    name: "Ethereum",
    apiId: "ETH",
    coinGeckoId: "ethereum",
    imageUrl: "",
    onChainId: 1,
  },
  {
    id: "BTC",
    name: "Bitcoin",
    apiId: "BTC",
    coinGeckoId: "bitcoin",
    imageUrl: "",
    onChainId: 2,
  },
  {
    id: "SOL",
    name: "Solana",
    apiId: "SOL",
    coinGeckoId: "solana",
    imageUrl: "",
    onChainId: 3,
  },
  {
    id: "LINK",
    name: "Chainlink",
    apiId: "LINK",
    coinGeckoId: "chainlink",
    imageUrl: "",
    onChainId: 4,
  },
  {
    id: "MON",
    name: "Monad",
    apiId: "APT",
    coinGeckoId: "aptos",
    imageUrl: "/MONlogo.jpg",
    onChainId: 5,
  },
];

const getIntervalInMilliseconds = (interval: string) => {
  const unit = interval.slice(-1);
  const value = parseInt(interval.slice(0, -1));
  switch (unit) {
    case "m":
      return value * 60 * 1000;
    case "H":
      return value * 60 * 60 * 1000;
    case "D":
      return value * 24 * 60 * 60 * 1000;
    default:
      return 60 * 60 * 1000;
  }
};

const formatPrice = (price: number) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(price);
};

interface DexMeta {
  id: string;
  name: string;
  icon: string;
}

const activeDexes = getActiveDexes();

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

interface MatchTradingViewProps {
  matchId: string;
  allowedDexes: string[];
  fundexAddress: string;
  matchManagerAddress: string;
  onTradeSuccess?: () => void;
}

export function MatchTradingView({
  matchId,
  allowedDexes,
  fundexAddress,
  matchManagerAddress,
  onTradeSuccess,
}: MatchTradingViewProps) {
  const [positionType, setPositionType] = useState("long");
  const [orderType, setOrderType] = useState("market");
  const [selectedAsset, setSelectedAsset] = useState("BTC");
  const [leverage, setLeverage] = useState(10);
  const [chartData, setChartData] = useState<any[]>([]);
  const [timeInterval, setTimeInterval] = useState("1H");
  const [assets, setAssets] = useState<any[]>([]);
  const [assetsLoading, setAssetsLoading] = useState(true);
  const [selectedDex, setSelectedDex] = useState(allowedDexes[0] || "");
  const [amount, setAmount] = useState("");
  const [selectedAssetOnChainId, setSelectedAssetOnChainId] = useState(2); // Default to BTC
  const seriesRef = useRef<any>(null);

  const { address } = useAccount();
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  useEffect(() => {
    console.log("Selected asset: ", selectedAsset);
    const asset = initialAssets.find((a) => a.id === selectedAsset);
    if (asset) {
      setSelectedAssetOnChainId(asset!.onChainId!);
    }
  }, [selectedAsset]);

  // Fetch asset images
  useEffect(() => {
    const fetchAssets = async () => {
      setAssetsLoading(true);
      const coingeckoAssets = initialAssets.filter((a) => a.id !== "MON");
      const monadAsset = initialAssets.find((a) => a.id === "MON");

      try {
        const idsToFetch = coingeckoAssets.map((a) => a.coinGeckoId).join(",");
        const response = await fetch(
          `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${idsToFetch}`
        );
        const data = await response.json();

        const updatedCoinGeckoAssets = coingeckoAssets.map((asset) => {
          const coinData = data.find((d: any) => d.id === asset.coinGeckoId);
          if (coinData) {
            return { ...asset, imageUrl: coinData.image };
          }
          return asset;
        });

        setAssets([...updatedCoinGeckoAssets, monadAsset!]);
      } catch (error) {
        console.error("Failed to fetch asset images:", error);
        setAssets(initialAssets);
      } finally {
        setAssetsLoading(false);
      }
    };
    fetchAssets();
  }, []);

  // Fetch chart data
  useEffect(() => {
    if (assetsLoading) return;
    const fetchHistoricalData = async () => {
      const asset = assets.find((a) => a.id === selectedAsset);
      if (!asset) return;

      const now = new Date();
      const intervalMs = getIntervalInMilliseconds(timeInterval);
      const startTime = now.getTime() - 180 * intervalMs;

      try {
        const response = await fetch("https://api.hyperliquid.xyz/info", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "candleSnapshot",
            req: {
              coin: asset.apiId,
              interval: timeInterval.toLowerCase(),
              startTime: startTime,
              endTime: now.getTime(),
            },
          }),
        });
        const data = await response.json();
        const formattedData = data.map((d: any) => ({
          time: Math.floor(new Date(d.t).getTime() / 1000),
          open: parseFloat(d.o),
          high: parseFloat(d.h),
          low: parseFloat(d.l),
          close: parseFloat(d.c),
        }));
        setChartData(formattedData);
      } catch (error) {
        console.error("Failed to fetch chart data:", error);
      }
    };

    fetchHistoricalData();
  }, [selectedAsset, timeInterval, assets, assetsLoading]);

  const onSeriesCreated = useCallback((series: any) => {
    seriesRef.current = series;
  }, []);

  // WebSocket for real-time updates
  useEffect(() => {
    if (assetsLoading || !seriesRef.current || chartData.length === 0) return;
    const asset = assets.find((a) => a.id === selectedAsset);
    if (!asset) return;

    const ws = new WebSocket("wss://api.hyperliquid.xyz/ws");

    ws.onopen = () => {
      ws.send(
        JSON.stringify({
          method: "subscribe",
          subscription: { type: "trades", coin: asset.apiId },
        })
      );
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.channel === "trades" && data.data.length > 0) {
        const trade = data.data[0];
        const price = parseFloat(trade.px);
        const last = chartData[chartData.length - 1];
        if (last) {
          const newPoint = {
            ...last,
            close: price,
            high: Math.max(last.high, price),
            low: Math.min(last.low, price),
            time: last.time,
          };
          seriesRef.current.update(newPoint);
        }
      }
    };

    ws.onclose = () => {
      console.log("WebSocket disconnected");
    };

    return () => {
      ws.close();
    };
  }, [selectedAsset, chartData, assets, assetsLoading]);

  const handleTrade = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      alert("Please enter a valid amount");
      return;
    }

    try {
      // Encode swap call for FUNdex
      let encodedTrade: Hex;
      console.log("selectedDex:", selectedDex);
      console.log("selectedAssetOnChainId: ", selectedAssetOnChainId);
      console.log("Leverage: ", leverage);
      encodedTrade = encodeFunctionData({
        abi: FUNDEX_ABI,
        functionName: "openPosition",
        args: [
          BigInt(selectedAssetOnChainId),
          positionType === "LONG" ? 0 : 1,
          BigInt(leverage),
        ],
      });

      // Execute trade through MatchManager
      console.log("selectedDex: ", selectedDex);
      writeContract({
        address: matchManagerAddress as Hex,
        abi: MATCH_MANAGER_ABI,
        functionName: "monachadExecuteTrade",
        args: [
          BigInt(matchId),
          selectedDex as Hex,
          encodedTrade,
          parseEther(amount),
        ],
        account: address,
      });
    } catch (err) {
      console.error("Trade failed:", err);
    }
  };

  useEffect(() => {
    if (isSuccess && onTradeSuccess) {
      onTradeSuccess();
    }
  }, [isSuccess, onTradeSuccess]);

  const selectedAssetData = assets.find((a) => a.id === selectedAsset);
  const filteredDexes = Object.values(activeDexes).filter((dex) =>
    allowedDexes.includes(dex.address.toLowerCase())
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Chart Section */}
      <div className="lg:col-span-2 bg-black/40 backdrop-blur-md border border-purple-500/20 rounded-2xl p-4 shadow-2xl">
        <div className="flex items-center mb-4">
          {assetsLoading ? (
            <div className="w-[180px] h-10 bg-gray-800/60 rounded-lg animate-pulse"></div>
          ) : (
            <Select value={selectedAsset} onValueChange={setSelectedAsset}>
              <SelectTrigger className="w-[180px] bg-transparent border-purple-500/30 text-white">
                <div className="flex items-center gap-2">
                  {selectedAssetData && (
                    <img
                      src={selectedAssetData.imageUrl}
                      alt={selectedAssetData.name}
                      className="w-6 h-6"
                    />
                  )}
                  <span>{selectedAssetData?.id}</span>
                </div>
              </SelectTrigger>
              <SelectContent className="bg-[#080413] border-purple-500/30 text-white">
                {assets.map((asset) => (
                  <SelectItem key={asset.id} value={asset.id}>
                    <div className="flex items-center gap-3">
                      {asset.imageUrl && (
                        <img
                          src={asset.imageUrl}
                          alt={asset.name}
                          className="w-6 h-6"
                        />
                      )}
                      <span>{asset.name}</span>
                      <span className="text-white/50">{asset.id}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {chartData.length > 0 && (
            <div className="ml-6 text-white">
              <div className="text-2xl font-bold text-green-400">
                {formatPrice(chartData[chartData.length - 1].close)}
              </div>
              <div className="text-sm text-white/60">
                24h Change: <span className="text-red-400">-2.5%</span>
              </div>
            </div>
          )}
        </div>
        <div className="flex space-x-2 mb-2">
          {["1m", "5m", "15m", "1H", "4H", "1D"].map((interval) => (
            <button
              key={interval}
              onClick={() => setTimeInterval(interval)}
              className={`px-3 py-1 text-xs rounded-md transition-colors ${
                timeInterval === interval
                  ? "bg-purple-500/40 text-white"
                  : "text-white/60 bg-black/20 hover:bg-purple-500/20 hover:text-white"
              }`}
            >
              {interval}
            </button>
          ))}
        </div>
        <div className="h-[500px]">
          {chartData.length > 0 ? (
            <TradingChart data={chartData} onSeriesCreated={onSeriesCreated} />
          ) : (
            <div className="flex items-center justify-center h-full text-white/50">
              Loading chart data...
            </div>
          )}
        </div>
      </div>

      {/* Trade Panel Section */}
      <div className="bg-black/40 backdrop-blur-md border border-purple-500/20 rounded-2xl p-6 shadow-2xl">
        <h2 className="text-2xl font-bold text-purple-300 mb-6">
          Match Trading
        </h2>

        <div className="grid grid-cols-2 gap-3 mb-6">
          <button
            onClick={() => setPositionType("long")}
            className={`py-3 rounded-lg font-semibold transition-all ${
              positionType === "long"
                ? "bg-green-600 text-white shadow-[0_0_15px_rgba(38,166,154,0.5)]"
                : "bg-gray-800/60 text-gray-400 hover:bg-gray-700/80"
            }`}
          >
            Long
          </button>
          <button
            onClick={() => setPositionType("short")}
            className={`py-3 rounded-lg font-semibold transition-all ${
              positionType === "short"
                ? "bg-red-600 text-white shadow-[0_0_15px_rgba(239,83,80,0.5)]"
                : "bg-gray-800/60 text-gray-400 hover:bg-gray-700/80"
            }`}
          >
            Short
          </button>
        </div>

        <div className="flex justify-center gap-4 mb-6">
          <button
            onClick={() => setOrderType("market")}
            className={`text-sm font-medium transition-colors ${
              orderType === "market"
                ? "text-purple-400"
                : "text-white/50 hover:text-white"
            }`}
          >
            Market
          </button>
          <button
            onClick={() => setOrderType("limit")}
            className={`text-sm font-medium transition-colors ${
              orderType === "limit"
                ? "text-purple-400"
                : "text-white/50 hover:text-white"
            }`}
          >
            Limit
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">
              DEX
            </label>
            <Select value={selectedDex} onValueChange={setSelectedDex}>
              <SelectTrigger className="w-full bg-black/40 border border-purple-500/30 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#080413] border-purple-500/30 text-white">
                {filteredDexes.map((dex) => (
                  <SelectItem key={dex.address} value={dex.address}>
                    <div className="flex items-center gap-2">
                      <img src={dex.icon} alt={dex.name} className="w-5 h-5" />
                      <span>{dex.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {orderType === "limit" && (
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">
                Price (USD)
              </label>
              <input
                type="number"
                placeholder="0.00"
                className="w-full px-4 py-3 bg-black/40 border border-purple-500/30 rounded-lg focus:outline-none focus:border-purple-400 text-white"
              />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">
              Amount (ETH)
            </label>
            <input
              type="number"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full px-4 py-3 bg-black/40 border border-purple-500/30 rounded-lg focus:outline-none focus:border-purple-400 text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">
              Leverage: {leverage}x
            </label>
            <input
              type="range"
              min="1"
              max="100"
              value={leverage}
              onChange={(e) => setLeverage(parseInt(e.target.value))}
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
            />
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-purple-500/20 space-y-3 text-sm">
          <div className="flex justify-between text-white/70">
            <span>Margin</span>
            <span>{amount || "0.00"} ETH</span>
          </div>
          <div className="flex justify-between text-white/70">
            <span>Leverage</span>
            <span>{leverage}x</span>
          </div>
          <div className="flex justify-between text-white/70">
            <span>Position Size</span>
            <span className="text-white font-semibold">
              {amount && !isNaN(parseFloat(amount))
                ? (parseFloat(amount) * leverage).toFixed(4)
                : "0.00"}{" "}
              ETH
            </span>
          </div>
          <div className="flex justify-between text-white/70">
            <span>Match ID</span>
            <span>#{matchId}</span>
          </div>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
            {error.message}
          </div>
        )}

        {isSuccess && (
          <div className="mt-4 p-3 bg-green-500/10 border border-green-500/30 rounded-lg text-green-400 text-sm">
            Trade executed successfully!
          </div>
        )}

        <button
          onClick={handleTrade}
          disabled={isPending || isConfirming || !address}
          className={`w-full mt-6 py-4 rounded-lg font-semibold text-white transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed ${
            positionType === "long"
              ? "bg-green-600 hover:bg-green-500 shadow-[0_0_20px_rgba(38,166,154,0.6)]"
              : "bg-red-600 hover:bg-red-500 shadow-[0_0_20px_rgba(239,83,80,0.6)]"
          }`}
        >
          {isPending || isConfirming
            ? "Processing..."
            : `Place ${positionType === "long" ? "Long" : "Short"} Order`}
        </button>
      </div>
    </div>
  );
}
