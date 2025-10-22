"use client";

import { formatEther } from "viem";
import { CopyTradeEvent } from "@/hooks/use-match-events";
import { ExternalLink } from "lucide-react";

interface CopyTradeFeedProps {
  trades: CopyTradeEvent[];
  isConnected: boolean;
}

export function CopyTradeFeed({ trades, isConnected }: CopyTradeFeedProps) {
  if (trades.length === 0) {
    return (
      <div className="bg-black/40 backdrop-blur-md border border-purple-500/20 rounded-2xl p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold text-white">Your Copy Trades</h3>
          <div className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${
                isConnected ? "bg-green-400 animate-pulse" : "bg-red-400"
              }`}
            />
            <span className="text-xs text-white/60">
              {isConnected ? "Live" : "Disconnected"}
            </span>
          </div>
        </div>
        
        <div className="text-center py-12">
          <div className="text-6xl mb-4">📊</div>
          <p className="text-white/60 mb-2">No copy trades yet</p>
          <p className="text-sm text-white/40">
            Your trades will appear here in real-time when your Monachad makes moves!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-black/40 backdrop-blur-md border border-purple-500/20 rounded-2xl p-6 shadow-2xl">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-xl font-semibold text-white">Your Copy Trades</h3>
          <p className="text-xs text-white/50 mt-1">
            {trades.length} trade{trades.length !== 1 ? "s" : ""} executed
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full ${
              isConnected ? "bg-green-400 animate-pulse" : "bg-red-400"
            }`}
          />
          <span className="text-xs text-white/60">
            {isConnected ? "Live" : "Disconnected"}
          </span>
        </div>
      </div>

      <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
        {trades.map((trade, index) => {
          const amount = formatEther(BigInt(trade.amount));
          const timeAgo = getTimeAgo(trade.timestamp);
          const isRecent = Date.now() - trade.timestamp < 5000; // Last 5 seconds

          return (
            <div
              key={`${trade.transactionHash}-${index}`}
              className={`relative p-4 rounded-xl border transition-all ${
                isRecent
                  ? "bg-purple-500/20 border-purple-400/60 animate-pulse-slow"
                  : "bg-black/40 border-purple-500/20 hover:border-purple-400/40"
              }`}
            >
              {isRecent && (
                <div className="absolute -top-2 -right-2 px-2 py-1 bg-green-500 text-white text-xs font-bold rounded-full shadow-lg">
                  NEW!
                </div>
              )}

              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className={`px-2 py-1 rounded text-xs font-semibold ${
                        trade.tradeType === "OPEN"
                          ? "bg-green-500/20 text-green-300 border border-green-500/40"
                          : "bg-red-500/20 text-red-300 border border-red-500/40"
                      }`}
                    >
                      {trade.tradeType === "OPEN" ? "OPENED" : "CLOSED"}
                    </span>
                    {trade.positionType && (
                      <span
                        className={`px-2 py-1 rounded text-xs font-semibold ${
                          trade.positionType === "LONG"
                            ? "bg-blue-500/20 text-blue-300"
                            : "bg-orange-500/20 text-orange-300"
                        }`}
                      >
                        {trade.positionType}
                      </span>
                    )}
                    {trade.leverage && (
                      <span className="px-2 py-1 rounded text-xs font-semibold bg-purple-500/20 text-purple-300">
                        {trade.leverage}x
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm text-white/50">Amount:</span>
                    <span className="text-lg font-bold text-white">
                      {parseFloat(amount).toFixed(4)} MON
                    </span>
                  </div>

                  {trade.assetId && (
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs text-white/50">Asset ID:</span>
                      <span className="text-sm text-purple-300">
                        #{trade.assetId}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center gap-2 text-xs text-white/40 mt-2">
                    <span>{timeAgo}</span>
                    <span>•</span>
                    <a
                      href={`https://explorer.testnet.monad.xyz/tx/${trade.transactionHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 hover:text-purple-400 transition-colors"
                    >
                      View TX
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-4xl mb-2">
                    {trade.tradeType === "OPEN" ? "📈" : "📉"}
                  </div>
                  <div className="text-xs text-white/50">
                    Following
                  </div>
                  <div className="text-xs font-mono text-purple-300">
                    {trade.monachadAddress.slice(0, 6)}...
                    {trade.monachadAddress.slice(-4)}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function getTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);

  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}
