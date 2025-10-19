"use client"

import { Button } from "@/components/ui/button"
import { useColor } from "@/contexts/color-context"
import { useEffect, useRef, useState } from "react"
import Link from "next/link"

const crowdQuotes = [
  { text: "Who's getting liquidated tonight?", position: "top-48 left-64", delay: 0.2 },
  { text: "Monachad incoming...", position: "top-48 right-64", delay: 0.4 },
  { text: "This pot is insane", position: "bottom-48 left-72", delay: 0.6 },
  { text: "I'm all in", position: "bottom-52 right-72", delay: 0.8 },
  { text: "Clip this chat", position: "top-1/2 left-40", delay: 1.0 },
  { text: "He's gonna get rekt", position: "top-1/2 right-40", delay: 1.2 },
]

export function HeroSection() {
  const { currentColor, setColorProgress } = useColor()
  const [revealVisible, setRevealVisible] = useState(false)
  const revealRef = useRef<HTMLDivElement>(null)
  
  useEffect(() => {
    // Observer for the second section (reveal)
    const revealObserver = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setRevealVisible(true)
        }
        
        // Calculate scroll progress for color transition - FASTER transition
        const rect = entry.boundingClientRect
        const windowHeight = window.innerHeight
        
        if (rect.top < windowHeight && rect.bottom > 0) {
          // Speed up the transition by using a steeper curve and starting earlier
          const rawProgress = Math.min(Math.max((windowHeight - rect.top) / (windowHeight * 0.6), 0), 1)
          // Apply easing curve to make it faster at the start
          const easedProgress = rawProgress * rawProgress * (3 - 2 * rawProgress) // smooth step function
          setColorProgress(easedProgress)
        }
      },
      { threshold: 0.2 } // Start revealing when 20% of the section is visible
    )

    if (revealRef.current) {
      revealObserver.observe(revealRef.current)
    }

    return () => {
      revealObserver.disconnect()
    }
  }, [setColorProgress])
  
  return (
    <>
      {/* First part - What's the first rule */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* Pepemon5 on the bottom left corner */}
        <div className="absolute left-0 bottom-8 md:bottom-12 lg:bottom-16 z-5">
          <img 
            src="/pepemon5.png" 
            alt="Pepemon5" 
            className="w-48 md:w-64 lg:w-80 xl:w-96 h-auto opacity-90"
            style={{
              filter: 'drop-shadow(0 0 30px rgba(168, 85, 247, 0.4))',
              animation: 'float 6s ease-in-out infinite'
            }}
          />
        </div>

        {/* Hedgehogmon1 on the bottom right corner */}
        <div className="absolute right-0 bottom-8 md:bottom-12 lg:bottom-16 z-5">
          <img 
            src="/hedgehogmon1.png" 
            alt="Hedgehogmon1" 
            className="w-64 md:w-80 lg:w-96 xl:w-96 h-auto opacity-90"
            style={{
              filter: 'drop-shadow(0 0 30px rgba(168, 85, 247, 0.4))',
              animation: 'float 8s ease-in-out infinite reverse'
            }}
          />
        </div>

        <div className="relative z-10 text-center px-4 max-w-5xl mx-auto">
          <h1
            className="text-6xl md:text-8xl font-bold animate-fade-in-up text-balance transition-colors duration-300"
            style={{ color: currentColor }}
          >
            What's the first rule of TradeClub?
          </h1>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-32 left-1/2 -translate-x-1/2 animate-bounce">
          <div
            className="w-6 h-10 border-2 rounded-full flex items-start justify-center p-2 transition-colors duration-300"
            style={{ borderColor: currentColor }}
          >
            <div 
              className="w-1 h-2 rounded-full transition-colors duration-300" 
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
            className="text-6xl md:text-8xl font-bold text-balance transition-colors duration-300" 
            style={{ color: currentColor }}
          >
            No one speaks of TradeClub
          </h2>

          <div className="mt-10 md:mt-16 flex justify-center">
            <Link href="/matches">
              <button
                aria-label="Enter the arena"
                className="px-8 py-3 rounded-full text-lg font-semibold bg-[#0b0b0d] border-2 transition-colors duration-300 ease-out hover:bg-[hsl(var(--neon-purple))] hover:text-[#0b0b0d] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--neon-purple))]"
                style={{
                  borderColor: 'hsl(var(--neon-purple))',
                  color: 'white',
                  boxShadow: '0 6px 18px rgba(12,8,20,0.6)'
                }}
              >
                Enter the arena
              </button>
            </Link>
          </div>
        </div>

        {/* Crowd quotes floating around */}
        {crowdQuotes.map((quote, index) => (
            <div
              key={index}
              className={`absolute hidden md:block italic text-foreground/60 transition-all duration-700 ${quote.position} ${revealVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}
              style={{
                transitionDelay: `${quote.delay}s`,
              }}
            >
                <span
                  className="text-lg md:text-xl lg:text-2xl"
                  style={{
                    color: 'rgba(255,255,255,0.75)',
                    animation: `popScale${(index % 3) + 1} ${1.5 + index * 0.2}s ease-in-out infinite`,
                    animationDelay: `${quote.delay}s`,
                    transformOrigin: 'center',
                    display: 'inline-block',
                  }}
                >
                  "{quote.text}"
                </span>
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
