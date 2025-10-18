"use client"

import { Button } from "@/components/ui/button"
import { useColor } from "@/contexts/color-context"
import { useEffect, useRef, useState } from "react"

const crowdQuotes = [
  { text: "Who's getting liquidated tonight?", position: "top-20 left-10", delay: 0.2 },
  { text: "Monachad incoming...", position: "top-40 right-20", delay: 0.4 },
  { text: "This pot is insane", position: "bottom-40 left-20", delay: 0.6 },
  { text: "I'm all in", position: "bottom-32 right-10", delay: 0.8 },
  { text: "Watch this trade", position: "top-1/2 left-5", delay: 1.0 },
  { text: "He's gonna get rekt", position: "top-1/2 right-5", delay: 1.2 },
]

export function HeroSection() {
  const { currentColor, setColorProgress } = useColor()
  const [revealVisible, setRevealVisible] = useState(false)
  const revealRef = useRef<HTMLDivElement>(null)
  
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setRevealVisible(true)
        }
        
        // Calculate scroll progress for color transition
        const rect = entry.boundingClientRect
        const windowHeight = window.innerHeight
        
        if (rect.top < windowHeight && rect.bottom > 0) {
          const progress = Math.min(Math.max((windowHeight - rect.top) / windowHeight, 0), 1)
          setColorProgress(progress)
        }
      },
      { threshold: Array.from({ length: 101 }, (_, i) => i / 100) },
    )

    if (revealRef.current) {
      observer.observe(revealRef.current)
    }

    return () => observer.disconnect()
  }, [setColorProgress])
  
  return (
    <>
      {/* First part - What's the first rule */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        <div className="relative z-10 text-center px-4 max-w-5xl mx-auto">
          <h1
            className="text-6xl md:text-8xl font-bold animate-fade-in-up text-balance transition-colors duration-700"
            style={{ color: currentColor }}
          >
            What's the first rule of TradeClub?
          </h1>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-32 left-1/2 -translate-x-1/2 animate-bounce">
          <div
            className="w-6 h-10 border-2 rounded-full flex items-start justify-center p-2 transition-colors duration-700"
            style={{ borderColor: currentColor }}
          >
            <div 
              className="w-1 h-2 rounded-full transition-colors duration-700" 
              style={{ backgroundColor: currentColor }} 
            />
          </div>
        </div>
      </section>

      {/* Second part - No one speaks (reveal) */}
      <section
        ref={revealRef}
        className="relative min-h-screen flex items-center justify-center overflow-hidden"
      >
        <div
          className={`relative z-10 text-center px-4 max-w-5xl transition-all duration-1000 ${revealVisible ? "opacity-100 scale-100" : "opacity-0 scale-95"}`}
        >
          <h2 
            className="text-6xl md:text-8xl font-bold text-balance transition-colors duration-700" 
            style={{ color: currentColor }}
          >
            No one speaks of TradeClub
          </h2>
        </div>

        {/* Crowd quotes floating around */}
        {crowdQuotes.map((quote, index) => (
          <div
            key={index}
            className={`absolute hidden md:block text-sm md:text-base italic text-foreground/60 transition-all duration-700 ${quote.position} ${revealVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}
            style={{
              transitionDelay: `${quote.delay}s`,
            }}
          >
            "{quote.text}"
          </div>
        ))}

        {/* Decorative elements */}
        <div
          className="absolute top-1/4 left-1/4 w-2 h-2 rounded-full animate-pulse"
          style={{ backgroundColor: "hsl(var(--neon-purple))" }}
        />
        <div
          className="absolute bottom-1/3 right-1/3 w-2 h-2 rounded-full animate-pulse delay-300"
          style={{ backgroundColor: "hsl(var(--neon-orange))" }}
        />
        <div
          className="absolute top-1/3 right-1/4 w-2 h-2 rounded-full animate-pulse delay-700"
          style={{ backgroundColor: "hsl(var(--neon-blue))" }}
        />
      </section>
    </>
  )
}
