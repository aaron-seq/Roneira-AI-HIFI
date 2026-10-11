"use client";

import { useEffect, useRef } from "react";
import {
  ColorType,
  createChart,
  LineStyle,
  type IChartApi,
  type AutoscaleInfo,
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
  horizonSessions,
}: {
  symbol: string;
  predictedPrice: number;
  priceTargetLow: number;
  priceTargetHigh: number;
  horizonSessions: number;
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
      autoscaleInfoProvider: (baseImplementation: () => AutoscaleInfo | null) => {
        const info = baseImplementation();
        if (!info) return null;
        return {
          ...info,
          priceRange: {
            minValue: Math.min(info.priceRange.minValue, predictedPrice, priceTargetLow, priceTargetHigh),
            maxValue: Math.max(info.priceRange.maxValue, predictedPrice, priceTargetLow, priceTargetHigh),
          },
        };
      },
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

    // Reference levels have no invented future timestamp. The selected model
    // horizon counts source trading sessions, and we do not have a complete
    // exchange calendar with which to date a future candle.
    candleSeries.createPriceLine({
      price: predictedPrice,
      color: "#C8922F",
      lineWidth: 2,
      lineStyle: LineStyle.Dashed,
      title: "Model estimate",
    });
    candleSeries.createPriceLine({
      price: priceTargetLow,
      color: "#E67E22",
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      title: "Lower reference",
    });
    candleSeries.createPriceLine({
      price: priceTargetHigh,
      color: "#2ECC71",
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      title: "Upper reference",
    });

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
            Price History & Model Levels
          </h3>
          <p
            className="text-xs"
            style={{ color: "var(--color-text-muted)" }}
          >
            6-month candles with reference levels for {horizonSessions} trading sessions.
            Levels are not dated future candles or probability bounds.
          </p>
        </div>
      </div>
      <p className="sr-only">
        Historical candlestick chart for {symbol}. Model estimate {predictedPrice.toFixed(2)},
        lower reference {priceTargetLow.toFixed(2)}, upper reference {priceTargetHigh.toFixed(2)}.
        Price is on the vertical axis and historical date on the horizontal axis.
      </p>
      <div
        ref={containerRef}
        className="h-80 w-full"
        role="region"
        tabIndex={0}
        aria-label={`${symbol} historical price chart with a model estimate of ${predictedPrice}, lower reference ${priceTargetLow} and upper reference ${priceTargetHigh}. References are illustrative, not probability bounds.`}
      />
    </div>
  );
}
