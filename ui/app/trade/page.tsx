"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import dynamic from 'next/dynamic';
import { Navigation } from "@/components/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const TradingChart = dynamic(() => import('@/components/trading-chart'), { ssr: false });

const initialAssets = [
  { id: "BTC", name: "Bitcoin", apiId: 'BTC', coinGeckoId: 'bitcoin', imageUrl: '' },
  { id: "ETH", name: "Ethereum", apiId: 'ETH', coinGeckoId: 'ethereum', imageUrl: '' },
  { id: "SOL", name: "Solana", apiId: 'SOL', coinGeckoId: 'solana', imageUrl: '' },
  { id: "LINK", name: "Chainlink", apiId: 'LINK', coinGeckoId: 'chainlink', imageUrl: '' },
  { id: "MON", name: "Monad", apiId: 'APT', coinGeckoId: 'aptos', imageUrl: '/MONlogo.jpg' }, // Using local logo for MON
];

const getIntervalInMilliseconds = (interval) => {
    const unit = interval.slice(-1);
    const value = parseInt(interval.slice(0, -1));
    switch (unit) {
        case 'm': return value * 60 * 1000;
        case 'H': return value * 60 * 60 * 1000;
        case 'D': return value * 24 * 60 * 60 * 1000;
        default: return 60 * 60 * 1000; // Default to 1 hour
    }
};

const formatPrice = (price) => {
    return new Intl.NumberFormat('en-US', { 
        style: 'currency', 
        currency: 'USD', 
        minimumFractionDigits: 2, 
        maximumFractionDigits: 2 
    }).format(price);
}

