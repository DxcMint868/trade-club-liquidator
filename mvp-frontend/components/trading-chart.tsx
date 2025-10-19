"use client";

import { useEffect, useRef, memo } from 'react';
import { createChart, ColorType, CandlestickSeries } from 'lightweight-charts';

const TradingChart = ({ data, onSeriesCreated }) => {
  const chartContainerRef = useRef();
  const chartRef = useRef();
  const seriesRef = useRef();

  useEffect(() => {
    const handleResize = () => {
      chartRef.current.applyOptions({ width: chartContainerRef.current.clientWidth });
    };

    chartRef.current = createChart(chartContainerRef.current, {
      layout: {
        background: {
          type: ColorType.Solid,
          color: '#080413',
        },
        textColor: 'rgba(255, 255, 255, 0.9)',
      },
      grid: {
        vertLines: {
          color: 'rgba(197, 203, 206, 0.1)',
        },
        horzLines: {
          color: 'rgba(197, 203, 206, 0.1)',
        },
      },
      crosshair: {
        mode: 'normal',
      },
      rightPriceScale: {
        borderColor: 'rgba(197, 203, 206, 0.3)',
      },
      timeScale: {
        borderColor: 'rgba(197, 203, 206, 0.3)',
      },
      width: chartContainerRef.current.clientWidth,
      height: 500,
    });

    seriesRef.current = chartRef.current.addSeries(CandlestickSeries, {
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderDownColor: '#ef5350',
      borderUpColor: '#26a69a',
      wickDownColor: '#ef5350',
      wickUpColor: '#26a69a',
    });

    if (onSeriesCreated) {
      onSeriesCreated(seriesRef.current);
    }

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chartRef.current.remove();
    };
  }, [onSeriesCreated]);

  useEffect(() => {
    if (seriesRef.current) {
      seriesRef.current.setData(data);
    }
  }, [data]);

  return <div ref={chartContainerRef} className="w-full h-full" />;
};

export default memo(TradingChart);