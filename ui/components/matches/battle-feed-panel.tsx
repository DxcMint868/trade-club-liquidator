"use client";

import { useState } from "react";
import { formatEther } from "viem";
import { CopyTradeEvent, OriginalTradeEvent } from "@/hooks/use-match-events";

interface BattleFeedPanelProps {
  // Shadow trades (copy trades)
  allShadowTrades: CopyTradeEvent[];
  myShadowTrades: CopyTradeEvent[];
  
  // Original trades (Monachad trades)
  allOriginalTrades: OriginalTradeEvent[];
  myChadOriginalTrades: OriginalTradeEvent[];
  
  isConnected: boolean;
}

type ViewMode = "all" | "mine";

export function BattleFeedPanel({
  allShadowTrades,
  myShadowTrades,
  allOriginalTrades,
  myChadOriginalTrades,
  isConnected,
}: BattleFeedPanelProps) {
  const [shadowViewMode, setShadowViewMode] = useState<ViewMode>("all");
  const [originalViewMode, setOriginalViewMode] = useState<ViewMode>("all");

  const shadowTradesToShow = shadowViewMode === "all" ? allShadowTrades : myShadowTrades;
  const originalTradesToShow = originalViewMode === "all" ? allOriginalTrades : myChadOriginalTrades;

  return (
    <div className="bg-black/40 backdrop-blur-xl border border-purple-500/20 rounded-3xl p-6 shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-2xl font-semibold text-white">Battle Feed</h3>
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

      {/* Split Panes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Pane: Shadow Trades (Copy Trades) */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-1 h-6 bg-gradient-to-b from-purple-500 to-blue-500 rounded-full" />
              <h4 className="text-lg font-semibold text-purple-300">Shadow Trades</h4>
            </div>
            <div className="flex items-center gap-1 bg-black/50 rounded-full p-1 border border-purple-500/30">
              <button
                onClick={() => setShadowViewMode("all")}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                  shadowViewMode === "all"
                    ? "bg-purple-500 text-white"
                    : "text-white/60 hover:text-white/80"
                }`}
              >
                All Shadows
              </button>
              <button
                onClick={() => setShadowViewMode("mine")}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                  shadowViewMode === "mine"
                    ? "bg-purple-500 text-white"
                    : "text-white/60 hover:text-white/80"
                }`}
              >
                My Shadows
              </button>
            </div>
          </div>

          {/* Shadow Trades List */}
          <div className="space-y-2 max-h-[600px] overflow-y-auto custom-scrollbar pr-2">
            {shadowTradesToShow.length === 0 ? (
              <div className="text-center py-12 text-white/40">
                <div className="text-4xl mb-2">👻</div>
                <p className="text-sm">
                  {shadowViewMode === "all"
                    ? "No shadow trades yet..."
                    : "You haven't copied any trades yet"}
                </p>
              </div>
            ) : (
              shadowTradesToShow.map((trade, index) => (
                <ShadowTradeCard key={`${trade.transactionHash}-${index}`} trade={trade} />
              ))
            )}
          </div>

          {/* Stats */}
          <div className="flex items-center justify-between pt-3 border-t border-purple-500/20">
            <span className="text-xs text-white/50">Total Shadows</span>
            <span className="text-sm font-semibold text-purple-300">
              {shadowViewMode === "all" ? allShadowTrades.length : myShadowTrades.length}
            </span>
          </div>
        </div>

        {/* Right Pane: Original Trades (Monachad Trades) */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-1 h-6 bg-gradient-to-b from-orange-500 to-yellow-500 rounded-full" />
              <h4 className="text-lg font-semibold text-orange-300">Original Trades</h4>
            </div>
            <div className="flex items-center gap-1 bg-black/50 rounded-full p-1 border border-orange-500/30">
              <button
                onClick={() => setOriginalViewMode("all")}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                  originalViewMode === "all"
                    ? "bg-orange-500 text-white"
                    : "text-white/60 hover:text-white/80"
                }`}
              >
                All Originals
              </button>
              <button
                onClick={() => setOriginalViewMode("mine")}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                  originalViewMode === "mine"
                    ? "bg-orange-500 text-white"
                    : "text-white/60 hover:text-white/80"
                }`}
              >
                My Chad's
              </button>
            </div>
          </div>

          {/* Original Trades List */}
          <div className="space-y-2 max-h-[600px] overflow-y-auto custom-scrollbar pr-2">
            {originalTradesToShow.length === 0 ? (
              <div className="text-center py-12 text-white/40">
                <div className="text-4xl mb-2">⚡</div>
                <p className="text-sm">
                  {originalViewMode === "all"
                    ? "No original trades yet..."
                    : "Your Monachad hasn't traded yet"}
                </p>
              </div>
            ) : (
              originalTradesToShow.map((trade, index) => (
                <OriginalTradeCard key={`${trade.transactionHash}-${index}`} trade={trade} />
              ))
            )}
          </div>

          {/* Stats */}
          <div className="flex items-center justify-between pt-3 border-t border-orange-500/20">
            <span className="text-xs text-white/50">Total Originals</span>
            <span className="text-sm font-semibold text-orange-300">
              {originalViewMode === "all" ? allOriginalTrades.length : myChadOriginalTrades.length}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Shadow Trade Card Component
