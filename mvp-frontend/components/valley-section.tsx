"use client"

import { Card } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Trophy, Users, TrendingUp } from "lucide-react"
import { useEffect, useRef, useState } from "react"

const topTraders = [
  { 
    name: "MonaPhantom", 
    points: 15420, 
    rank: 1, 
    quote: "I don't just trade, I liquidate dreams.",
    title: "The Phantom Liquidator"
  },
  { 
    name: "DegenKing", 
    points: 12890, 
    rank: 2, 
    quote: "Every dip is an opportunity, every pump is destiny.",
    title: "The Degen Monarch"
  },
  { 
    name: "LiquidHunter", 
    points: 11250, 
    rank: 3, 
    quote: "I hunt in the shadows of volatility.",
    title: "The Shadow Hunter"
  },
]

const steps = [
  {
    icon: Users,
    title: "Create Match",
    description: "Start a trading tournament and invite other degens to compete",
    color: "hsl(var(--neon-purple))",
  },
  {
    icon: TrendingUp,
    title: "Compete",
    description: "Trade in real-time and climb the leaderboard with your skills",
    color: "hsl(var(--neon-blue))",
  },
  {
    icon: Trophy,
    title: "Copy/Support",
    description: "Follow top traders or become the Monachad everyone copies",
    color: "hsl(var(--neon-orange))",
  },
]

