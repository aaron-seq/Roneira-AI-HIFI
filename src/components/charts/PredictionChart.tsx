"use client";

import { useEffect, useRef } from "react";
import {
  ColorType,
  createChart,
  LineStyle,
  type IChartApi,
  type Time,
} from "lightweight-charts";
import { ChartSkeleton } from "@/components/ui/Skeletons";
import { useQuoteHistory } from "@/lib/hooks/use-live-market";

export function toChartTime(value: string): Time {
  return Math.floor(new Date(value).getTime() / 1000) as Time;
}

export function PredictionChart({
  symbol,
  predictedPrice,
  priceTargetLow,
  priceTargetHigh,
}: {
  symbol: string;
  predictedPrice: number;
  priceTargetLow: number;
  priceTargetHigh: number;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const historyQuery = useQuoteHistory(symbol, "1day", "6month");

  useEffect(() => {
    if (!containerRef.current || !historyQuery.data?.candles?.length) {
      return;
    }

    const styles = getComputedStyle(document.documentElement);
    const chart = createChart(containerRef.current, {
      autoSize: true,
      height: 320,
      layout: {
        background: {
          type: ColorType.Solid,
          color: styles.getPropertyValue("--color-bg").trim() || "#0A0B0D",
        },
        textColor:
          styles.getPropertyValue("--color-text-muted").trim() || "#7D8590",
      },
      grid: {
        vertLines: {
          color: "rgba(255,255,255,0.05)",
        },
        horzLines: {
          color: "rgba(255,255,255,0.05)",
        },
      },
      rightPriceScale: {
        borderColor: "rgba(255,255,255,0.08)",
      },
      timeScale: {
        borderColor: "rgba(255,255,255,0.08)",
      },
    });

    const candleSeries = chart.addCandlestickSeries({
      upColor: "#2ECC71",
      downColor: "#E74C3C",
      borderUpColor: "#2ECC71",
      borderDownColor: "#E74C3C",
      wickUpColor: "#2ECC71",
      wickDownColor: "#E74C3C",
    });

    candleSeries.setData(
      historyQuery.data.candles.map((candle) => ({
        time: toChartTime(candle.time),
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
      }))
    );

    const latest = historyQuery.data.candles[historyQuery.data.candles.length - 1];
    const futureDate = new Date(latest.time);
    futureDate.setUTCDate(futureDate.getUTCDate() + 30);
    const futureTime = Math.floor(futureDate.getTime() / 1000) as Time;
    const currentTime = toChartTime(latest.time);

    const projectionSeries = chart.addLineSeries({
      color: "#3498DB",
      lineWidth: 3,
    });
    projectionSeries.setData([
      { time: currentTime, value: latest.close },
      { time: futureTime, value: predictedPrice },
    ]);

    const lowSeries = chart.addLineSeries({
      color: "#E67E22",
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
    });
    lowSeries.setData([
      { time: currentTime, value: latest.close },
      { time: futureTime, value: priceTargetLow },
    ]);

    const highSeries = chart.addLineSeries({
      color: "#2ECC71",
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
    });
    highSeries.setData([
      { time: currentTime, value: latest.close },
      { time: futureTime, value: priceTargetHigh },
    ]);

    chart.timeScale().fitContent();
    chartRef.current = chart;

    return () => {
      chartRef.current?.remove();
      chartRef.current = null;
    };
  }, [
    historyQuery.data?.candles,
    predictedPrice,
    priceTargetHigh,
    priceTargetLow,
  ]);

  if (historyQuery.isLoading) {
    return <ChartSkeleton />;
  }

  if (historyQuery.isError || !historyQuery.data?.candles?.length) {
    return (
      <div className="card flex h-80 items-center justify-center p-6">
        <p style={{ color: "var(--color-text-muted)" }}>
          Chart history is unavailable for {symbol} right now.
        </p>
      </div>
    );
  }

  return (
    <div className="card p-5">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3
            className="text-sm font-semibold"
            style={{ color: "var(--color-text-primary)" }}
          >
            Price History & Projection
          </h3>
          <p
            className="text-xs"
            style={{ color: "var(--color-text-muted)" }}
          >
            6-month candles with a 30-day forward projection band
          </p>
        </div>
      </div>
      <div ref={containerRef} className="h-80 w-full" />
    </div>
  );
}
