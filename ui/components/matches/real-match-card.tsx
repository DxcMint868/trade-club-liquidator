"use client";

import Link from "next/link";
import { formatEther } from "viem";

type Participant = {
  address: string;
  role: "MONACHAD" | "SUPPORTER" | string;
  marginAmount?: string | null;
  pnl?: string | null;
};

export interface RealMatch {
  matchId: string;
  status: string;
  entryMargin: string;
  prizePool: string;
  maxParticipants: number;
  maxSupporters?: number | null;
  duration: number;
  startTime?: string | null;
  allowedDexes?: string[];
  participants?: Participant[];
}

interface RealMatchCardProps {
  match: RealMatch;
}

const statusThemes: Record<string, { border: string; text: string; label: string }> = {
  ACTIVE: {
    border: "border-green-500/40",
    text: "text-green-300",
    label: "bg-green-500/20 text-green-300 border-green-500/50"
  },
  CREATED: {
    border: "border-blue-500/40",
    text: "text-blue-300",
    label: "bg-blue-500/20 text-blue-300 border-blue-500/50"
  },
  COMPLETED: {
    border: "border-purple-500/40",
    text: "text-purple-300",
    label: "bg-purple-500/20 text-purple-300 border-purple-500/50"
  }
};

const FALLBACK_THEME = {
  border: "border-purple-500/30",
  text: "text-purple-200",
  label: "bg-purple-500/20 text-purple-200 border-purple-500/40"
};

const formatEth = (value?: string | null, fractionDigits = 2) => {
  if (!value) return "0";
  try {
    const formatted = Number.parseFloat(formatEther(BigInt(value)));
    if (Number.isNaN(formatted)) {
      return "0";
    }
    return formatted.toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: fractionDigits
    });
  } catch (error) {
    return "0";
  }
};

const shortenAddress = (address: string) => {
  if (!address) return "";
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
};

const formatDuration = (seconds?: number) => {
  if (!seconds) return "-";
  if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m`;
  }
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
};

export function RealMatchCard({ match }: RealMatchCardProps) {
  const theme = statusThemes[match.status] ?? FALLBACK_THEME;

  const monachads = (match.participants || []).filter(
    (participant) => participant.role === "MONACHAD"
  );
  const supporters = (match.participants || []).filter(
    (participant) => participant.role === "SUPPORTER"
  );

  const startTime = match.startTime ? new Date(match.startTime) : null;
  const formattedStart = startTime
    ? startTime.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit"
      })
    : null;

  const supportersLabel = match.maxSupporters
    ? `${supporters.length}/${match.maxSupporters}`
    : `${supporters.length}`;

  const entryMarginEth = formatEth(match.entryMargin);
  const prizePoolEth = formatEth(match.prizePool);

  return (
    <Link href={`/matches/${match.matchId}`} className="block group">
      <div
        className={`relative bg-black/40 backdrop-blur-xl border ${theme.border} rounded-3xl p-8 shadow-2xl transition-all duration-300 group-hover:border-purple-400/60 group-hover:shadow-purple-500/10`}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 via-transparent to-blue-500/10 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

        <div className="relative flex flex-col gap-6">
          <header className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-4 mb-3">
                <h3 className="text-3xl font-bold text-purple-200">
                  Match #{match.matchId}
                </h3>
                <span
                  className={`text-sm px-4 py-1 rounded-full font-semibold border ${theme.label}`}
                >
                  {match.status}
                </span>
              </div>
              <p className="text-sm text-white/60 flex items-center gap-2">
                <span>Competing Traders:</span>
                <span className="text-white font-semibold">
                  {monachads.length}
                </span>
                <span className="text-white/50">/</span>
                <span className="text-white/80">{match.maxParticipants}</span>
              </p>
            </div>

            <div className="text-right space-y-1">
              <p className="text-sm text-white/40">Prize Pool</p>
              <p className="text-2xl font-bold text-green-400">
                {prizePoolEth} ETH
              </p>
              {formattedStart && (
                <p className="text-xs text-white/50">
                  Started {formattedStart}
                </p>
              )}
            </div>
          </header>

          <section className="grid gap-4 md:grid-cols-4">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
              <p className="text-xs text-white/50 mb-2">Entry Margin</p>
              <p className="text-xl font-semibold text-purple-200">
                {entryMarginEth} ETH
              </p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
              <p className="text-xs text-white/50 mb-2">Supporters</p>
              <p className="text-xl font-semibold text-blue-300">
                {supportersLabel}
              </p>
              <p className="text-xs text-white/40">Active supporters</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
              <p className="text-xs text-white/50 mb-2">Duration</p>
              <p className="text-xl font-semibold text-white">
                {formatDuration(match.duration)}
              </p>
              <p className="text-xs text-white/40">Configured runtime</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
              <p className="text-xs text-white/50 mb-2">Allowed DEXes</p>
              <p className="text-xl font-semibold text-white">
                {match.allowedDexes?.length ?? 0}
              </p>
              <p className="text-xs text-white/40">Curated targets</p>
            </div>
          </section>

          {monachads.length > 0 && (
            <section>
              <p className="text-sm text-white/50 mb-3 font-semibold uppercase tracking-[0.08em]">
                Monachads in this match
              </p>
              <div className="flex flex-wrap gap-3">
                {monachads.map((participant) => (
                  <div
                    key={participant.address}
                    className="px-4 py-2 rounded-full bg-purple-500/15 border border-purple-500/30 text-sm text-purple-200 font-medium shadow-sm shadow-purple-500/10"
                  >
                    {shortenAddress(participant.address)}
                  </div>
                ))}
              </div>
            </section>
          )}

          {supporters.length > 0 && (
            <section>
              <p className="text-sm text-white/50 mb-3 font-semibold uppercase tracking-[0.08em]">
                Active supporters
              </p>
              <div className="flex flex-wrap gap-2">
                {supporters.slice(0, 8).map((supporter) => (
                  <span
                    key={supporter.address}
                    className="text-xs px-3 py-1 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-200"
                  >
                    {shortenAddress(supporter.address)}
                  </span>
                ))}
                {supporters.length > 8 && (
                  <span className="text-xs px-3 py-1 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-200">
                    +{supporters.length - 8} more
                  </span>
                )}
              </div>
            </section>
          )}

          <footer className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pt-2">
            <div className={`text-sm font-semibold ${theme.text}`}>
              View match details →
            </div>
            <div className="flex flex-wrap gap-3">
              <span className="px-4 py-2 rounded-full bg-white/5 border border-white/10 text-xs text-white/60 uppercase tracking-[0.2em]">
                Monachad Mode
              </span>
              <span className="px-4 py-2 rounded-full bg-white/5 border border-white/10 text-xs text-white/60 uppercase tracking-[0.2em]">
                Copy Trading Ready
              </span>
            </div>
          </footer>
        </div>
      </div>
    </Link>
  );
}
