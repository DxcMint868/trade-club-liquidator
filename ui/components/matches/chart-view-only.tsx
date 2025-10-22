"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
  },
  {
    id: "BTC",
    name: "Bitcoin",
    apiId: "BTC",
    coinGeckoId: "bitcoin",
    imageUrl: "",
  },
  {
    id: "SOL",
    name: "Solana",
    apiId: "SOL",
    coinGeckoId: "solana",
    imageUrl: "",
  },
  {
    id: "LINK",
    name: "Chainlink",
    apiId: "LINK",
    coinGeckoId: "chainlink",
    imageUrl: "",
  },
  {
    id: "MON",
    name: "Monad",
    apiId: "APT",
    coinGeckoId: "aptos",
    imageUrl: "/MONlogo.jpg",
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

interface ChartViewOnlyProps {
  matchId: string;
}

export function ChartViewOnly({ matchId }: ChartViewOnlyProps) {
  const [selectedAsset, setSelectedAsset] = useState("BTC");
  const [chartData, setChartData] = useState<any[]>([]);
  const [timeInterval, setTimeInterval] = useState("1H");
  const [assets, setAssets] = useState<any[]>([]);
  const [assetsLoading, setAssetsLoading] = useState(true);
  const seriesRef = useRef<any>(null);

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

  const selectedAssetData = assets.find((a) => a.id === selectedAsset);

  return (
    <div className="bg-black/40 backdrop-blur-md border border-purple-500/20 rounded-2xl p-4 shadow-2xl">
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
      
      {/* Spectator Badge */}
      <div className="mt-4 p-4 bg-purple-500/10 border border-purple-500/30 rounded-lg">
        <div className="flex items-center gap-3">
          <span className="text-2xl">👁️</span>
          <div>
            <p className="text-sm font-semibold text-purple-300">Spectator Mode</p>
            <p className="text-xs text-white/60">
              You're following this match. Your copy trades execute automatically!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