export function ValleySection() {
  const [isVisible, setIsVisible] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
        }
      },
      { threshold: 0.2 },
    )

    if (ref.current) {
      observer.observe(ref.current)
    }

    return () => observer.disconnect()
  }, [])

  return (
    <section 
      ref={ref}
      className="relative min-h-screen py-20 px-4" 
      id="leaderboard"
    >
      <div 
        className={`transition-all duration-1000 ${
          isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"
        }`}
      >
      {/* Valley arena background */}
      <div className="absolute inset-0 overflow-hidden">
        <svg viewBox="0 0 1200 600" className="absolute bottom-0 w-full opacity-20">
          <path d="M 0 400 Q 300 300 600 350 T 1200 400 L 1200 600 L 0 600 Z" fill="hsl(var(--neon-purple))" opacity="0.1" />
          <path d="M 0 450 Q 300 380 600 420 T 1200 450 L 1200 600 L 0 600 Z" fill="hsl(var(--neon-blue))" opacity="0.1" />
        </svg>
      </div>

      <div className="relative z-10 w-full px-4 lg:px-8">
        {/* Section title */}
        <div className="text-center mb-16">
          <h2
            className="text-5xl md:text-6xl font-bold mb-4 neon-glow text-balance"
            style={{ color: "hsl(var(--neon-purple))" }}
          >
            The Valley of Monachads
          </h2>
          <p className="text-xl text-foreground/80 text-balance">Where legends are made and degens get liquidated</p>
        </div>

        {/* Leaderboard preview */}
        <div className="mb-16">
          <h3 className="text-3xl font-bold mb-12 flex items-center justify-center gap-3" style={{ color: "hsl(var(--neon-orange))" }}>
            <Trophy className="w-8 h-8" />
            CHAD LEADERBOARD
          </h3>
          
          {/* Character-based leaderboard */}
          <div className="space-y-16">
            {topTraders.map((trader, index) => {
              const isEvenIndex = index % 2 === 0;
              const characterImage = `monachad${index + 1}.png`;
              
              return (
                <div
                  key={trader.rank}
                  className={`flex items-center gap-12 lg:gap-20 xl:gap-24 ${
                    isEvenIndex ? 'flex-row-reverse justify-start pr-0 lg:pr-16' : 'flex-row justify-start pl-0 lg:pl-16'
                  } w-full`}
                >
                  {/* Character Image - Much Bigger */}
                  <div className="flex-shrink-0 relative">
                    <img 
                      src={`/${characterImage}`} 
                      alt={`Monachad ${index + 1}`} 
                      className={`${
                        trader.rank === 3 
                          ? 'w-64 h-64 md:w-80 md:h-80 lg:w-96 lg:h-96 xl:w-[28rem] xl:h-[28rem]'
                          : 'w-56 h-56 md:w-72 md:h-72 lg:w-80 lg:h-80 xl:w-96 xl:h-96'
                      } object-contain`}
                      style={{
                        filter: `drop-shadow(0 0 40px ${
                          trader.rank === 1
                            ? 'rgba(255, 133, 51, 0.8)'
                            : trader.rank === 2
                              ? 'rgba(51, 144, 255, 0.8)'
                              : 'rgba(168, 85, 247, 0.8)'
                        })`,
                        animation: 'float 8s ease-in-out infinite'
                      }}
                    />
                  </div>

                  {/* Testimonial-Style Stats Card */}
                  <div className="flex-1 max-w-2xl">
                    <Card 
                      className="bg-black/50 backdrop-blur-md p-8 lg:p-10 border-2 transition-all hover:scale-[1.02] relative overflow-hidden"
                      style={{ 
                        borderColor: trader.rank === 1
                          ? "hsl(var(--neon-orange) / 0.5)"
                          : trader.rank === 2
                            ? "hsl(var(--neon-blue) / 0.5)"
                            : "hsl(var(--neon-purple) / 0.5)",
                        background: `linear-gradient(135deg, 
                          rgba(0, 0, 0, 0.8) 0%, 
                          ${trader.rank === 1
                            ? "rgba(255, 133, 51, 0.15)"
                            : trader.rank === 2
                              ? "rgba(51, 144, 255, 0.15)"
                              : "rgba(168, 85, 247, 0.15)"
                          } 100%)`
                      }}
                    >
                      {/* Quote Icon */}
                      <div 
                        className="absolute top-4 left-4 text-6xl opacity-20 font-serif"
                        style={{ 
                          color: trader.rank === 1
                            ? "hsl(var(--neon-orange))"
                            : trader.rank === 2
                              ? "hsl(var(--neon-blue))"
                              : "hsl(var(--neon-purple))"
                        }}
                      >
                        "
                      </div>
                      
                      <div className={`${isEvenIndex ? 'text-left' : 'text-right'} relative z-10`}>
                        {/* Quote */}
                        <blockquote className="text-lg md:text-xl lg:text-2xl font-medium text-foreground/90 mb-6 italic leading-relaxed">
                          "{trader.quote}"
                        </blockquote>
                        
                        {/* Name and Title */}
                        <div className="mb-4">
                          <h4 
                            className="text-3xl md:text-4xl lg:text-5xl font-black mb-2"
                            style={{ 
                              color: trader.rank === 1
                                ? "hsl(var(--neon-orange))"
                                : trader.rank === 2
                                  ? "hsl(var(--neon-blue))"
                                  : "hsl(var(--neon-purple))"
                            }}
                          >
                            {trader.name}
                          </h4>
                          <p className="text-foreground/70 text-lg md:text-xl font-semibold">
                            {trader.title}
                          </p>
                        </div>
                        
                        {/* Stats */}
                        <div className={`flex flex-col gap-2 ${isEvenIndex ? 'items-start' : 'items-end'}`}>
                          <div className="flex items-center gap-3">
                            <span className="text-lg text-foreground/60">Rank:</span>
                            <span 
                              className="text-2xl md:text-3xl font-bold"
                              style={{ 
                                color: trader.rank === 1
                                  ? "hsl(var(--neon-orange))"
                                  : trader.rank === 2
                                    ? "hsl(var(--neon-blue))"
                                    : "hsl(var(--neon-purple))"
                              }}
                            >
                              {trader.rank === 1 ? "👑 CHAMPION" : trader.rank === 2 ? "🥈 VETERAN" : "🥉 MASTER"}
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-lg text-foreground/60">XP:</span>
                            <span 
                              className="text-3xl md:text-4xl lg:text-5xl font-black"
                              style={{ 
                                color: trader.rank === 1
                                  ? "hsl(var(--neon-orange))"
                                  : trader.rank === 2
                                    ? "hsl(var(--neon-blue))"
                                    : "hsl(var(--neon-purple))"
                              }}
                            >
                              {trader.points.toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    </Card>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* How it works */}
        <div className="mb-16">
          <h3 className="text-4xl font-bold text-center mb-12 text-balance" style={{ color: "hsl(var(--neon-blue))" }}>
            How It Works
          </h3>
          <div className="grid md:grid-cols-3 gap-8">
            {steps.map((step, index) => (
              <Card
                key={index}
                className="bg-black/30 transition-all p-6 text-center group hover:scale-105"
                style={{ borderColor: "hsl(var(--border))" }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "hsl(var(--neon-purple) / 0.5)"
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "hsl(var(--border))"
                }}
              >
                <div
                  className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center transition-all"
                  style={{
                    background: step.color,
                    color: "hsl(var(--background))",
                  }}
                >
                  <step.icon className="w-8 h-8" />
                </div>
                <h4 className="text-2xl font-bold mb-3" style={{ color: step.color }}>
                  {step.title}
                </h4>
                <p className="text-foreground/70 text-balance">{step.description}</p>
              </Card>
            ))}
          </div>
        </div>

        {/* Footer */}
        <footer className="text-center pt-16 border-t border-border">
          <div className="flex justify-center gap-8 mb-8">
            <a
              href="#"
              className="text-foreground/60 transition-colors"
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "hsl(var(--neon-purple))"
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "hsl(var(--foreground) / 0.6)"
              }}
            >
              Twitter
            </a>
            <a
              href="#"
              className="text-foreground/60 transition-colors"
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "hsl(var(--neon-purple))"
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "hsl(var(--foreground) / 0.6)"
              }}
            >
              Discord
            </a>
            <a
              href="#"
              className="text-foreground/60 transition-colors"
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "hsl(var(--neon-purple))"
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "hsl(var(--foreground) / 0.6)"
              }}
            >
              Docs
            </a>
            <a
              href="#"
              className="text-foreground/60 transition-colors"
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "hsl(var(--neon-purple))"
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "hsl(var(--foreground) / 0.6)"
              }}
            >
              Terms
            </a>
          </div>
          <p className="text-foreground/40 text-sm">© 2025 TradeClub. Built on Monad. Powered by degens.</p>
        </footer>
      </div>
      </div>
    </section>
  )
}