function ShadowTradeCard({ trade }: { trade: CopyTradeEvent }) {
  const amount = formatEther(BigInt(trade.amount));
  const timeAgo = getTimeAgo(trade.timestamp);
  const isRecent = Date.now() - trade.timestamp < 5000;

  return (
    <div
      className={`relative p-3 rounded-xl border transition-all animate-slide-in ${
        isRecent
          ? "bg-purple-500/20 border-purple-400/60 shadow-lg shadow-purple-500/20"
          : "bg-black/40 border-purple-500/20 hover:border-purple-400/40"
      }`}
    >
      {isRecent && (
        <div className="absolute -top-1 -right-1 px-2 py-0.5 bg-green-500 text-white text-[10px] font-bold rounded-full shadow-lg animate-pulse">
          NEW
        </div>
      )}

      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {/* Trade Type & Position */}
          <div className="flex items-center gap-1.5 mb-2 flex-wrap">
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                trade.tradeType === "OPEN"
                  ? "bg-green-500/20 text-green-300 border border-green-500/40"
                  : "bg-red-500/20 text-red-300 border border-red-500/40"
              }`}
            >
              {trade.tradeType}
            </span>
            {trade.positionType && (
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                  trade.positionType === "LONG"
                    ? "bg-blue-500/20 text-blue-300"
                    : "bg-orange-500/20 text-orange-300"
                }`}
              >
                {trade.positionType}
              </span>
            )}
            {trade.leverage && (
              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-purple-500/20 text-purple-300">
                {trade.leverage}x
              </span>
            )}
          </div>

          {/* Amount */}
          <div className="flex items-baseline gap-1.5 mb-1">
            <span className="text-xs text-white/50">Amount:</span>
            <span className="text-sm font-bold text-white truncate">
              {parseFloat(amount).toFixed(4)} MON
            </span>
          </div>

          {/* Supporter Address */}
          <div className="flex items-baseline gap-1.5 mb-1">
            <span className="text-[10px] text-white/40">Supporter:</span>
            <span className="text-[10px] font-mono text-purple-300 truncate">
              {trade.supporterAddress.slice(0, 6)}...{trade.supporterAddress.slice(-4)}
            </span>
          </div>

          {/* Time */}
          <div className="text-[10px] text-white/30">{timeAgo}</div>
        </div>

        {/* Icon */}
        <div className="text-2xl opacity-60">👻</div>
      </div>
    </div>
  );
}

// Original Trade Card Component
function OriginalTradeCard({ trade }: { trade: OriginalTradeEvent }) {
  const amount = formatEther(BigInt(trade.amount));
  const timeAgo = getTimeAgo(trade.timestamp);
  const isRecent = Date.now() - trade.timestamp < 5000;

  return (
    <div
      className={`relative p-3 rounded-xl border transition-all animate-slide-in ${
        isRecent
          ? "bg-orange-500/20 border-orange-400/60 shadow-lg shadow-orange-500/20"
          : "bg-black/40 border-orange-500/20 hover:border-orange-400/40"
      }`}
    >
      {isRecent && (
        <div className="absolute -top-1 -right-1 px-2 py-0.5 bg-green-500 text-white text-[10px] font-bold rounded-full shadow-lg animate-pulse">
          NEW
        </div>
      )}

      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {/* Trade Type & Position */}
          <div className="flex items-center gap-1.5 mb-2 flex-wrap">
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                trade.tradeType === "OPEN"
                  ? "bg-green-500/20 text-green-300 border border-green-500/40"
                  : "bg-red-500/20 text-red-300 border border-red-500/40"
              }`}
            >
              {trade.tradeType}
            </span>
            {trade.positionType && (
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                  trade.positionType === "LONG"
                    ? "bg-blue-500/20 text-blue-300"
                    : "bg-orange-500/20 text-orange-300"
                }`}
              >
                {trade.positionType}
              </span>
            )}
            {trade.leverage && (
              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-orange-500/20 text-orange-300">
                {trade.leverage}x
              </span>
            )}
          </div>

          {/* Amount */}
          <div className="flex items-baseline gap-1.5 mb-1">
            <span className="text-xs text-white/50">Amount:</span>
            <span className="text-sm font-bold text-white truncate">
              {parseFloat(amount).toFixed(4)} MON
            </span>
          </div>

          {/* Monachad Address */}
          <div className="flex items-baseline gap-1.5 mb-1">
            <span className="text-[10px] text-white/40">Monachad:</span>
            <span className="text-[10px] font-mono text-orange-300 truncate">
              {trade.monachadAddress.slice(0, 6)}...{trade.monachadAddress.slice(-4)}
            </span>
          </div>

          {/* Time */}
          <div className="text-[10px] text-white/30">{timeAgo}</div>
        </div>

        {/* Icon */}
        <div className="text-2xl opacity-60">⚡</div>
      </div>
    </div>
  );
}

function getTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);

  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}
