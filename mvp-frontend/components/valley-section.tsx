"use client"

import { Card } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Trophy, Users, TrendingUp } from "lucide-react"

const topTraders = [
  { name: "Monachad", points: 15420, rank: 1 },
  { name: "DegenKing", points: 12890, rank: 2 },
  { name: "LiquidHunter", points: 11250, rank: 3 },
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
  return (
    <section className="relative min-h-screen py-20 px-4" id="leaderboard">
      {/* Valley arena background */}
      <div className="absolute inset-0 overflow-hidden">
        <svg viewBox="0 0 1200 600" className="absolute bottom-0 w-full opacity-20">
          <path d="M 0 400 Q 300 300 600 350 T 1200 400 L 1200 600 L 0 600 Z" fill="hsl(var(--neon-purple))" opacity="0.1" />
          <path d="M 0 450 Q 300 380 600 420 T 1200 450 L 1200 600 L 0 600 Z" fill="hsl(var(--neon-blue))" opacity="0.1" />
        </svg>
      </div>

      <div className="relative z-10 container mx-auto max-w-6xl">
        {/* Section title */}
        <div className="text-center mb-16">
          <h2
            className="text-5xl md:text-6xl font-bold mb-4 neon-glow text-balance"
            style={{ color: "hsl(var(--neon-purple))" }}
          >
            The Valley
          </h2>
          <p className="text-xl text-foreground/80 text-balance">Where legends are made and degens get liquidated</p>
        </div>

        {/* Leaderboard preview */}
        <Card className="bg-black/30 p-8 mb-16" style={{ borderColor: "hsl(var(--neon-purple) / 0.3)" }}>
          <h3 className="text-3xl font-bold mb-8 flex items-center gap-3" style={{ color: "hsl(var(--neon-orange))" }}>
            <Trophy className="w-8 h-8" />
            Top Traders
          </h3>
          <div className="space-y-4">
            {topTraders.map((trader) => (
              <div
                key={trader.rank}
                className="flex items-center justify-between p-4 rounded-lg bg-background/50 border border-border hover:border-[hsl(var(--neon-purple))]/50 transition-all"
              >
                <div className="flex items-center gap-4">
                  <div
                    className="text-2xl font-bold w-10 h-10 flex items-center justify-center rounded-full"
                    style={{
                      background:
                        trader.rank === 1
                          ? "hsl(var(--neon-orange))"
                          : trader.rank === 2
                            ? "hsl(var(--neon-blue))"
                            : "hsl(var(--neon-purple))",
                      color: "hsl(var(--background))",
                    }}
                  >
                    {trader.rank}
                  </div>
                  <Avatar className="w-12 h-12 border-2" style={{ borderColor: "hsl(var(--neon-purple))" }}>
                    <AvatarFallback
                      style={{
                        backgroundColor: "hsl(var(--neon-purple) / 0.2)",
                        color: "hsl(var(--neon-purple))",
                      }}
                    >
                      {trader.name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-xl font-semibold">{trader.name}</span>
                </div>
                <div className="text-2xl font-bold" style={{ color: "hsl(var(--neon-purple))" }}>
                  {trader.points.toLocaleString()} XP
                </div>
              </div>
            ))}
          </div>
        </Card>

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
    </section>
  )
}
