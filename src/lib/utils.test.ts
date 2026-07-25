import {
  cn,
  formatCurrency,
  formatPercent,
  formatCompact,
  formatPrice,
  getPriceColor,
  getPriceBgColor,
  getSignalBadgeClass,
  isIndianTicker,
  getTickerCurrency,
  debounce,
  getConfidenceColor,
  getLetterAvatar,
} from "@/lib/utils";

describe("cn", () => {
  it("merges class names", () => {
    expect(cn("a", "b")).toBe("a b");
  });

  it("drops falsy values", () => {
    expect(cn("a", false && "b", undefined, null, "c")).toBe("a c");
  });

  it("resolves conflicting tailwind utilities in favour of the last one", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
  });
});

describe("formatCurrency", () => {
  it("defaults to USD formatting", () => {
    expect(formatCurrency(1234.5)).toBe("$1,234.50");
  });

  it("formats INR using the Indian digit grouping", () => {
    expect(formatCurrency(1234567, "INR")).toBe("₹12,34,567.00");
  });

  it("always shows exactly two decimal places", () => {
    expect(formatCurrency(5)).toBe("$5.00");
    expect(formatCurrency(5.129)).toBe("$5.13");
  });
});

describe("formatPercent", () => {
  it("prefixes non-negative values with an explicit plus sign", () => {
    expect(formatPercent(2.5)).toBe("+2.50%");
    expect(formatPercent(0)).toBe("+0.00%");
  });

  it("keeps the native minus sign for negatives", () => {
    expect(formatPercent(-1.234)).toBe("-1.23%");
  });

  it("honours a custom decimal count", () => {
    expect(formatPercent(1.23456, 4)).toBe("+1.2346%");
  });
});

describe("formatCompact", () => {
  it.each([
    [999, "999.00"],
    [1_000, "1.00K"],
    [1_500_000, "1.50M"],
    [2_400_000_000, "2.40B"],
    [3_100_000_000_000, "3.10T"],
  ])("formats %s as %s", (input, expected) => {
    expect(formatCompact(input)).toBe(expected);
  });

  it("applies suffixes to negative magnitudes too", () => {
    expect(formatCompact(-1_500_000)).toBe("-1.50M");
  });
});

describe("formatPrice", () => {
  it("groups thousands and rounds to two decimals", () => {
    expect(formatPrice(1234.567)).toBe("1,234.57");
  });
});

describe("getPriceColor / getPriceBgColor", () => {
  it("distinguishes gains, losses and flat values", () => {
    expect(getPriceColor(1)).toBe("text-profit");
    expect(getPriceColor(-1)).toBe("text-loss");
    expect(getPriceColor(0)).toBe("text-[var(--color-text-muted)]");
  });

  it("returns no background tint for a flat value", () => {
    expect(getPriceBgColor(1)).toBe("bg-profit-subtle");
    expect(getPriceBgColor(-1)).toBe("bg-loss-subtle");
    expect(getPriceBgColor(0)).toBe("");
  });
});

describe("getSignalBadgeClass", () => {
  it("maps every known signal to its badge", () => {
    expect(getSignalBadgeClass("STRONG_BUY")).toBe("badge-strong-buy");
    expect(getSignalBadgeClass("BUY")).toBe("badge-buy");
    expect(getSignalBadgeClass("HOLD")).toBe("badge-hold");
    expect(getSignalBadgeClass("SELL")).toBe("badge-sell");
    expect(getSignalBadgeClass("STRONG_SELL")).toBe("badge-strong-sell");
  });

  it("falls back to HOLD for an unrecognised signal", () => {
    expect(
      getSignalBadgeClass("UNKNOWN" as Parameters<typeof getSignalBadgeClass>[0])
    ).toBe("badge-hold");
  });
});

describe("isIndianTicker / getTickerCurrency", () => {
  it("recognises NSE and BSE suffixes", () => {
    expect(isIndianTicker("RELIANCE.NS")).toBe(true);
    expect(isIndianTicker("TCS.BO")).toBe(true);
  });

  it("treats plain US tickers as non-Indian", () => {
    expect(isIndianTicker("AAPL")).toBe(false);
  });

  it("derives the currency from the ticker suffix", () => {
    expect(getTickerCurrency("RELIANCE.NS")).toBe("INR");
    expect(getTickerCurrency("AAPL")).toBe("USD");
  });
});

describe("debounce", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("invokes the function only once for a rapid burst, with the latest args", () => {
    vi.useFakeTimers();
    const spy = vi.fn();
    const debounced = debounce(spy as (...args: unknown[]) => void, 100);

    debounced("first");
    debounced("second");
    debounced("third");

    expect(spy).not.toHaveBeenCalled();

    vi.advanceTimersByTime(100);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith("third");
  });

  it("fires again once the quiet period has elapsed", () => {
    vi.useFakeTimers();
    const spy = vi.fn();
    const debounced = debounce(spy as (...args: unknown[]) => void, 50);

    debounced("a");
    vi.advanceTimersByTime(50);
    debounced("b");
    vi.advanceTimersByTime(50);

    expect(spy).toHaveBeenCalledTimes(2);
  });
});

describe("getConfidenceColor", () => {
  it("returns a distinct colour per confidence band, inclusive at boundaries", () => {
    expect(getConfidenceColor(80)).toBe("#2ECC71");
    expect(getConfidenceColor(60)).toBe("#F39C12");
    expect(getConfidenceColor(40)).toBe("#E67E22");
    expect(getConfidenceColor(39.9)).toBe("#E74C3C");
  });
});

describe("getLetterAvatar", () => {
  it("uses the initials of the first two words", () => {
    expect(getLetterAvatar("Reliance Industries")).toBe("RI");
  });

  it("caps the result at two characters", () => {
    expect(getLetterAvatar("Tata Consultancy Services")).toBe("TC");
  });

  it("upper-cases a single lowercase word", () => {
    expect(getLetterAvatar("apple")).toBe("A");
  });
});
