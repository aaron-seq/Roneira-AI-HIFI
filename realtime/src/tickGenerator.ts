import { TickData } from './schemas';

// ============================================
// MOCK TICK GENERATOR
// Simulates real-time price updates for testing
// ============================================

interface SymbolState {
  symbol: string;
  price: number;
  open: number;
  high: number;
  low: number;
  volume: number;
  lastUpdate: number;
}

const symbolStates: Map<string, SymbolState> = new Map();

// Initialize with realistic stock data
const initialPrices: Record<string, number> = {
  AAPL: 195.50,
  GOOGL: 175.25,
  MSFT: 420.80,
  AMZN: 185.30,
  TSLA: 265.75,
  META: 505.20,
  NVDA: 875.50,
  JPM: 195.40,
  V: 275.60,
  WMT: 165.80,
  JNJ: 155.25,
  UNH: 525.75,
  MA: 450.30,
  HD: 355.45,
  PG: 155.90,
  DIS: 112.35,
  NFLX: 610.80,
  INTC: 45.25,
  AMD: 165.40,
  CRM: 265.75,
};

/**
 * Initialize state for a symbol
 */
const initSymbol = (symbol: string): SymbolState => {
  const basePrice = initialPrices[symbol.toUpperCase()] || 100 + Math.random() * 200;
  return {
    symbol: symbol.toUpperCase(),
    price: basePrice,
    open: basePrice,
    high: basePrice,
    low: basePrice,
    volume: Math.floor(Math.random() * 1000000) + 100000,
    lastUpdate: Date.now(),
  };
};

/**
 * Generate a new tick for a symbol with realistic price movement
 */
export const generateTick = (symbol: string): TickData => {
  let state = symbolStates.get(symbol.toUpperCase());
  
  if (!state) {
    state = initSymbol(symbol);
    symbolStates.set(symbol.toUpperCase(), state);
  }
  
  // Simulate realistic tick movement (±0.1% to ±0.5% per tick)
  const volatility = 0.001 + Math.random() * 0.004;
  const direction = Math.random() > 0.5 ? 1 : -1;
  const priceChange = state.price * volatility * direction;
  
  // Update state
  const newPrice = Math.max(0.01, state.price + priceChange);
  state.price = Math.round(newPrice * 100) / 100;
  state.high = Math.max(state.high, state.price);
  state.low = Math.min(state.low, state.price);
  state.volume += Math.floor(Math.random() * 10000);
  state.lastUpdate = Date.now();
  
  const change = state.price - state.open;
  const changePercent = (change / state.open) * 100;
  
  return {
    symbol: state.symbol,
    price: state.price,
    change: Math.round(change * 100) / 100,
    changePercent: Math.round(changePercent * 100) / 100,
    volume: state.volume,
    high: state.high,
    low: state.low,
    open: state.open,
    timestamp: state.lastUpdate,
  };
};

/**
 * Generate ticks for multiple symbols
 */
export const generateTicks = (symbols: string[]): TickData[] => {
  return symbols.map((symbol) => generateTick(symbol));
};

/**
 * Reset all symbol states (for testing)
 */
export const resetStates = (): void => {
  symbolStates.clear();
};

/**
 * Get current state for a symbol (for testing)
 */
export const getSymbolState = (symbol: string): SymbolState | undefined => {
  return symbolStates.get(symbol.toUpperCase());
};
