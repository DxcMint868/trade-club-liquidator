"use client";

import { Button } from "@/components/ui/button";

interface Player {
  name: string;
  margin: string;
  pnl: string;
  rank: number;
  isLeading?: boolean;
}

interface BattleRoyaleMatchCardProps {
  matchId: string;
  players: Player[];
  matchDetails: {
    currentPlayers: number;
    maxPlayers: number;
    marginCap: string;
    maxLeverage: string;
    duration: string;
    timeLeft: string;
  };
  prizePool: {
    total: string;
    distribution: string;
  };
  status: "ACTIVE" | "WAITING" | "FINISHED";
}

export function BattleRoyaleMatchCard({
  matchId,
  players,
  matchDetails,
  prizePool,
  status
}: BattleRoyaleMatchCardProps) {
  const getPlayerColor = (rank: number) => {
    switch (rank) {
      case 1: return 'text-yellow-400';
      case 2: return 'text-gray-300';
      case 3: return 'text-amber-400';
      default: return 'text-white';
    }
  };

  const getBadgeColor = (rank: number) => {
    switch (rank) {
      case 1: return 'bg-yellow-500';
      case 2: return 'bg-gray-400';
      case 3: return 'bg-amber-600';
      default: return 'bg-gray-600';
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'ACTIVE': return 'bg-green-500/20 text-green-400 border-green-500/40';
      case 'WAITING': return 'bg-blue-500/20 text-blue-400 border-blue-500/40';
      case 'FINISHED': return 'bg-gray-500/20 text-gray-400 border-gray-500/40';
      default: return 'bg-green-500/20 text-green-400 border-green-500/40';
    }
  };

  return (
    <div className="relative bg-gradient-to-br from-purple-900/20 via-black/60 to-pink-900/20 backdrop-blur-xl border border-purple-500/30 rounded-3xl p-8 shadow-2xl hover:border-purple-500/50 transition-all duration-300 group">
      <div className="absolute inset-0 bg-gradient-to-r from-purple-500/5 via-transparent to-pink-500/5 rounded-3xl pointer-events-none group-hover:from-purple-500/10 group-hover:to-pink-500/10 transition-all duration-300" />
      
      <div className="relative">
        {/* Header */}
        <div className="flex justify-between items-start mb-6">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse shadow-lg shadow-green-500/50"></div>
              <h3 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                BATTLE ROYALE
              </h3>
            </div>
            <span className={`text-xs px-3 py-1 border rounded-full font-semibold ${getStatusColor()}`}>
              {status}
            </span>
          </div>
          <div className="text-right">
            <p className="text-sm text-white/50">Match ID</p>
            <p className="text-lg font-mono text-purple-400">{matchId}</p>
          </div>
        </div>

        {/* Leaderboard */}
        <div className="mb-6">
          <h4 className="text-lg font-semibold text-white mb-4">Live Leaderboard</h4>
          <div className="space-y-3">
            {players.map((player) => (
              <div key={player.name} className="flex items-center justify-between bg-black/30 rounded-lg p-3 border border-white/10 relative">
                {player.isLeading && (
                  <div className="absolute -top-4 -right-2 bg-gradient-to-r from-yellow-500 to-orange-500 text-black text-xs font-bold px-2 py-1 rounded-full shadow-lg animate-pulse z-10">
                    MONACHAD!
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-black font-bold text-xs ${getBadgeColor(player.rank)}`}>
                    {player.rank}
                  </div>
                  <span className="font-semibold text-white">{player.name}</span>
                </div>
                <div className="text-right">
                  <div className={`font-bold ${getPlayerColor(player.rank)} text-sm`}>
                    {player.margin}
                  </div>
                  <div className={`text-xs font-semibold ${player.pnl.startsWith('+') ? 'text-green-400' : 'text-red-400'}`}>
                    {player.pnl}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Match Details */}
        <div className="grid grid-cols-5 gap-4 mb-6">
          <div className="text-center">
            <p className="text-xs text-white/50 mb-1">Players</p>
            <p className="text-lg font-bold text-purple-400">
              {matchDetails.currentPlayers}/{matchDetails.maxPlayers}
            </p>
          </div>
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
            <p className="text-lg font-bold text-green-400">{matchDetails.timeLeft}</p>
          </div>
        </div>

        {/* Prize Pool */}
        <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/30 rounded-xl p-4 mb-6">
          <div className="text-center">
            <p className="text-sm text-white/50 mb-2">Total Prize Pool</p>
            <p className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              {prizePool.total}
            </p>
            <p className="text-xs text-white/40 mt-1">{prizePool.distribution}</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4 justify-center">
          <Button className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white border-0 px-6 py-3 rounded-full font-semibold transition-all duration-300 hover:scale-105 shadow-lg">
            Watch Live
          </Button>
          <Button className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white border-0 px-6 py-3 rounded-full font-semibold transition-all duration-300 hover:scale-105 shadow-lg">
            Copy Trade →
          </Button>
        </div>
      </div>
    </div>
  );
}