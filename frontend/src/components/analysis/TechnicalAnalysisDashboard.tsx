import React, { useEffect, useRef } from 'react';
import { createChart, ColorType } from 'lightweight-charts';


// Mock data generator (since we don't have full historical data API yet)
const generateData = () => {
  const initialDate = new Date(2023, 0, 1);
  const data = [];
  let price = 150;
  for (let i = 0; i < 300; i++) {
    price = price + Math.random() * 10 - 5;
    const date = new Date(initialDate.valueOf() + i * 24 * 60 * 60 * 1000);
    data.push({
      time: date.toISOString().split('T')[0],
      open: price + Math.random() * 5 - 2.5,
      high: price + Math.random() * 5,
      low: price - Math.random() * 5,
      close: price,
    });
  }
  return data;
};

interface TechnicalAnalysisDashboardProps {
  selectedTicker: string;
}

export const TechnicalAnalysisDashboard: React.FC<TechnicalAnalysisDashboardProps> = ({ selectedTicker }) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#000000' },
        textColor: '#d1d5db',
      },
      grid: {
        vertLines: { color: '#374151' },
        horzLines: { color: '#374151' },
      },
      width: chartContainerRef.current.clientWidth,
      height: 500,
    });

    const candlestickSeries = chart.addCandlestickSeries({
      upColor: '#10b981',
      downColor: '#ef4444',
      borderVisible: false,
      wickUpColor: '#10b981',
      wickDownColor: '#ef4444',
    });

    const data = generateData();
    candlestickSeries.setData(data);

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [selectedTicker]);

  return (
    <div className="p-6 bg-gray-900 border border-gray-800 rounded-lg">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-white">
          Technical Analysis: <span className="text-gold-500">{selectedTicker || "MARKET"}</span>
        </h2>
        <div className="flex gap-2">
          {['1D', '1W', '1M', '3M', '1Y'].map((tf) => (
            <button key={tf} className="px-3 py-1 text-sm bg-gray-800 hover:bg-gray-700 rounded text-gray-300">
              {tf}
            </button>
          ))}
        </div>
      </div>

      <div ref={chartContainerRef} className="w-full h-[500px]" />

      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
        <div className="p-4 bg-gray-800 rounded">
          <div className="text-gray-400 text-sm">RSI (14)</div>
          <div className="text-xl font-bold text-white">58.42</div>
          <div className="text-xs text-gray-500">Neutral</div>
        </div>
        <div className="p-4 bg-gray-800 rounded">
          <div className="text-gray-400 text-sm">MACD</div>
          <div className="text-xl font-bold text-green-400">+1.25</div>
          <div className="text-xs text-gray-500">Bullish Crossover</div>
        </div>
        <div className="p-4 bg-gray-800 rounded">
          <div className="text-gray-400 text-sm">Bollinger Bands</div>
          <div className="text-xl font-bold text-white"> squeezing</div>
          <div className="text-xs text-gray-500">Low Volatility</div>
        </div>
      </div>
    </div>
  );
};
