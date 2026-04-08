import { create } from "zustand";

// ---- Types ----
export interface NotificationPreferences {
  priceAlerts: boolean;
  predictionComplete: boolean;
  newsSentiment: boolean;
  weeklyReport: boolean;
}

export interface UserPreferences {
  theme: "dark" | "light";
  defaultMarket: "NSE" | "BSE" | "NASDAQ" | "NYSE";
  newsFeed: string[];
  defaultModel: string;
  notifications: NotificationPreferences;
}

export interface UserProfile {
  id: string;
  username: string;
  full_name: string;
  email: string;
  role: "admin" | "user";
  avatar_url: string | null;
  preferences: UserPreferences;
}

export interface WatchlistItem {
  id: string;
  ticker: string;
  exchange: string;
  notes: string | null;
  alert_price: number | null;
  sort_order: number;
  added_at: string;
}

export interface PortfolioHolding {
  id: string;
  ticker: string;
  company_name: string;
  exchange: string;
  quantity: number;
  avg_buy_price: number;
  buy_date: string | null;
  sector: string | null;
  tags: string[];
}

// ---- App Store ----
interface AppState {
  // User
  user: UserProfile | null;
  setUser: (user: UserProfile | null) => void;

  // Sidebar
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;

  // Theme
  theme: "dark" | "light";
  toggleTheme: () => void;
  setTheme: (theme: "dark" | "light") => void;

  // Command palette
  commandPaletteOpen: boolean;
  setCommandPaletteOpen: (open: boolean) => void;

  // Active prediction
  activePredictionTicker: string | null;
  setActivePredictionTicker: (ticker: string | null) => void;

  // Notifications
  unreadNotifications: number;
  setUnreadNotifications: (count: number) => void;
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  priceAlerts: true,
  predictionComplete: true,
  newsSentiment: false,
  weeklyReport: true,
};

export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  theme: "dark",
  defaultMarket: "NSE",
  newsFeed: ["global", "india"],
  defaultModel: "ENSEMBLE",
  notifications: DEFAULT_NOTIFICATION_PREFERENCES,
};

function applyTheme(theme: "dark" | "light") {
  if (typeof document !== "undefined") {
    document.documentElement.setAttribute("data-theme", theme);
  }
}

export const useAppStore = create<AppState>((set) => ({
  // User
  user: null,
  setUser: (user) => set({ user }),

  // Sidebar
  sidebarCollapsed: false,
  toggleSidebar: () =>
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),

  // Theme
  theme: "dark",
  toggleTheme: () =>
    set((state) => {
      const newTheme = state.theme === "dark" ? "light" : "dark";
      applyTheme(newTheme);
      return { theme: newTheme };
    }),
  setTheme: (theme) => {
    applyTheme(theme);
    set({ theme });
  },

  // Command palette
  commandPaletteOpen: false,
  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),

  // Active prediction
  activePredictionTicker: null,
  setActivePredictionTicker: (ticker) =>
    set({ activePredictionTicker: ticker }),

  // Notifications
  unreadNotifications: 0,
  setUnreadNotifications: (count) => set({ unreadNotifications: count }),
}));
