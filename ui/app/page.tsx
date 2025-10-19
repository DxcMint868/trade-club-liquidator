'use client'

import { HeroSection } from "@/components/hero-section"
import { StatsSection } from "@/components/stats-section"
import { ValleySection } from "@/components/valley-section"
import { Navigation } from "@/components/navigation"
import LightRays from '../components/ui/light-rays';
import { ColorProvider } from "@/contexts/color-context"

export default function Home() {
  return (
    <ColorProvider>
      <main className="relative min-h-screen">
        {/* Smooth gradient background that transitions from custom purple to black across the entire page */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#080413] via-[#060310] via-30% to-[#04020d] to-60% to-black" />
        
        <div className="relative z-0">
          <Navigation />
          {/* Extended light rays with fade-out - covers full page dynamically */}
          <div className="absolute inset-0 z-10 pointer-events-none">
            <div className="relative w-full h-full">
              <LightRays
                raysOrigin="top-center"
                raysColor="#ffffff"
                raysSpeed={1.5}
                lightSpread={0.8}
                rayLength={3.0}
                followMouse={true}
                mouseInfluence={0.1}
                noiseAmount={0.1}
                distortion={0.05}
                className="custom-rays"
              />
              {/* Smooth fade-out gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent via-70% to-[#080413] pointer-events-none" />
            </div>
          </div>
          {/* Content with higher z-index */}
          <div className="relative z-20">
            <HeroSection />
            <StatsSection />
            <ValleySection />
          </div>
        </div>
      </main>
    </ColorProvider>
  )
}
