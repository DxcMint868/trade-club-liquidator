"use client";

import { useState, useEffect, useRef } from "react";
import { useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import Link from "next/link";
import { Navigation } from "@/components/navigation";
import { Button } from "@/components/ui/button";
import { PvPMatchCard } from "@/components/matches/pvp-match-card";
import { BattleRoyaleMatchCard } from "@/components/matches/battle-royale-match-card";
import { UpcomingMatchCard } from "@/components/matches/upcoming-match-card";

export default function MatchesPage() {
  const { address, isConnected } = useAccount();
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [pepemonVisible, setPepemonVisible] = useState(false);
  const contentRef = useRef<HTMLDivElement | null>(null);

  // Fixed purple color for matches page
  const currentColor = "#a855f7"; // purple-500

  useEffect(() => {
    fetchMatches();
  }, []);

  // Pepemon3 visibility animation - appear in middle scroll range (only if wallet connected)
  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      const windowHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;
      const totalScrollable = documentHeight - windowHeight;
      
      // Show pepemon3 in middle range: 20% to 70% of scroll progress (only if wallet connected)
      const showStart = totalScrollable * 0.2;
      const showEnd = totalScrollable * 0.7;
      
      if (isConnected && scrollY >= showStart && scrollY <= showEnd) {
        setPepemonVisible(true);
      } else {
        setPepemonVisible(false);
      }
    };

    // Check initial position
    handleScroll();

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isConnected]);

  // Pepemon is always rendered, just positioned based on scroll

  const fetchMatches = async () => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/matches`
      );
      const data = await response.json();
      setMatches(data);
    } catch (err) {
      console.error("Failed to fetch matches:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="relative min-h-screen">
      {/* Same background gradient as landing page */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#080413] via-[#060310] via-30% to-[#04020d] to-black" />
      
      <div className="relative z-0">
        <Navigation color={currentColor} />
        
        {/* Light rays effect */}
        <div className="absolute inset-0 z-10 pointer-events-none">
          <div className="relative w-full h-full">
            {/* Fade-out gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent via-70% to-[#080413] pointer-events-none" />
          </div>
        </div>
        
        {/* Content with higher z-index */}
  <div className="relative z-20 pt-32 px-8">
          {/* Pepemon3 side image */}
          <div 
            className={`fixed left-0 top-[25vh] z-5 transition-all duration-700 ease-in-out pointer-events-none hidden lg:block ${
              pepemonVisible ? 'translate-x-0 opacity-95' : '-translate-x-full opacity-0'
            }`}
          >
            <img
              src="/pepemon3.png"
              alt="pepemon side"
              className="w-1/2 max-w-[600px]"
              style={{
                filter: 'drop-shadow(0 0 30px rgba(168, 85, 247, 0.4))',
                animation: pepemonVisible ? 'float 8s ease-in-out infinite' : 'none'
              }}
            />
          </div>
          <div ref={contentRef} className="max-w-6xl mx-auto">
            <h1 className="text-5xl md:text-6xl font-bold mb-12 text-center text-purple-300">
              The Arena
            </h1>

              {!isConnected ? (
                <div className="relative bg-black/40 backdrop-blur-xl border border-purple-500/20 rounded-3xl p-8 mb-8 shadow-2xl">
                  <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 via-transparent to-purple-500/10 rounded-3xl pointer-events-none" />
                  <div className="relative text-center">
                    <p className="text-white/70 mb-6 text-lg">
                      Connect your wallet to explore active matches
                    </p>
                    <ConnectButton />
                  </div>
                </div>
              ) : (
                <div className="space-y-8">
                  {loading ? (
                    <div className="relative bg-black/40 backdrop-blur-xl border border-purple-500/20 rounded-3xl p-8 shadow-2xl text-center">
                      <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 via-transparent to-purple-500/10 rounded-3xl pointer-events-none" />
                      <div className="relative text-white/70 text-lg">Loading matches...</div>
                    </div>
                  ) : matches.length === 0 ? (
                    // <div className="relative bg-black/40 backdrop-blur-xl border border-purple-500/20 rounded-3xl p-8 shadow-2xl text-center">
                    //   <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 via-transparent to-purple-500/10 rounded-3xl pointer-events-none" />
                    //   <div className="relative">
                    //     <p className="text-white/70 text-lg mb-6">
                    //       No matches available. Check back soon!
                    //     </p>
                    //     <Link href="/matches/create">
                    //       <Button className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white border-0 px-8 py-3 rounded-full font-semibold transition-all duration-300 hover:scale-105">
                    //         Create Match
                    //       </Button>
                    //     </Link>
                    //   </div>
                    // </div>
                    
                    // Mock matches
                    <div className="space-y-8">
                      {/* PvP Match */}
                      <PvPMatchCard
                        matchId="#DL001"
                        player1={{
                          name: "DegenKing",
                          margin: "$2,450",
                          pnl: "-$340",
                          winRate: "32.5%",
                          color: "blue",
                          isLeading: false
                        }}
                        player2={{
                          name: "MonaPhantom",
                          margin: "$3,312",
                          pnl: "+$862",
                          winRate: "67.5%",
                          color: "orange",
                          isLeading: true
                        }}
                        victoryProgress={67.5}
                        leadingPlayer="MonaPhantom"
                        leadingBy="35%"
                        matchDetails={{
                          marginCap: "$10K",
                          maxLeverage: "10x",
                          duration: "2h",
                          timeLeft: "47m"
                        }}
                        prizePool="2,500 $MON"
                      />

                      {/* Battle Royale Match */}
                      <BattleRoyaleMatchCard
                        matchId="#BR004"
                        players={[
                          { name: "LiquidHunter", margin: "$5,680", pnl: "+$1,200", rank: 1, isLeading: true },
                          { name: "MonaPhantom", margin: "$4,230", pnl: "+$780", rank: 2 },
                          { name: "DegenKing", margin: "$2,890", pnl: "+$320", rank: 3 },
                          { name: "CryptoNinja", margin: "$1,450", pnl: "-$150", rank: 4 }
                        ]}
                        matchDetails={{
                          currentPlayers: 4,
                          maxPlayers: 4,
                          marginCap: "$25K",
                          maxLeverage: "20x",
                          duration: "6h",
                          timeLeft: "3h 22m"
                        }}
                        prizePool={{
                          total: "15,500 $MON",
                          distribution: "Winner takes 60% • 2nd: 25% • 3rd: 15%"
                        }}
                        status="ACTIVE"
                      />

                      {/* Upcoming Battle Royale Match */}
                      <UpcomingMatchCard
                        matchId="#UP012"
                        matchType="Battle Royale"
                        startTime="2h 15m"
                        registeredPlayers={6}
                        maxPlayers={8}
                        matchDetails={{
                          marginCap: "$50K",
                          maxLeverage: "25x",
                          duration: "8h",
                          entryFee: "500 $MON"
                        }}
                        prizePool={{
                          total: "4,000 $MON",
                          distribution: "1st: 40% • 2nd: 25% • 3rd: 15% • 4th: 10% • 5th-8th: 2.5%"
                        }}
                      />

                      {/* Upcoming PvP Preset Battle */}
                      <UpcomingMatchCard
                        matchId="#UP013"
                        matchType="PvP"
                        startTime="45m"
                        presetBattle={{
                          player1: "Liquidat0r33",
                          player2: "DegenKing"
                        }}
                        matchDetails={{
                          marginCap: "$50K",
                          maxLeverage: "75x",
                          duration: "2h",
                          entryFee: "25K $MON"
                        }}
                        prizePool={{
                          total: "50,000 $MON",
                          distribution: "Winner takes all"
                        }}
                        liveViewers={12847}
                        specialTag="BIGGEST POT YET"
                      />
                    </div>
                  ) : (
                    <>
                      {matches.map((match) => (
                        <Link
                          key={match.matchId}
                          href={`/matches/${match.matchId}`}
                          className="block"
                        >
                          <div className="relative bg-black/40 backdrop-blur-xl border border-purple-500/20 rounded-3xl p-8 shadow-2xl hover:border-purple-500/40 transition-all duration-300 cursor-pointer group hover:scale-[1.01]">
                            <div className="absolute inset-0 bg-gradient-to-r from-purple-500/8 via-transparent to-purple-500/8 rounded-3xl pointer-events-none group-hover:from-purple-500/12 group-hover:to-purple-500/12 transition-all duration-300" />
                            
                            <div className="relative flex justify-between items-start">
                              <div className="flex-1">
                                <div className="flex items-center gap-4 mb-4">
                                  <h3 className="text-3xl font-bold text-purple-200">
                                    Match #{match.matchId}
                                  </h3>
                                  <span
                                    className={`text-sm px-4 py-2 rounded-full font-semibold ${
                                      match.status === "ACTIVE"
                                        ? "bg-green-600/20 text-green-400 border border-green-500/30"
                                        : match.status === "CREATED"
                                        ? "bg-blue-600/20 text-blue-400 border border-blue-500/30"
                                        : "bg-gray-600/20 text-gray-400 border border-gray-500/30"
                                    }`}
                                  >
                                    {match.status}
                                  </span>
                                </div>

                                <div className="grid grid-cols-2 gap-6 mb-4">
                                  <div>
                                    <p className="text-sm text-white/50 mb-1">
                                      Entry Fee (Monachads)
                                    </p>
                                    <p className="text-xl font-semibold text-purple-400">
                                      {(
                                        BigInt(match.entryMargin) / BigInt(10 ** 18)
                                      ).toString()}{" "}
                                      ETH
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-sm text-white/50 mb-1">
                                      Prize Pool
                                    </p>
                                    <p className="text-xl font-semibold text-green-400">
                                      {(
                                        BigInt(match.prizePool) / BigInt(10 ** 18)
                                      ).toString()}{" "}
                                      ETH
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-sm text-white/50 mb-1">
                                      Competing Traders
                                    </p>
                                    <p className="text-lg text-white">
                                      {match.participants?.length || 0} /{" "}
                                      {match.maxParticipants} Monachads
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-sm text-white/50 mb-1">Duration</p>
                                    <p className="text-lg text-white">
                                      {Math.floor(match.duration / 3600)} hours
                                    </p>
                                  </div>
                                </div>

                                {match.startTime && (
                                  <p className="text-sm text-white/50">
                                    🕐 Started:{" "}
                                    {new Date(match.startTime).toLocaleString()}
                                  </p>
                                )}
                              </div>

                              <div className="ml-8 text-right">
                                <div className="text-purple-400 font-semibold mb-3 text-lg">
                                  View Details →
                                </div>
                                <p className="text-sm text-white/50 mb-2">
                                  Choose your role:
                                </p>
                                <p className="text-sm text-white/70">
                                  • Compete as Monachad
                                </p>
                                <p className="text-sm text-white/70">
                                  • Follow a Monachad
                                </p>
                              </div>
                            </div>
                          </div>
                        </Link>
                      ))}
                    </>
                  )}

                  {/*
                  <div className="relative bg-black/40 backdrop-blur-xl border border-purple-500/30 rounded-3xl p-8 shadow-2xl">
                    <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 to-blue-900/20 rounded-3xl pointer-events-none" />
                    <div className="relative">
                      <h3 className="text-2xl font-bold mb-6 text-purple-200">💡 How TradeClub Works</h3>
                      <div className="grid md:grid-cols-2 gap-8">
                        <div>
                          <h4 className="font-semibold text-purple-400 mb-3 text-lg">
                            For Skilled Traders (Monachads)
                          </h4>
                          <ul className="text-white/70 space-y-3">
                            <li>• Compete against other traders</li>
                                <div aria-hidden className="pointer-events-none">
                                  <img src="/pepemon4.png" alt="" className="absolute left-1/2 transform -translate-x-1/2 bottom-0 w-96 opacity-95" />
                                </div>
                            <li>• Attract supporters to follow you</li>
                            <li>• Win prizes based on highest PnL</li>
                            <li>• Build your reputation</li>
                          </ul>
                        </div>
                        <div>
                          <h4 className="font-semibold text-blue-400 mb-3 text-lg">
                            👥 For Copy Traders (Supporters)
                          </h4>
                          <ul className="text-white/70 space-y-3">
                            <li>• Browse matches and see competing Monachads</li>
                            <li>• Choose a Monachad to follow</li>
                            <li>• Your smart account copies their trades</li>
                            <li>• Secure delegations with spending limits</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                  */}

                  {/* Bottom-centered image */}
                  <div className="mt-8 flex justify-center">
                    <img src="/pepemon4.png" alt="pepemon bottom" className="w-96 opacity-95" />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
    </main>
  );
}