export default function TradePage() {
  const [positionType, setPositionType] = useState("long");
  const [orderType, setOrderType] = useState("market");
  const [selectedAsset, setSelectedAsset] = useState("BTC");
  const [leverage, setLeverage] = useState(10);
  const [activeTab, setActiveTab] = useState('positions');
  const [chartData, setChartData] = useState([]);
  const [timeInterval, setTimeInterval] = useState('1H');
  const [assets, setAssets] = useState([]);
  const [assetsLoading, setAssetsLoading] = useState(true);
  const seriesRef = useRef(null);

  const currentColor = "#a855f7"; // Always purple

  useEffect(() => {
    const fetchAssets = async () => {
        setAssetsLoading(true);
        const coingeckoAssets = initialAssets.filter(a => a.id !== 'MON');
        const monadAsset = initialAssets.find(a => a.id === 'MON');

        try {
            const idsToFetch = coingeckoAssets.map(a => a.coinGeckoId).join(',');
            const response = await fetch(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${idsToFetch}`);
            const data = await response.json();
            
            const updatedCoinGeckoAssets = coingeckoAssets.map(asset => {
                const coinData = data.find(d => d.id === asset.coinGeckoId);
                if (coinData) {
                    return { ...asset, imageUrl: coinData.image };
                }
                return asset;
            });

            setAssets([...updatedCoinGeckoAssets, monadAsset]);

        } catch (error) {
            console.error("Failed to fetch asset images:", error);
            setAssets(initialAssets); // Fallback to initial assets
        } finally {
            setAssetsLoading(false);
        }
    };
    fetchAssets();
  }, []);

  useEffect(() => {
    if (assetsLoading) return;
    const fetchHistoricalData = async () => {
      const asset = assets.find(a => a.id === selectedAsset);
      if (!asset) return;

      const now = new Date();
      const intervalMs = getIntervalInMilliseconds(timeInterval);
      const startTime = now.getTime() - (180 * intervalMs);

      try {
        const response = await fetch('https://api.hyperliquid.xyz/info', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({
            type: 'candleSnapshot',
            req: {
              coin: asset.apiId,
              interval: timeInterval.toLowerCase(),
              startTime: startTime,
              endTime: now.getTime(),
            },
          }),
        });
        const data = await response.json();
        const formattedData = data.map(d => ({
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

  const onSeriesCreated = useCallback((series) => {
    seriesRef.current = series;
  }, []);

  useEffect(() => {
    if (assetsLoading || !seriesRef.current || chartData.length === 0) return;
    const asset = assets.find(a => a.id === selectedAsset);
    if (!asset) return;

    const ws = new WebSocket('wss://api.hyperliquid.xyz/ws');

    ws.onopen = () => {
      ws.send(JSON.stringify({ method: 'subscribe', subscription: { type: 'trades', coin: asset.apiId } }));
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.channel === 'trades' && data.data.length > 0) {
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
      console.log('WebSocket disconnected');
    };

    return () => {
      ws.close();
    };
  }, [selectedAsset, chartData, assets, assetsLoading]);

  const selectedAssetData = assets.find(a => a.id === selectedAsset);

  return (
    <main className="relative min-h-screen">
      <div className="absolute inset-0 bg-gradient-to-b from-[#080413] via-[#060310] via-30% to-[#04020d] to-black" />
      
      <div className="relative z-10">
        <Navigation color={currentColor} />
        
        <div className="pt-24 px-4 sm:px-6 lg:px-8">
          <div className="max-w-8xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
              {/* Chart Section */}
              <div className="lg:col-span-2 bg-black/40 backdrop-blur-md border border-purple-500/20 rounded-2xl p-4 shadow-2xl">
                <div className="flex items-center mb-4">
                    {assetsLoading ? (
                        <div className="w-[180px] h-10 bg-gray-800/60 rounded-lg animate-pulse"></div>
                    ) : (
                        <Select value={selectedAsset} onValueChange={setSelectedAsset}>
                            <SelectTrigger className="w-[180px] bg-transparent border-purple-500/30 text-white">
                                <div className="flex items-center gap-2">
                                    {selectedAssetData && <img src={selectedAssetData.imageUrl} alt={selectedAssetData.name} className="w-6 h-6" />}
                                    <span>{selectedAssetData?.id}</span>
                                </div>
                            </SelectTrigger>
                            <SelectContent className="bg-[#080413] border-purple-500/30 text-white">
                            {assets.map(asset => (
                                <SelectItem key={asset.id} value={asset.id}>
                                    <div className="flex items-center gap-3">
                                        {asset.imageUrl && <img src={asset.imageUrl} alt={asset.name} className="w-6 h-6" />}
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
                        <div className="text-2xl font-bold text-green-400">{formatPrice(chartData[chartData.length - 1].close)}</div>
                        <div className="text-sm text-white/60">24h Change: <span className="text-red-400">-2.5%</span></div>
                    </div>
                  )}
                </div>
                <div className="flex space-x-2 mb-2">
                  {['1m', '5m', '15m', '1H', '4H', '1D'].map(interval => (
                    <button key={interval} onClick={() => setTimeInterval(interval)} className={`px-3 py-1 text-xs rounded-md transition-colors ${timeInterval === interval ? 'bg-purple-500/40 text-white' : 'text-white/60 bg-black/20 hover:bg-purple-500/20 hover:text-white'}`}>
                      {interval}
                    </button>
                  ))}
                </div>
                <div className="h-[500px]">
                  {chartData.length > 0 ? <TradingChart data={chartData} onSeriesCreated={onSeriesCreated} /> : <div className="flex items-center justify-center h-full text-white/50">Loading chart data...</div>}
                </div>
              </div>

              {/* Trade Panel Section */}
              <div className="bg-black/40 backdrop-blur-md border border-purple-500/20 rounded-2xl p-6 shadow-2xl">
                <h2 className="text-2xl font-bold text-purple-300 mb-6">FUNDex</h2>
                
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
                    <button onClick={() => setOrderType('market')} className={`text-sm font-medium transition-colors ${orderType === 'market' ? 'text-purple-400' : 'text-white/50 hover:text-white'}`}>Market</button>
                    <button onClick={() => setOrderType('limit')} className={`text-sm font-medium transition-colors ${orderType === 'limit' ? 'text-purple-400' : 'text-white/50 hover:text-white'}`}>Limit</button>
                </div>

                <div className="space-y-4">
                  {orderType === 'limit' && (
                    <div>
                      <label className="block text-sm font-medium text-white/70 mb-2">Price (USD)</label>
                      <input type="number" placeholder="0.00" className="w-full px-4 py-3 bg-black/40 border border-purple-500/30 rounded-lg focus:outline-none focus:border-purple-400 text-white" />
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-white/70 mb-2">Amount (ETH)</label>
                    <input type="number" placeholder="0.00" className="w-full px-4 py-3 bg-black/40 border border-purple-500/30 rounded-lg focus:outline-none focus:border-purple-400 text-white" />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-white/70 mb-2">Leverage: {leverage}x</label>
                    <input type="range" min="1" max="100" value={leverage} onChange={e => setLeverage(parseInt(e.target.value))} className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500" />
                  </div>
                </div>

                <div className="mt-6 pt-6 border-t border-purple-500/20 space-y-3 text-sm">
                    <div className="flex justify-between text-white/70"><span>Position Size</span><span>0.00 ETH</span></div>
                    <div className="flex justify-between text-white/70"><span>Margin</span><span>$0.00</span></div>
                    <div className="flex justify-between text-white/70"><span>Fees</span><span>$0.00</span></div>
                </div>

                <button
                  className={`w-full mt-6 py-4 rounded-lg font-semibold text-white transition-all duration-300 ${
                    positionType === "long"
                      ? "bg-green-600 hover:bg-green-500 shadow-[0_0_20px_rgba(38,166,154,0.6)]"
                      : "bg-red-600 hover:bg-red-500 shadow-[0_0_20px_rgba(239,83,80,0.6)]"
                  }`}
                >
                  Place {positionType === "long" ? "Long" : "Short"} Order
                </button>
              </div>
            </div>

            {/* Order Management Section */}
            <div className="mt-6 bg-black/40 backdrop-blur-md border border-purple-500/20 rounded-2xl p-6 shadow-2xl">
              <div className="flex justify-between items-center mb-4">
                <div className="flex space-x-6 border-b border-purple-500/20">
                  <button onClick={() => setActiveTab('positions')} className={`pb-2 text-sm font-medium transition-colors ${activeTab === 'positions' ? 'text-purple-400 border-b-2 border-purple-400' : 'text-white/50 hover:text-white'}`}>Positions (1)</button>
                  <button onClick={() => setActiveTab('orders')} className={`pb-2 text-sm font-medium transition-colors ${activeTab === 'orders' ? 'text-purple-400 border-b-2 border-purple-400' : 'text-white/50 hover:text-white'}`}>Open Orders (2)</button>
                  <button onClick={() => setActiveTab('history')} className={`pb-2 text-sm font-medium transition-colors ${activeTab === 'history' ? 'text-purple-400 border-b-2 border-purple-400' : 'text-white/50 hover:text-white'}`}>Trade History</button>
                </div>
                <div className="flex space-x-4">
                  <button className="text-xs text-red-400 hover:text-red-300">Cancel All Orders</button>
                  <button className="text-xs text-red-400 hover:text-red-300">Close All Positions</button>
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm text-left text-white/80">
                  <thead className="text-xs text-white/60 uppercase border-b border-purple-500/20">
                    <tr>
                      <th scope="col" className="px-6 py-3">Asset</th>
                      <th scope="col" className="px-6 py-3">Side</th>
                      <th scope="col" className="px-6 py-3">Size</th>
                      <th scope="col" className="px-6 py-3">Entry Price</th>
                      <th scope="col" className="px-6 py-3">Mark Price</th>
                      <th scope="col" className="px-6 py-3">PnL</th>
                      <th scope="col" className="px-6 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeTab === 'positions' && (
                      <tr className="border-b border-purple-500/10">
                        <td className="px-6 py-4">ETH/USD</td>
                        <td className="px-6 py-4 text-green-400">Long</td>
                        <td className="px-6 py-4">10.5 ETH</td>
                        <td className="px-6 py-4">$3,450.12</td>
                        <td className="px-6 py-4">$3,512.45</td>
                        <td className="px-6 py-4 text-green-400">+$654.47</td>
                        <td className="px-6 py-4"><button className="text-red-400 hover:text-red-300 text-xs">Close</button></td>
                      </tr>
                    )}
                    {activeTab === 'orders' && (
                      <>
                        <tr className="border-b border-purple-500/10">
                          <td className="px-6 py-4">BTC/USD</td>
                          <td className="px-6 py-4 text-red-400">Short</td>
                          <td className="px-6 py-4">0.5 BTC</td>
                          <td className="px-6 py-4">$68,000.00</td>
                          <td className="px-6 py-4">-</td>
                          <td className="px-6 py-4">-</td>
                          <td className="px-6 py-4"><button className="text-red-400 hover:text-red-300 text-xs">Cancel</button></td>
                        </tr>
                        <tr className="border-b border-purple-500/10">
                          <td className="px-6 py-4">SOL/USD</td>
                          <td className="px-6 py-4 text-green-400">Long</td>
                          <td className="px-6 py-4">100 SOL</td>
                          <td className="px-6 py-4">$150.00</td>
                          <td className="px-6 py-4">-</td>
                          <td className="px-6 py-4">-</td>
                          <td className="px-6 py-4"><button className="text-red-400 hover:text-red-300 text-xs">Cancel</button></td>
                        </tr>
                      </>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
