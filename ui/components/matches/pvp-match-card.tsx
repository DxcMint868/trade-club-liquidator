"use client";

import { Button } from "@/components/ui/button";

interface PvPMatchCardProps {
  matchId: string;
  player1: {
    name: string;
    margin: string;
    pnl: string;
    winRate: string;
    color: string;
    isLeading?: boolean;
  };
  player2: {
    name: string;
    margin: string;
    pnl: string;
    winRate: string;
    color: string;
    isLeading?: boolean;
  };
  victoryProgress: number; // 0-100 percentage
  leadingPlayer: string;
  leadingBy: string;
  matchDetails: {
    marginCap: string;
    maxLeverage: string;
    duration: string;
    timeLeft: string;
  };
  prizePool: string;
}

export function PvPMatchCard({
  matchId,
  player1,
  player2,
  victoryProgress,
  leadingPlayer,
  leadingBy,
  matchDetails,
  prizePool
}: PvPMatchCardProps) {
  return (
    <div className="relative bg-gradient-to-br from-red-900/20 via-black/60 to-orange-900/20 backdrop-blur-xl border border-red-500/30 rounded-3xl p-8 shadow-2xl hover:border-red-500/50 transition-all duration-300 group">
      <div className="absolute inset-0 bg-gradient-to-r from-red-500/5 via-transparent to-orange-500/5 rounded-3xl pointer-events-none group-hover:from-red-500/10 group-hover:to-orange-500/10 transition-all duration-300" />
      
      <div className="relative">
        {/* Header */}
        <div className="flex justify-between items-start mb-6">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse shadow-lg shadow-red-500/50"></div>
              <h3 className="text-3xl font-bold bg-gradient-to-r from-red-400 to-orange-400 bg-clip-text text-transparent">
                PvP DUEL
              </h3>
            </div>
            <span className="text-xs px-3 py-1 bg-red-500/20 text-red-400 border border-red-500/40 rounded-full font-semibold">
              LIVE
            </span>
          </div>
          <div className="text-right">
            <p className="text-sm text-white/50">Match ID</p>
            <p className="text-lg font-mono text-red-400">{matchId}</p>
          </div>
        </div>

        {/* Match Progress */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-3">
            <h4 className="text-lg font-semibold text-white">Match Progress</h4>
            <span className="text-sm text-orange-400">{leadingPlayer} leading by {leadingBy}</span>
          </div>
          <div className="relative h-6 bg-black/50 rounded-full border border-white/10 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-red-500/20 to-orange-500/20"></div>
            <div 
              className="h-full bg-gradient-to-r from-red-500 to-orange-500 rounded-full transition-all duration-1000 ease-out shadow-lg absolute right-0"
              style={{ width: `${victoryProgress}%` }}
            ></div>
            <div className="absolute inset-0 flex items-center justify-between px-4 text-xs font-semibold">
              <span className="text-white/90">{player1.name}</span>
              <span className="text-white">{player2.name}</span>
            </div>
          </div>
        </div>

        {/* Trader Stats */}
        <div className="grid grid-cols-2 gap-6 mb-6">
          <div className={`bg-${player1.color}-500/10 border border-${player1.color}-500/30 rounded-xl p-4 relative`}>
            {player1.isLeading && (
              <div className="absolute -top-4 -right-2 bg-gradient-to-r from-yellow-500 to-orange-500 text-black text-xs font-bold px-2 py-1 rounded-full shadow-lg animate-pulse z-10">
                MONACHAD!
              </div>
            )}
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-8 h-8 bg-${player1.color}-500 rounded-full flex items-center justify-center text-white font-bold text-sm`}>
                {player1.name.charAt(0)}
              </div>
              <span className={`font-semibold text-${player1.color}-400`}>{player1.name}</span>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-white/50">Margin</span>
                <span className={`text-sm font-semibold text-${player1.color}-400`}>{player1.margin}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-white/50">PnL</span>
                <span className={`text-sm font-semibold ${player1.pnl.startsWith('+') ? 'text-green-400' : 'text-red-400'}`}>
                  {player1.pnl}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-white/50">Win Rate</span>
                <span className="text-sm font-semibold text-white">{player1.winRate}</span>
              </div>
            </div>
          </div>
          
          <div className={`bg-${player2.color}-500/10 border border-${player2.color}-500/30 rounded-xl p-4 relative`}>
            {player2.isLeading && (
              <div className="absolute -top-4 -right-2 bg-gradient-to-r from-yellow-500 to-orange-500 text-black text-xs font-bold px-2 py-1 rounded-full shadow-lg animate-pulse z-10">
                MONACHAD!
              </div>
            )}
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-8 h-8 bg-${player2.color}-500 rounded-full flex items-center justify-center text-white font-bold text-sm`}>
                {player2.name.charAt(0)}
              </div>
              <span className={`font-semibold text-${player2.color}-400`}>{player2.name}</span>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-white/50">Margin</span>
                <span className={`text-sm font-semibold text-${player2.color}-400`}>{player2.margin}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-white/50">PnL</span>
                <span className={`text-sm font-semibold ${player2.pnl.startsWith('+') ? 'text-green-400' : 'text-red-400'}`}>
                  {player2.pnl}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-white/50">Win Rate</span>
                <span className="text-sm font-semibold text-white">{player2.winRate}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Prize Pool */}
        <div className="bg-gradient-to-r from-red-500/10 to-orange-500/10 border border-red-500/30 rounded-xl p-4 mb-6">
          <div className="text-center">
            <p className="text-sm text-white/50 mb-2">Prize Pool</p>
            <p className="text-2xl font-bold bg-gradient-to-r from-red-400 to-orange-400 bg-clip-text text-transparent">
              {prizePool}
            </p>
          </div>
        </div>

        {/* Match Details */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="text-center">
            <p className="text-xs text-white/50 mb-1">Margin Cap</p>
            <p className="text-lg font-bold text-white">{matchDetails.marginCap}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-white/50 mb-1">Max Leverage</p>
            <p className="text-lg font-bold text-yellow-400">{matchDetails.maxLeverage}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-white/50 mb-1">Duration</p>
            <p className="text-lg font-bold text-white">{matchDetails.duration}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-white/50 mb-1">Time Left</p>
            <p className="text-lg font-bold text-red-400">{matchDetails.timeLeft}</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4 justify-center">
          <Button className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white border-0 px-6 py-3 rounded-full font-semibold transition-all duration-300 hover:scale-105 shadow-lg">
            Watch Live
          </Button>
          <Button className="bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 text-white border-0 px-6 py-3 rounded-full font-semibold transition-all duration-300 hover:scale-105 shadow-lg">
            Copy Trade →
          </Button>
        </div>
      </div>
    </div>
  );
}