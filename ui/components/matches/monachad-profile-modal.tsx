"use client";

import { useState } from "react";
import { X, User, Award, BarChart } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MonachadStats {
  address: string;
  winRate: number;
  totalMatches: number;
  totalPnL: string;
  averageRoi: number;
  rank: number;
  level: number;
  tradingVolume: string;
  longestWinStreak: number;
  bestTrade: {
    asset: string;
    pnl: string;
    roi: number;
  };
  pastMatches: Array<{
    matchId: string;
    rank: number;
    pnl: string;
    roi: number;
    duration: string;
    date: string;
    status: "WON" | "LOST" | "ACTIVE";
  }>;
}

interface MonachadProfileModalProps {
  address: string;
  isOpen: boolean;
  onClose: () => void;
}

const generateMockStats = (address: string): MonachadStats => {
  const winRate = 45 + Math.random() * 50;
  const totalMatches = Math.floor(5 + Math.random() * 45);
  const totalPnL = (Math.random() * 200 - 50).toFixed(2);
  const averageRoi = (Math.random() * 150 - 25).toFixed(1);
  const rank = Math.floor(1 + Math.random() * 500);
  const level = Math.floor(1 + Math.random() * 50);
  const tradingVolume = (500 + Math.random() * 4500).toFixed(2);
  const longestWinStreak = Math.floor(2 + Math.random() * 12);

  const assets = ["BTC", "ETH", "SOL", "LINK", "MON"];
  const bestTrade = {
    asset: assets[Math.floor(Math.random() * assets.length)],
    pnl: (10 + Math.random() * 90).toFixed(2),
    roi: (50 + Math.random() * 250).toFixed(1),
  };

  const pastMatches = Array.from({ length: 8 }, (_, i) => {
    const status: "WON" | "LOST" | "ACTIVE" =
      i === 0 && Math.random() > 0.7
        ? "ACTIVE"
        : Math.random() > 0.5
        ? "WON"
        : "LOST";

    return {
      matchId: `#${1000 + i}`,
      rank: Math.floor(1 + Math.random() * 10),
      pnl: (Math.random() * 40 - 10).toFixed(2),
      roi: parseFloat((Math.random() * 100 - 20).toFixed(1)),
      duration: `${Math.floor(1 + Math.random() * 23)}h`,
      date: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toLocaleDateString(),
      status,
    };
  });

  return {
    address,
    winRate,
    totalMatches,
    totalPnL,
    averageRoi: parseFloat(averageRoi),
    rank,
    level,
    tradingVolume,
    longestWinStreak,
    bestTrade: {
      ...bestTrade,
      roi: parseFloat(bestTrade.roi),
    },
    pastMatches,
  };
};

