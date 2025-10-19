"use client";

import { formatDistanceToNow } from "date-fns";

interface Participant {
  address: string;
  role: "MONACHAD" | "SUPPORTER";
  marginAmount?: string;
  entryFeePaid?: string;
  fundedAmount?: string;
  stakedAmount?: string; // legacy fallback
  pnl: string;
  followingAddress?: string;
}

interface LiveStatsProps {
  match: {
    id: string;
    matchId: string;
    status: string;
    prizePool: string;
    startTime: Date;
    endTime: Date;
    duration: number;
  };
  participants: Participant[];
  currentUserAddress?: string;
}

export default function LiveStats({
  match,
  participants,
  currentUserAddress,
}: LiveStatsProps) {
  const monachads = participants.filter((p) => p.role === "MONACHAD");
  const supporters = participants.filter((p) => p.role === "SUPPORTER");

  // Calculate total PnL
  const totalPnL = participants.reduce(
    (sum, p) => sum + parseFloat(p.pnl || "0"),
    0
  );

  const getBaseStakeWei = (participant?: Participant) =>
    participant
      ? parseFloat(
          participant.marginAmount ??
            participant.fundedAmount ??
            participant.stakedAmount ??
            participant.entryFeePaid ??
            "0"
        )
      : 0;

  const formatStakeEth = (participant?: Participant) =>
    (getBaseStakeWei(participant) / 1e18).toFixed(4);

  // Find current user's stats
  const currentUser = participants.find(
    (p) => p.address.toLowerCase() === currentUserAddress?.toLowerCase()
  );

  // Time remaining - handle invalid dates
  let timeRemaining = "Unknown";
  try {
    if (match.endTime) {
      const endDate = new Date(match.endTime);
      if (!isNaN(endDate.getTime())) {
        timeRemaining = formatDistanceToNow(endDate, { addSuffix: true });
      }
    }
  } catch (error) {
    console.error("Invalid end time:", error);
  }

  return (
    <div className="space-y-4">
      {/* Match Overview */}
      <div className="bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900 rounded-lg border border-purple-500/30 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-white">
            Match #{match.matchId.slice(0, 8)}
          </h2>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-sm font-semibold text-green-400">LIVE</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <p className="text-sm text-slate-400">Prize Pool</p>
            <p className="text-2xl font-bold text-purple-400">
              {(parseFloat(match.prizePool) / 1e18).toFixed(4)} ETH
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-slate-400">Ends</p>
            <p className="text-xl font-bold text-slate-200">{timeRemaining}</p>
          </div>
        </div>
      </div>

      {/* Current User Stats (if participant) */}
      {currentUser && (
        <div className="bg-gradient-to-br from-blue-900/30 via-purple-900/20 to-blue-900/30 rounded-lg border border-blue-500/50 p-6">
          <h3 className="text-lg font-bold text-blue-300 mb-4">Your Stats</h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1">
              <p className="text-xs text-slate-400">Role</p>
              <p className="text-sm font-bold text-white">
                {currentUser.role === "MONACHAD"
                  ? "🎮 Monachad"
                  : "🎯 Supporter"}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-slate-400">Staked</p>
              <p className="text-sm font-bold text-white">
                {formatStakeEth(currentUser)} ETH
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-slate-400">PnL</p>
              <p
                className={`text-sm font-bold ${
                  parseFloat(currentUser.pnl) >= 0
                    ? "text-green-400"
                    : "text-red-400"
                }`}
              >
                {parseFloat(currentUser.pnl) >= 0 ? "+" : ""}
                {(parseFloat(currentUser.pnl) / 1e18).toFixed(4)} ETH
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Leaderboard */}
      <div className="bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900 rounded-lg border border-purple-500/30 p-6">
        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <span>🏆</span> Monachad Leaderboard
        </h3>
        <div className="space-y-2">
          {monachads
            .sort((a, b) => parseFloat(b.pnl) - parseFloat(a.pnl))
            .slice(0, 5)
            .map((monachad, index) => {
              const pnl = parseFloat(monachad.pnl) / 1e18;
              const followersCount = supporters.filter(
                (s) =>
                  s.followingAddress?.toLowerCase() ===
                  monachad.address.toLowerCase()
              ).length;

              return (
                <div
                  key={monachad.address}
                  className={`flex items-center justify-between p-3 rounded-lg ${
                    index === 0
                      ? "bg-yellow-500/10 border border-yellow-500/30"
                      : "bg-slate-800/50 border border-slate-700/50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold text-slate-400">
                      #{index + 1}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-white">
                        {monachad.address.slice(0, 6)}...
                        {monachad.address.slice(-4)}
                      </p>
                      <p className="text-xs text-slate-400">
                        {followersCount} followers
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p
                      className={`text-sm font-bold ${
                        pnl >= 0 ? "text-green-400" : "text-red-400"
                      }`}
                    >
                      {pnl >= 0 ? "+" : ""}
                      {pnl.toFixed(4)} ETH
                    </p>
                    <p className="text-xs text-slate-400">
                      {(() => {
                        const baseStakeEth = getBaseStakeWei(monachad) / 1e18;
                        if (baseStakeEth === 0) return "0.00";
                        return ((pnl / baseStakeEth) * 100).toFixed(2);
                      })()}
                      %
                    </p>
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      {/* Live Activity */}
      <div className="bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900 rounded-lg border border-purple-500/30 p-6">
        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <span>⚡</span> Live Activity
        </h3>
        <div className="space-y-2">
          <div className="flex items-center gap-3 p-2 bg-green-500/10 rounded border border-green-500/20">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <p className="text-xs text-slate-300">
              <span className="font-bold text-green-400">0x1234...5678</span>{" "}
              opened LONG position
            </p>
            <span className="ml-auto text-xs text-slate-500">Just now</span>
          </div>
          <div className="flex items-center gap-3 p-2 bg-blue-500/10 rounded border border-blue-500/20">
            <div className="w-2 h-2 bg-blue-500 rounded-full" />
            <p className="text-xs text-slate-300">
              <span className="font-bold text-blue-400">0xabcd...ef01</span>{" "}
              joined as supporter
            </p>
            <span className="ml-auto text-xs text-slate-500">2m ago</span>
          </div>
          <div className="flex items-center gap-3 p-2 bg-red-500/10 rounded border border-red-500/20">
            <div className="w-2 h-2 bg-red-500 rounded-full" />
            <p className="text-xs text-slate-300">
              <span className="font-bold text-red-400">0x9876...4321</span>{" "}
              closed position
            </p>
            <span className="ml-auto text-xs text-slate-500">5m ago</span>
          </div>
        </div>
      </div>
    </div>
  );
}
