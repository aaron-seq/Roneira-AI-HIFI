import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge Tailwind classes with conflict resolution */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** Format a number as currency (INR or USD) */
export function formatCurrency(
  value: number,
  currency: "INR" | "USD" = "USD"
): string {
  return new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/** Format a number as percentage */
export function formatPercent(value: number, decimals: number = 2): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(decimals)}%`;
}

/** Format large numbers with K/M/B suffixes */
export function formatCompact(value: number): string {
  if (Math.abs(value) >= 1e12) return `${(value / 1e12).toFixed(2)}T`;
  if (Math.abs(value) >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
  if (Math.abs(value) >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
  if (Math.abs(value) >= 1e3) return `${(value / 1e3).toFixed(2)}K`;
  return value.toFixed(2);
}

/** Format a number for display (tabular, 2 decimal places) */
export function formatPrice(value: number): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/** Get color class based on value (positive/negative) */
export function getPriceColor(value: number): string {
  if (value > 0) return "text-profit";
  if (value < 0) return "text-loss";
  return "text-[var(--color-text-muted)]";
}

/** Get background tint class based on value */
export function getPriceBgColor(value: number): string {
  if (value > 0) return "bg-profit-subtle";
  if (value < 0) return "bg-loss-subtle";
  return "";
}

/** Get signal badge class */
export function getSignalBadgeClass(
  signal: "STRONG_BUY" | "BUY" | "HOLD" | "SELL" | "STRONG_SELL"
): string {
  const map: Record<string, string> = {
    STRONG_BUY: "badge-strong-buy",
    BUY: "badge-buy",
    HOLD: "badge-hold",
    SELL: "badge-sell",
    STRONG_SELL: "badge-strong-sell",
  };
  return map[signal] || "badge-hold";
}

/** Determine if a ticker is Indian stock */
export function isIndianTicker(ticker: string): boolean {
  return ticker.endsWith(".NS") || ticker.endsWith(".BO");
}

/** Get currency for a ticker */
export function getTickerCurrency(ticker: string): "INR" | "USD" {
  return isIndianTicker(ticker) ? "INR" : "USD";
}

/** Debounce a function */
export function debounce<T extends (...args: unknown[]) => void>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/** Get confidence color based on score (0-100) */
export function getConfidenceColor(score: number): string {
  if (score >= 80) return "#2ECC71"; // Emerald green
  if (score >= 60) return "#F39C12"; // Amber
  if (score >= 40) return "#E67E22"; // Orange
  return "#E74C3C"; // Red
}

/** Generate letter avatar from company name */
export function getLetterAvatar(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();
}
