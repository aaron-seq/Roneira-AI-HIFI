import { create } from "zustand";
import { MarketHealthStatus, PDMOpportunity } from "../types";

interface FinancialDataState {
  selectedStockTicker: string | null;
  isApplicationLoading: boolean;
  applicationErrorMessage: string | null;
  marketHealthStatus: MarketHealthStatus | null;
  pdmOpportunities: PDMOpportunity[];
  pdmScanInProgress: boolean;
  setSelectedStockTicker: (ticker: string | null) => void;
  setIsApplicationLoading: (isLoading: boolean) => void;
  setApplicationErrorMessage: (message: string | null) => void;
  setMarketHealthStatus: (status: MarketHealthStatus | null) => void;
  setPDMOpportunities: (opportunities: PDMOpportunity[]) => void;
  setPDMScanInProgress: (inProgress: boolean) => void;
}

export const useFinancialDataStore = create<FinancialDataState>((set) => ({
  selectedStockTicker: null,
  isApplicationLoading: false,
  applicationErrorMessage: null,
  marketHealthStatus: null,
  pdmOpportunities: [],
  pdmScanInProgress: false,
  setSelectedStockTicker: (ticker) => set({ selectedStockTicker: ticker }),
  setIsApplicationLoading: (isLoading) =>
    set({ isApplicationLoading: isLoading }),
  setApplicationErrorMessage: (message) =>
    set({ applicationErrorMessage: message }),
  setMarketHealthStatus: (status) => set({ marketHealthStatus: status }),
  setPDMOpportunities: (opportunities) => set({ pdmOpportunities: opportunities }),
  setPDMScanInProgress: (inProgress) => set({ pdmScanInProgress: inProgress }),
}));
