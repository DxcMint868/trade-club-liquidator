"use client"

import { Button } from "@/components/ui/button"
import { useColor } from "@/contexts/color-context"

export function Navigation() {
  const { currentColor } = useColor()
  
  return (
    <nav className="fixed top-8 left-1/2 -translate-x-1/2 z-50 w-[95%] max-w-7xl">
      <div className="relative bg-black/40 backdrop-blur-xl border border-white/10 rounded-full px-8 py-4 flex items-center justify-between shadow-2xl">
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-purple-500/5 via-transparent to-purple-500/5 rounded-full pointer-events-none" />
        
        {/* Logo */}
        <div className="relative flex items-center gap-2">
          <div 
            className="text-2xl font-bold transition-colors duration-700" 
            style={{ color: currentColor }}
          >
            TradeClub
          </div>
        </div>
        
        {/* Navigation Links */}
        <div className="hidden md:flex items-center gap-8">
          <a 
            href="#leaderboard" 
            className="text-white/70 hover:text-white transition-colors text-sm font-medium"
          >
            Leaderboard
          </a>
          <a 
            href="#join" 
            className="text-white/70 hover:text-white transition-colors text-sm font-medium"
          >
            Join Match
          </a>
          <a 
            href="#about" 
            className="text-white/70 hover:text-white transition-colors text-sm font-medium"
          >
            About
          </a>
          <Button
            className="rounded-full px-6 py-2 text-sm font-medium transition-all duration-700"
            style={{
              border: `1px solid ${currentColor}`,
              color: currentColor,
              backgroundColor: "transparent",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = currentColor
              e.currentTarget.style.color = "white"
              e.currentTarget.style.boxShadow = `0 0 20px ${currentColor}`
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent"
              e.currentTarget.style.color = currentColor
              e.currentTarget.style.boxShadow = "none"
            }}
          >
            Connect Wallet
          </Button>
        </div>
      </div>
    </nav>
  )
}
