"use client";

import { Button } from "@/components/ui/button";

interface UpcomingMatchCardProps {
  matchId: string;
  matchType: "PvP" | "Battle Royale";
  startTime: string;
  registeredPlayers?: number;
  maxPlayers?: number;
  presetBattle?: {
    player1: string;
    player2: string;
  };
  matchDetails: {
    marginCap: string;
    maxLeverage: string;
    duration: string;
    entryFee: string;
  };
  prizePool: {
    total: string;
    distribution?: string;
  };
  liveViewers?: number;
  specialTag?: string;
}

export function UpcomingMatchCard({
  matchId,
  matchType,
  startTime,
  registeredPlayers,
  maxPlayers,
  presetBattle,
  matchDetails,
  prizePool,
  liveViewers,
  specialTag
}: UpcomingMatchCardProps) {
  const getMatchColor = () => {
    return matchType === "PvP" 
      ? "from-blue-900/20 via-black/60 to-cyan-900/20 border-blue-500/30"
      : "from-indigo-900/20 via-black/60 to-purple-900/20 border-indigo-500/30";
  };

  const getGradientText = () => {
    return matchType === "PvP"
      ? "from-blue-400 to-cyan-400"
      : "from-indigo-400 to-purple-400";
  };

  const getAccentColor = () => {
    return matchType === "PvP" ? "blue" : "indigo";
  };

  return (
    <div className={`relative bg-gradient-to-br ${getMatchColor()} backdrop-blur-xl border rounded-3xl p-8 shadow-2xl hover:border-opacity-50 transition-all duration-300 group`}>
      <div className="absolute inset-0 bg-gradient-to-r from-white/5 via-transparent to-white/5 rounded-3xl pointer-events-none group-hover:from-white/10 group-hover:to-white/10 transition-all duration-300" />
      
      <div className="relative">
        {/* Header */}
        <div className="flex justify-between items-start mb-6">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 bg-yellow-500 rounded-full animate-pulse shadow-lg shadow-yellow-500/50"></div>
              <h3 className={`text-3xl font-bold bg-gradient-to-r ${getGradientText()} bg-clip-text text-transparent`}>
                {matchType.toUpperCase()}
              </h3>
            </div>
            <span className="text-xs px-3 py-1 bg-yellow-500/20 text-yellow-400 border border-yellow-500/40 rounded-full font-semibold">
              UPCOMING
            </span>
          </div>
          <div className="text-right">
            <p className="text-sm text-white/50">Match ID</p>
            <p className={`text-lg font-mono text-${getAccentColor()}-400`}>{matchId}</p>
          </div>
        </div>

        {/* Start Time */}
        <div className="bg-black/30 border border-white/10 rounded-xl p-4 mb-6">
          <div className="text-center">
            <p className="text-sm text-white/50 mb-2">Match Starts In</p>
            <p className="text-2xl font-bold text-yellow-400">{startTime}</p>
          </div>
        </div>

        {/* Registration/Battle Status */}
        <div className="mb-6">
          {matchType === "Battle Royale" && registeredPlayers !== undefined && maxPlayers !== undefined ? (
            <>
              <div className="flex justify-between items-center mb-3">
                <h4 className="text-lg font-semibold text-white">Registration</h4>
                <span className={`text-sm text-${getAccentColor()}-400`}>
                  {registeredPlayers}/{maxPlayers} Registered
                </span>
              </div>
              <div className="relative h-4 bg-black/50 rounded-full border border-white/10 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-white/20"></div>
                <div 
                  className={`h-full bg-gradient-to-r from-${getAccentColor()}-500 to-${getAccentColor()}-400 rounded-full transition-all duration-1000 ease-out shadow-lg`}
                  style={{ width: `${(registeredPlayers / maxPlayers) * 100}%` }}
                ></div>
              </div>
            </>
          ) : matchType === "PvP" && presetBattle ? (
            <>
              <div className="flex justify-between items-center mb-3">
                <h4 className="text-lg font-semibold text-white">Tonight's Competitors</h4>
                <span className={`text-sm text-${getAccentColor()}-400`}>Preset Battle</span>
              </div>
              <div className="bg-black/30 border border-white/10 rounded-xl p-4">
                <div className="text-center">
                  <p className={`text-2xl font-bold bg-gradient-to-r ${getGradientText()} bg-clip-text text-transparent`}>
                    {presetBattle.player1} vs. {presetBattle.player2}
                  </p>
                  <p className="text-sm text-white/50 mt-2">Elite Monachads Battle</p>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="flex justify-between items-center mb-3">
                <h4 className="text-lg font-semibold text-white">Registration Status</h4>
                <span className={`text-sm text-${getAccentColor()}-400`}>
                  {registeredPlayers === maxPlayers ? "Match Full" : `${registeredPlayers || 0}/${maxPlayers || 2} Registered`}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-black/30 border border-white/10 rounded-lg p-3 text-center">
                  <p className="text-xs text-white/50 mb-1">Player 1</p>
                  <p className="text-sm font-semibold text-white">
                    {(registeredPlayers || 0) >= 1 ? "Registered" : "Open"}
                  </p>
                </div>
                <div className="bg-black/30 border border-white/10 rounded-lg p-3 text-center">
                  <p className="text-xs text-white/50 mb-1">Player 2</p>
                  <p className="text-sm font-semibold text-white">
                    {(registeredPlayers || 0) >= 2 ? "Registered" : "Open"}
                  </p>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Match Details */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="text-center">
            <p className="text-xs text-white/50 mb-1">Entry Fee</p>
            <p className="text-lg font-bold text-white">{matchDetails.entryFee}</p>
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
            <p className="text-xs text-white/50 mb-1">Margin Cap</p>
            <p className="text-lg font-bold text-white">{matchDetails.marginCap}</p>
          </div>
        </div>

        {/* Prize Pool */}
        <div className={`bg-gradient-to-r from-${getAccentColor()}-500/10 to-${getAccentColor()}-400/10 border border-${getAccentColor()}-500/30 rounded-xl p-4 mb-6 relative`}>
          {specialTag && (
            <div className="absolute -top-2 -right-2 bg-gradient-to-r from-yellow-500 to-orange-500 text-black text-xs font-bold px-2 py-1 rounded-full shadow-lg animate-pulse z-10">
              {specialTag}
            </div>
          )}
          <div className="text-center">
            <p className="text-sm text-white/50 mb-2">Total Prize Pool</p>
            <p className={`text-3xl font-bold bg-gradient-to-r ${getGradientText()} bg-clip-text text-transparent`}>
              {prizePool.total}
            </p>
            {prizePool.distribution && (
              <p className="text-xs text-white/40 mt-1">{prizePool.distribution}</p>
            )}
          </div>
        </div>

        {/* Live Viewers (for PvP preset battles) */}
        {matchType === "PvP" && presetBattle && liveViewers && (
          <div className="mb-6">
            <div className="bg-black/30 border border-white/10 rounded-xl p-4">
              <div className="text-center">
                <p className="text-sm text-white/50 mb-2">Current Viewers In Lobby</p>
                <p className="text-2xl font-bold text-blue-400">{liveViewers.toLocaleString()}</p>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-4 justify-center">
          <Button
            onClick={() => {
              // TODO: wire up live view navigation
            }}
            className={`bg-gradient-to-r from-${getAccentColor()}-600 to-${getAccentColor()}-500 hover:from-${getAccentColor()}-700 hover:to-${getAccentColor()}-600 text-white border-0 px-6 py-3 rounded-full font-semibold transition-all duration-300 hover:scale-105 shadow-lg`}
          >
            Watch Live
          </Button>
          <Button className={`bg-gradient-to-r from-${getAccentColor()}-600 to-${getAccentColor()}-500 hover:from-${getAccentColor()}-700 hover:to-${getAccentColor()}-600 text-white border-0 px-6 py-3 rounded-full font-semibold transition-all duration-300 hover:scale-105 shadow-lg`}>
            Copy Trade →
          </Button>
        </div>
      </div>
    </div>
  );
}