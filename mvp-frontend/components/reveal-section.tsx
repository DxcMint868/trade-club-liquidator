"use client"

import { useEffect, useRef, useState } from "react"
import { useColor } from "@/contexts/color-context"

const crowdQuotes = [
  { text: "Who's getting liquidated tonight?", position: "top-20 left-10", delay: 0.2 },
  { text: "Monachad incoming...", position: "top-40 right-20", delay: 0.4 },
  { text: "This pot is insane", position: "bottom-40 left-20", delay: 0.6 },
  { text: "I'm all in", position: "bottom-32 right-10", delay: 0.8 },
  { text: "Watch this trade", position: "top-1/2 left-5", delay: 1.0 },
  { text: "He's gonna get rekt", position: "top-1/2 right-5", delay: 1.2 },
]

export function RevealSection() {
  const [isVisible, setIsVisible] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const { setColorProgress, currentColor } = useColor()

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
        }
        
        // Calculate scroll progress for color transition
        const rect = entry.boundingClientRect
        const windowHeight = window.innerHeight
        
        // Start transition when element enters bottom of viewport
        // Complete transition when element reaches middle of viewport
        if (rect.top < windowHeight && rect.bottom > 0) {
          const progress = Math.min(Math.max((windowHeight - rect.top) / windowHeight, 0), 1)
          setColorProgress(progress)
        }
      },
      { threshold: Array.from({ length: 101 }, (_, i) => i / 100) }, // Smooth transition
    )

    if (ref.current) {
      observer.observe(ref.current)
    }

    return () => observer.disconnect()
  }, [setColorProgress])

  return (
    <div
      ref={ref}
      className="min-h-screen flex items-center justify-center relative overflow-hidden"
    >
      {/* Main reveal text */}
      <div
        className={`relative z-10 text-center px-4 max-w-5xl transition-all duration-1000 ${isVisible ? "opacity-100 scale-100" : "opacity-0 scale-95"}`}
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
          className={`absolute hidden md:block text-sm md:text-base italic text-foreground/60 transition-all duration-700 ${quote.position} ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}
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
    </div>
  )
}
