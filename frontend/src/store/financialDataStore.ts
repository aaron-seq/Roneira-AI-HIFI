import create from "zustand";

interface FinancialDataState {
  selectedStockTicker: string | null;
  isApplicationLoading: boolean;
  applicationErrorMessage: string | null;
  marketHealthStatus: any;
  setSelectedStockTicker: (ticker: string | null) => void;
  setIsApplicationLoading: (isLoading: boolean) => void;
  setApplicationErrorMessage: (message: string | null) => void;
  setMarketHealthStatus: (status: any) => void;
}

export const useFinancialDataStore = create<FinancialDataState>((set) => ({
  selectedStockTicker: null,
  isApplicationLoading: false,
  applicationErrorMessage: null,
  marketHealthStatus: null,
  setSelectedStockTicker: (ticker) => set({ selectedStockTicker: ticker }),
  setIsApplicationLoading: (isLoading) =>
    set({ isApplicationLoading: isLoading }),
  setApplicationErrorMessage: (message) =>
    set({ applicationErrorMessage: message }),
  setMarketHealthStatus: (status) => set({ marketHealthStatus: status }),
}));
