"use client"

import { Button } from "@/components/ui/button"
import { useColor } from "@/contexts/color-context"
import { ConnectButton } from '@rainbow-me/rainbowkit'
import Link from "next/link"

interface NavigationProps {
  color?: string;
}

export function Navigation({ color }: NavigationProps = {}) {
  const colorContext = useColor()
  
  // Use provided color prop or fall back to context color
  const currentColor = color || colorContext?.currentColor || "#3b82f6"
  
  return (
    <nav className="fixed top-8 left-1/2 -translate-x-1/2 z-50 w-[95%] max-w-7xl">
      <div 
        className="relative bg-black/40 backdrop-blur-xl rounded-full px-8 py-4 flex items-center justify-between shadow-2xl"
        style={{
          border: `1px solid ${currentColor}50`,
          boxShadow: `0 0 15px ${currentColor}25, 0 4px 20px rgba(0,0,0,0.5)`
        }}
      >
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-purple-500/5 via-transparent to-purple-500/5 rounded-full pointer-events-none" />
        
        {/* Logo */}
        <div className="relative flex items-center gap-2">
          <Link href="/" className="transition-all duration-300 hover:scale-105">
            <div 
              className="text-2xl font-bold transition-colors duration-700 cursor-pointer" 
              style={{ color: currentColor }}
            >
              TradeClub
            </div>
          </Link>
        </div>
        
        {/* Navigation Links */}
        <div className="hidden md:flex items-center gap-8">
          <Link 
            href="/trade" 
            className="text-white/70 hover:text-white transition-colors text-sm font-medium"
          >
            FUNDex
          </Link>
          <Link 
            href="/matches" 
            className="text-white/70 hover:text-white transition-colors text-sm font-medium"
          >
            Arena
          </Link>
          <a 
            href="#docs" 
            className="text-white/70 hover:text-white transition-colors text-sm font-medium"
          >
            Docs
          </a>
          <ConnectButton.Custom>
            {({
              account,
              chain,
              openAccountModal,
              openChainModal,
              openConnectModal,
              authenticationStatus,
              mounted,
            }) => {
              // Note: If your app doesn't use authentication, you
              // can remove all 'authenticationStatus' checks
              const ready = mounted && authenticationStatus !== 'loading';
              const connected =
                ready &&
                account &&
                chain &&
                (!authenticationStatus ||
                  authenticationStatus === 'authenticated');

              return (
                <div
                  {...(!ready && {
                    'aria-hidden': true,
                    'style': {
                      opacity: 0,
                      pointerEvents: 'none',
                      userSelect: 'none',
                    },
                  })}
                >
                  {(() => {
                    if (!connected) {
                      return (
                        <Button
                          onClick={openConnectModal}
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
                      );
                    }

                    if (chain.unsupported) {
                      return (
                        <Button
                          onClick={openChainModal}
                          className="rounded-full px-6 py-2 text-sm font-medium transition-all duration-700"
                          style={{
                            border: `1px solid #ef4444`,
                            color: "#ef4444",
                            backgroundColor: "transparent",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = "#ef4444"
                            e.currentTarget.style.color = "white"
                            e.currentTarget.style.boxShadow = `0 0 20px #ef4444`
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = "transparent"
                            e.currentTarget.style.color = "#ef4444"
                            e.currentTarget.style.boxShadow = "none"
                          }}
                        >
                          Wrong network
                        </Button>
                      );
                    }

                    return (
                      <div className="flex gap-3">
                        <Button
                          onClick={openChainModal}
                          className="rounded-full px-4 py-2 text-sm font-medium transition-all duration-700"
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
                          {chain.hasIcon && (
                            <div
                              style={{
                                background: chain.iconBackground,
                                width: 12,
                                height: 12,
                                borderRadius: 999,
                                overflow: 'hidden',
                                marginRight: 4,
                              }}
                            >
                              {chain.iconUrl && (
                                <img
                                  alt={chain.name ?? 'Chain icon'}
                                  src={chain.iconUrl}
                                  style={{ width: 12, height: 12 }}
                                />
                              )}
                            </div>
                          )}
                          {chain.name}
                        </Button>

                        <Button
                          onClick={openAccountModal}
                          className="rounded-full px-4 py-2 text-sm font-medium transition-all duration-700"
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
                          {account.displayName}
                          {account.displayBalance
                            ? ` (${account.displayBalance})`
                            : ''}
                        </Button>
                      </div>
                    );
                  })()}
                </div>
              );
            }}
          </ConnectButton.Custom>
        </div>
      </div>
    </nav>
  )
}
