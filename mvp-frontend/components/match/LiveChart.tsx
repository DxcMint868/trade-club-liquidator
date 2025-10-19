"use client";

import { useEffect, useRef, useState } from "react";
import { createChart, IChartApi, ISeriesApi, CandlestickData } from "lightweight-charts";

interface LiveChartProps {
  symbol: string;
  data?: CandlestickData[];
}

export default function LiveChart({ symbol, data = [] }: LiveChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candlestickSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

  // useEffect(() => {
  //   if (!chartContainerRef.current) return;

  //   // Create chart with dark theme
  //   const chart = createChart(chartContainerRef.current, {
  //     layout: {
  //       background: { color: "#0a0a0f" },
  //       textColor: "#d1d4dc",
  //     },
  //     grid: {
  //       vertLines: { color: "#1a1a2e" },
  //       horzLines: { color: "#1a1a2e" },
  //     },
  //     width: chartContainerRef.current.clientWidth,
  //     height: 500,
  //     timeScale: {
  //       borderColor: "#2B2B43",
  //       timeVisible: true,
  //       secondsVisible: false,
  //     },
  //     rightPriceScale: {
  //       borderColor: "#2B2B43",
  //     },
  //   });

  //   const candlestickSeries = chart.addCandlestickSeries({
  //     upColor: "#26a69a",
  //     downColor: "#ef5350",
  //     borderVisible: false,
  //     wickUpColor: "#26a69a",
  //     wickDownColor: "#ef5350",
  //   });

  //   chartRef.current = chart;
  //   candlestickSeriesRef.current = candlestickSeries;

  //   // Handle resize
  //   const handleResize = () => {
  //     if (chartContainerRef.current && chartRef.current) {
  //       chartRef.current.applyOptions({
  //         width: chartContainerRef.current.clientWidth,
  //       });
  //     }
  //   };

  //   window.addEventListener("resize", handleResize);

  //   return () => {
  //     window.removeEventListener("resize", handleResize);
  //     chart.remove();
  //   };
  // }, []);

  // Update chart data when it changes
  useEffect(() => {
    if (candlestickSeriesRef.current && data.length > 0) {
      candlestickSeriesRef.current.setData(data);
    }
  }, [data]);

  return (
    <div className="relative w-full h-full bg-gradient-to-br from-slate-950 via-purple-950/20 to-slate-950 rounded-lg border border-purple-500/30 overflow-hidden">
      {/* Chart Header */}
      <div className="absolute top-0 left-0 right-0 z-10 p-4 bg-gradient-to-b from-black/60 to-transparent">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h3 className="text-xl font-bold text-white">{symbol}</h3>
            <div className="flex items-center gap-2">
              <span className="px-2 py-1 text-xs font-semibold bg-green-500/20 text-green-400 rounded border border-green-500/30">
                LIVE
              </span>
              <span className="text-sm text-purple-400">• Real-time</span>
            </div>
          </div>
          <div className="flex gap-2">
            <button className="px-3 py-1 text-xs font-semibold bg-purple-600/20 text-purple-300 rounded border border-purple-500/30 hover:bg-purple-600/30 transition">
              1m
            </button>
            <button className="px-3 py-1 text-xs font-semibold bg-slate-800/50 text-slate-400 rounded border border-slate-700/50 hover:bg-slate-700/50 transition">
              5m
            </button>
            <button className="px-3 py-1 text-xs font-semibold bg-slate-800/50 text-slate-400 rounded border border-slate-700/50 hover:bg-slate-700/50 transition">
              15m
            </button>
            <button className="px-3 py-1 text-xs font-semibold bg-slate-800/50 text-slate-400 rounded border border-slate-700/50 hover:bg-slate-700/50 transition">
              1h
            </button>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div ref={chartContainerRef} className="w-full h-full" />

      {/* Decorative Elements */}
      <div className="absolute top-0 left-0 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl" />
      <div className="absolute bottom-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl" />
    </div>
  );
}