export function MonachadProfileModal({
  address,
  isOpen,
  onClose,
}: MonachadProfileModalProps) {
  const [stats] = useState(() => generateMockStats(address));

  if (!isOpen) return null;

  const shortAddress = `${address.slice(0, 6)}...${address.slice(-4)}`;
  const isPositivePnL = parseFloat(stats.totalPnL) >= 0;
  const isPositiveAvgRoi = stats.averageRoi >= 0;

  const getRankColor = (rank: number) => {
    if (rank <= 10) return "from-yellow-400 to-orange-500";
    if (rank <= 50) return "from-gray-300 to-gray-400";
    if (rank <= 100) return "from-amber-600 to-amber-700";
    return "from-purple-500 to-purple-600";
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-gradient-to-br from-[#0a0515] via-[#0d0820] to-[#080413] border-2 border-purple-500/40 rounded-3xl shadow-2xl shadow-purple-500/20">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 rounded-full bg-black/40 hover:bg-black/60 border border-purple-500/30 transition-all"
        >
          <X className="w-5 h-5 text-white" />
        </button>

        <div className="relative p-8 bg-gradient-to-r from-purple-900/30 via-purple-800/20 to-purple-900/30 border-b border-purple-500/30">
          <div className="absolute inset-0 opacity-10">
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(168,85,247,0.08) 10px, rgba(168,85,247,0.08) 20px)`,
              }}
            />
          </div>

          <div className="relative flex items-start justify-between">
            <div className="flex items-center gap-6">
              <div className="relative">
                <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-purple-600 to-purple-700 flex items-center justify-center shadow-lg shadow-purple-500/40 border-2 border-purple-400">
                  <User className="w-10 h-10 text-white/95" />
                </div>
                <div className="absolute -bottom-2 -right-2 px-3 py-1 rounded-full bg-black/60 border border-white/10 shadow-sm">
                  <span className="text-xs font-semibold text-white">
                    LVL {stats.level}
                  </span>
                </div>
              </div>

              <div>
                <h2 className="text-3xl font-bold text-white mb-2">
                  Monachad {shortAddress}
                </h2>
                <div className="flex items-center gap-3">
                  <div
                    className={`px-3 py-1 rounded-lg bg-gradient-to-r ${getRankColor(
                      stats.rank
                    )} shadow-sm`}
                  >
                    <span className="text-sm font-semibold text-white">
                      Rank #{stats.rank}
                    </span>
                  </div>
                  <div className="px-3 py-1 rounded-lg bg-black/50 border border-green-500/20">
                    <span className="text-sm font-semibold text-green-300">
                      {stats.winRate.toFixed(1)}% Win Rate
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="text-right">
              <p className="text-sm text-white/60 mb-1">Total PnL</p>
              <p
                className={`text-3xl md:text-4xl font-semibold ${
                  isPositivePnL ? "text-green-400" : "text-red-400"
                }`}
              >
                {isPositivePnL ? "+" : ""}
                {stats.totalPnL} MON
              </p>
            </div>
          </div>
        </div>

        <div className="p-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-black/40 backdrop-blur-md border border-purple-500/20 rounded-xl p-4 hover:border-purple-400/40 transition-all">
              <p className="text-xs text-white/50 uppercase tracking-wide mb-1">
                Total Matches
              </p>
              <p className="text-2xl font-bold text-white">
                {stats.totalMatches}
              </p>
            </div>

            <div className="bg-black/40 backdrop-blur-md border border-purple-500/20 rounded-xl p-4 hover:border-purple-400/40 transition-all">
              <p className="text-xs text-white/50 uppercase tracking-wide mb-1">
                Avg ROI
              </p>
              <p
                className={`text-2xl font-bold ${
                  isPositiveAvgRoi ? "text-green-400" : "text-red-400"
                }`}
              >
                {isPositiveAvgRoi ? "+" : ""}
                {stats.averageRoi}%
              </p>
            </div>

            <div className="bg-black/40 backdrop-blur-md border border-purple-500/20 rounded-xl p-4 hover:border-purple-400/40 transition-all">
              <p className="text-xs text-white/50 uppercase tracking-wide mb-1">
                Trading Volume
              </p>
              <p className="text-2xl font-bold text-purple-300">
                {stats.tradingVolume} MON
              </p>
            </div>

            <div className="bg-black/40 backdrop-blur-md border border-purple-500/20 rounded-xl p-4 hover:border-purple-400/40 transition-all">
              <p className="text-xs text-white/50 uppercase tracking-wide mb-1">
                Win Streak
              </p>
              <p className="text-2xl font-bold text-orange-400">
                🔥 {stats.longestWinStreak}
              </p>
            </div>
          </div>

          <div className="bg-black/40 backdrop-blur-md border border-purple-500/20 rounded-xl p-6 mb-8">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <Award className="w-5 h-5 text-yellow-300" />
                  <p className="text-sm text-white/60">Best Trade</p>
                </div>
                <p className="text-lg font-bold text-white mb-1">
                  {stats.bestTrade.asset} Position
                </p>
                <div className="flex items-center gap-4">
                  <span className="text-xl font-semibold text-green-400">
                    +{stats.bestTrade.pnl} MON
                  </span>
                  <span className="px-3 py-1 bg-green-500/10 border border-green-500/30 rounded-full text-green-300 text-sm font-semibold">
                    +{stats.bestTrade.roi}% ROI
                  </span>
                </div>
              </div>
              <BarChart className="w-8 h-8 text-white/20" />
            </div>
          </div>

          <div>
            <h3 className="text-xl font-bold text-white mb-4">
              Recent Matches
            </h3>
            <div className="space-y-3">
              {stats.pastMatches.map((match, index) => (
                <div
                  key={index}
                  className={
                    "bg-black/40 backdrop-blur-md border rounded-xl p-4 hover:border-purple-400/40 transition-all " +
                    (match.status === "ACTIVE"
                      ? "border-blue-500/40 bg-blue-500/5"
                      : match.status === "WON"
                      ? "border-green-500/20"
                      : "border-red-500/20")
                  }
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div>
                        <div className="text-sm text-white/50">
                          {match.matchId}
                        </div>
                        <div className="text-xs text-white/40 mt-1">
                          {match.date} • {match.duration}
                        </div>
                      </div>

                      <span
                        className={
                          "px-3 py-1 rounded-full text-xs font-semibold " +
                          (match.status === "ACTIVE"
                            ? "bg-blue-500/20 text-blue-300 border border-blue-500/40"
                            : match.status === "WON"
                            ? "bg-green-500/20 text-green-300 border border-green-500/40"
                            : "bg-red-500/20 text-red-300 border border-red-500/40")
                        }
                      >
                        {match.status}
                      </span>

                      <div className="ml-4 flex items-center gap-2">
                        <span className="text-sm text-white/50">Rank</span>
                        <span
                          className={
                            "text-lg font-bold " +
                            (match.rank === 1
                              ? "text-yellow-400"
                              : match.rank <= 3
                              ? "text-gray-300"
                              : "text-white")
                          }
                        >
                          #{match.rank}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p
                          className={
                            "text-lg font-semibold " +
                            (parseFloat(match.pnl) >= 0
                              ? "text-green-400"
                              : "text-red-400")
                          }
                        >
                          {parseFloat(match.pnl) >= 0 ? "+" : ""}
                          {match.pnl} MON
                        </p>
                        <p
                          className={
                            "text-sm " +
                            (match.roi >= 0
                              ? "text-green-400/70"
                              : "text-red-400/70")
                          }
                        >
                          {match.roi >= 0 ? "+" : ""}
                          {match.roi}% ROI
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="p-6 bg-black/40 border-t border-purple-500/20 flex justify-between items-center">
          <div className="text-xs text-white/40">
            Mock data for demonstration • Stats update in real-time on mainnet
          </div>
          <div>
            <Button
              variant="ghost"
              className="text-purple-300 hover:text-white"
              onClick={onClose}
            >
              Close Profile
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
