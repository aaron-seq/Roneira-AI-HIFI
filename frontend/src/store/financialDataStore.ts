import { create } from "zustand";
import { persist } from "zustand/middleware";
import { MarketHealthStatus, PDMOpportunity } from "../types";

interface WatchlistItem {
  symbol: string;
  name: string;
  addedAt: string;
}

interface FinancialDataState {
  selectedStockTicker: string | null;
  isApplicationLoading: boolean;
  applicationErrorMessage: string | null;
  marketHealthStatus: MarketHealthStatus | null;
  pdmOpportunities: PDMOpportunity[];
  pdmScanInProgress: boolean;
  watchlist: WatchlistItem[];
  selectedIndexSymbol: string;
  setSelectedStockTicker: (ticker: string | null) => void;
  setIsApplicationLoading: (isLoading: boolean) => void;
  setApplicationErrorMessage: (message: string | null) => void;
  setMarketHealthStatus: (status: MarketHealthStatus | null) => void;
  setPDMOpportunities: (opportunities: PDMOpportunity[]) => void;
  setPDMScanInProgress: (inProgress: boolean) => void;
  addToWatchlist: (symbol: string, name: string) => void;
  removeFromWatchlist: (symbol: string) => void;
  isInWatchlist: (symbol: string) => boolean;
  setSelectedIndexSymbol: (symbol: string) => void;
}

export const useFinancialDataStore = create<FinancialDataState>()(
  persist(
    (set, get) => ({
      selectedStockTicker: null,
      isApplicationLoading: false,
      applicationErrorMessage: null,
      marketHealthStatus: null,
      pdmOpportunities: [],
      pdmScanInProgress: false,
      watchlist: [],
      selectedIndexSymbol: "^NSEI",
      setSelectedStockTicker: (ticker) => set({ selectedStockTicker: ticker }),
      setIsApplicationLoading: (isLoading) =>
        set({ isApplicationLoading: isLoading }),
      setApplicationErrorMessage: (message) =>
        set({ applicationErrorMessage: message }),
      setMarketHealthStatus: (status) => set({ marketHealthStatus: status }),
      setPDMOpportunities: (opportunities) => set({ pdmOpportunities: opportunities }),
      setPDMScanInProgress: (inProgress) => set({ pdmScanInProgress: inProgress }),
      addToWatchlist: (symbol, name) =>
        set((state) => ({
          watchlist: state.watchlist.some((item) => item.symbol === symbol)
            ? state.watchlist
            : [...state.watchlist, { symbol, name, addedAt: new Date().toISOString() }],
        })),
      removeFromWatchlist: (symbol) =>
        set((state) => ({
          watchlist: state.watchlist.filter((item) => item.symbol !== symbol),
        })),
      isInWatchlist: (symbol) => get().watchlist.some((item) => item.symbol === symbol),
      setSelectedIndexSymbol: (symbol) => set({ selectedIndexSymbol: symbol }),
    }),
    {
      name: "roneira-financial-data",
      partialize: (state) => ({ watchlist: state.watchlist, selectedIndexSymbol: state.selectedIndexSymbol }),
    }
  )
);
