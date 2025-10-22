"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { io, Socket } from "socket.io-client";

export interface CopyTradeEvent {
  matchId: string;
  monachadAddress: string;
  supporterAddress: string;
  tradeType: "OPEN" | "CLOSE";
  dex: string;
  amount: string;
  positionType?: "LONG" | "SHORT";
  leverage?: string;
  assetId?: string;
  transactionHash: string;
  timestamp: number;
}

export interface OriginalTradeEvent {
  matchId: string;
  monachadAddress: string;
  tradeType: "OPEN" | "CLOSE";
  dex: string;
  amount: string;
  positionType?: "LONG" | "SHORT";
  leverage?: string;
  assetId?: string;
  transactionHash: string;
  timestamp: number;
}

interface UseMatchEventsOptions {
  matchId: string;
  userAddress?: string;
  followedMonachadAddress?: string;
  enabled?: boolean;
}

const MAX_WINDOW_SIZE = 30; // Maximum trades to keep in "All" views

export function useMatchEvents({
  matchId,
  userAddress,
  followedMonachadAddress,
  enabled = true,
}: UseMatchEventsOptions) {
  // Shadow trades (copy trades)
  const [allShadowTrades, setAllShadowTrades] = useState<CopyTradeEvent[]>([]);
  const [myShadowTrades, setMyShadowTrades] = useState<CopyTradeEvent[]>([]);
  // Original trades (Monachad trades)
  const [allOriginalTrades, setAllOriginalTrades] = useState<
    OriginalTradeEvent[]
  >([]);
  const [myChadOriginalTrades, setMyChadOriginalTrades] = useState<
    OriginalTradeEvent[]
  >([]);

  // Restore feeds from localStorage on mount
  useEffect(() => {
    if (!matchId) return;
    try {
      const allShadow = localStorage.getItem(
        `matchFeed_allShadowTrades_${matchId}`
      );
      const myShadow = userAddress
        ? localStorage.getItem(
            `matchFeed_myShadowTrades_${matchId}_${userAddress}`
          )
        : null;
      const allOriginal = localStorage.getItem(
        `matchFeed_allOriginalTrades_${matchId}`
      );
      const myChadOriginal = followedMonachadAddress
        ? localStorage.getItem(
            `matchFeed_myChadOriginalTrades_${matchId}_${followedMonachadAddress}`
          )
        : null;

      if (allShadow) setAllShadowTrades(JSON.parse(allShadow));
      if (myShadow) setMyShadowTrades(JSON.parse(myShadow));
      if (allOriginal) setAllOriginalTrades(JSON.parse(allOriginal));
      if (myChadOriginal) setMyChadOriginalTrades(JSON.parse(myChadOriginal));
    } catch (e) {
      // Ignore parse errors
    }
  }, [matchId, userAddress, followedMonachadAddress]);

  // Persist feeds to localStorage on update
  useEffect(() => {
    if (!matchId) return;
    try {
      localStorage.setItem(
        `matchFeed_allShadowTrades_${matchId}`,
        JSON.stringify(allShadowTrades)
      );
    } catch {}
  }, [allShadowTrades, matchId]);

  useEffect(() => {
    if (!matchId || !userAddress) return;
    try {
      localStorage.setItem(
        `matchFeed_myShadowTrades_${matchId}_${userAddress}`,
        JSON.stringify(myShadowTrades)
      );
    } catch {}
  }, [myShadowTrades, matchId, userAddress]);

  useEffect(() => {
    if (!matchId) return;
    try {
      localStorage.setItem(
        `matchFeed_allOriginalTrades_${matchId}`,
        JSON.stringify(allOriginalTrades)
      );
    } catch {}
  }, [allOriginalTrades, matchId]);

  useEffect(() => {
    if (!matchId || !followedMonachadAddress) return;
    try {
      localStorage.setItem(
        `matchFeed_myChadOriginalTrades_${matchId}_${followedMonachadAddress}`,
        JSON.stringify(myChadOriginalTrades)
      );
    } catch {}
  }, [myChadOriginalTrades, matchId, followedMonachadAddress]);

  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!enabled || !matchId) return;

    const backendUrl =
      process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

    // Connect to WebSocket
    const socket = io(backendUrl, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("💓 WebSocket connected");
      setIsConnected(true);

      // Subscribe to match events
      socket.emit("subscribeToMatch", matchId);
    });

    socket.on("disconnect", () => {
      console.log("💔 WebSocket disconnected");
      setIsConnected(false);
    });

    // Listen for single copy trade (shadow trade)
    socket.on("copyTradeExecuted", (event: CopyTradeEvent) => {
      console.log("Copy trade executed:", event);

      // Add to all shadow trades (with window limit)
      setAllShadowTrades((prev) => {
        const updated = [event, ...prev];
        return updated.slice(0, MAX_WINDOW_SIZE);
      });

      // Add to my shadow trades if it's for this user
      if (
        userAddress &&
        event.supporterAddress.toLowerCase() === userAddress.toLowerCase()
      ) {
        setMyShadowTrades((prev) => [event, ...prev]);
      }
    });

    socket.onAny((event, ...args) => console.log("socket event", event, args));

    // Listen for batch copy trades
    socket.on(
      "batchCopyTradesExecuted",
      (data: { matchId: string; trades: CopyTradeEvent[]; count: number }) => {
        console.log(`📊 Batch of ${data.count} copy trades executed`);

        // Add all to shadow trades (with window limit)
        setAllShadowTrades((prev) => {
          const updated = [...data.trades, ...prev];
          return updated.slice(0, MAX_WINDOW_SIZE);
        });

        // Filter and add user's trades
        const myTrades = userAddress
          ? data.trades.filter(
              (trade) =>
                trade.supporterAddress.toLowerCase() ===
                userAddress.toLowerCase()
            )
          : [];

        if (myTrades.length > 0) {
          setMyShadowTrades((prev) => [...myTrades, ...prev]);
        }
      }
    );

    // Listen for original Monachad trades
    socket.on("monachadTradeExecuted", (event: OriginalTradeEvent) => {
      console.log("⚡ Monachad trade executed:", event);

      // Add to all original trades (with window limit)
      setAllOriginalTrades((prev) => {
        const updated = [event, ...prev];
        return updated.slice(0, MAX_WINDOW_SIZE);
      });

      // Add to my chad's trades if it's the followed Monachad
      if (
        followedMonachadAddress &&
        event.monachadAddress.toLowerCase() ===
          followedMonachadAddress.toLowerCase()
      ) {
        setMyChadOriginalTrades((prev) => [event, ...prev]);
      }
    });

    // Listen for batch Monachad trades
    socket.on(
      "batchMonachadTradesExecuted",
      (data: {
        matchId: string;
        trades: OriginalTradeEvent[];
        count: number;
      }) => {
        console.log(`⚡ Batch of ${data.count} Monachad trades executed`);

        // Add all to original trades (with window limit)
        setAllOriginalTrades((prev) => {
          const updated = [...data.trades, ...prev];
          return updated.slice(0, MAX_WINDOW_SIZE);
        });

        // Filter and add followed Monachad's trades
        const myChadTrades = followedMonachadAddress
          ? data.trades.filter(
              (trade) =>
                trade.monachadAddress.toLowerCase() ===
                followedMonachadAddress.toLowerCase()
            )
          : [];

        if (myChadTrades.length > 0) {
          setMyChadOriginalTrades((prev) => [...myChadTrades, ...prev]);
        }
      }
    );

    // Listen for match updates
    socket.on("matchUpdated", (data: any) => {
      console.log("🔄 Match updated:", data);
      // Can be used to trigger refetch or update match state
    });

    return () => {
      socket.emit("unsubscribeFromMatch", matchId);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [matchId, userAddress, followedMonachadAddress, enabled]);

  const clearAllTrades = useCallback(() => {
    setAllShadowTrades([]);
    setMyShadowTrades([]);
    setAllOriginalTrades([]);
    setMyChadOriginalTrades([]);
  }, []);

  return {
    // Shadow trades (copy trades)
    allShadowTrades,
    myShadowTrades,

    // Original trades (Monachad trades)
    allOriginalTrades,
    myChadOriginalTrades,

    // Connection status
    isConnected,

    // Utilities
    clearAllTrades,
  };
}
