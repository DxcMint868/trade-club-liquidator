"use client"

import { useEffect, useRef, useState } from "react"

const stats = [
  {
    label: "Tonight's Competitors",
    value: "Monachad vs. DegenKing",
    color: "hsl(var(--neon-purple))",
  },
  {
    label: "Prize Pool",
    value: "$50,000",
    color: "hsl(var(--neon-orange))",
    highlight: true,
  },
  {
    label: "Live Viewers",
    value: "12,847",
    color: "hsl(var(--neon-blue))",
  },
  {
    label: "Match Type",
    value: "5x Leverage Battle",
    color: "hsl(var(--neon-purple))",
  },
]

export function StatsSection() {
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
    <section ref={ref} className="relative py-24 px-4 overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 opacity-5">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `repeating-linear-gradient(0deg, hsl(var(--neon-purple)) 0px, transparent 1px, transparent 40px)`,
          }}
        />
      </div>

      <div className="max-w-6xl mx-auto relative z-10">
        <h3
          className={`text-3xl md:text-5xl font-bold text-center mb-16 transition-all duration-700 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}
          style={{ color: "hsl(var(--neon-orange))" }}
        >
          Tonight's Battle
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {stats.map((stat, index) => (
            <div
              key={index}
              className={`relative p-6 border-2 rounded-lg transition-all duration-700 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}
              style={{
                transitionDelay: `${index * 0.1}s`,
                ...(stat.highlight
                  ? {
                      borderColor: "hsl(var(--neon-orange))",
                      backgroundColor: "rgba(255, 133, 51, 0.05)",
                    }
                  : {
                      borderColor: "hsl(var(--border))",
                      backgroundColor: "rgba(0, 0, 0, 0.3)",
                    }),
              }}
            >
              <div className="text-sm text-muted-foreground mb-2 uppercase tracking-wider">{stat.label}</div>
              <div
                className={`text-2xl md:text-4xl font-bold ${stat.highlight ? "neon-glow" : ""}`}
                style={{ color: stat.color }}
              >
                {stat.value}
              </div>

              {stat.highlight && (
                <div
                  className="absolute -top-3 -right-3 text-xs font-bold px-3 py-1 rounded-full"
                  style={{
                    backgroundColor: "hsl(var(--neon-orange))",
                    color: "hsl(var(--background))",
                  }}
                >
                  BIGGEST POT YET
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Call to action */}
        <div
          className={`text-center mt-16 transition-all duration-700 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}
          style={{ transitionDelay: "0.5s" }}
        >
          <p className="text-xl text-foreground/70 italic">The arena awaits. Will you compete or spectate?</p>
        </div>
      </div>
    </section>
  )
}
