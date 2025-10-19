"use client"

import { createContext, useContext, useState, useEffect, ReactNode } from "react"

interface ColorContextType {
  currentColor: string
  currentBgColor: string
  setColorProgress: (progress: number) => void
}

const ColorContext = createContext<ColorContextType>({
  currentColor: "#60a5fa",
  currentBgColor: "hsl(220, 30%, 15%)",
  setColorProgress: () => {},
})

export function ColorProvider({ children }: { children: ReactNode }) {
  const [currentColor, setCurrentColor] = useState("#60a5fa") // Start with blue
  const [currentBgColor, setCurrentBgColor] = useState("#080413") // Start with custom dark purple

  const setColorProgress = (progress: number) => {
    // progress: 0 = blue, 1 = purple
    // Blue: #60a5fa (rgb: 96, 165, 250)
    // Purple: #a855f7 (rgb: 168, 85, 247)
    
    const blue = { r: 96, g: 165, b: 250 }
    const purple = { r: 168, g: 85, b: 247 }
    
    const r = Math.round(blue.r + (purple.r - blue.r) * progress)
    const g = Math.round(blue.g + (purple.g - blue.g) * progress)
    const b = Math.round(blue.b + (purple.b - blue.b) * progress)
    
    setCurrentColor(`rgb(${r}, ${g}, ${b})`)
    
    // Background color transition
    // Dark purple bg: hsl(270, 35%, 18%)
    // Deeper purple bg: hsl(270, 30%, 14%)
    const bgHue = 270 // Keep purple hue constant
    const bgSat = Math.round(35 + (28 - 35) * progress)
    const bgLight = Math.round(18 + (14 - 18) * progress)
    
    setCurrentBgColor(`hsl(${bgHue}, ${bgSat}%, ${bgLight}%)`)
  }

  return (
    <ColorContext.Provider value={{ currentColor, currentBgColor, setColorProgress }}>
      {children}
    </ColorContext.Provider>
  )
}

export const useColor = () => useContext(ColorContext)
