import {
  createSymbolConfig,
  getPeerConfigs,
  inferAssetType,
  inferCurrency,
  inferExchange,
} from "@/lib/market/constants";

describe("market symbol helpers", () => {
  it.each([
    ["RELIANCE.NS", "NSE"],
    ["TCS.BO", "BSE"],
    ["^NSEI", "INDEX"],
    ["BTC-USD", "CRYPTO"],
    ["EURUSD=X", "FX"],
    ["GC=F", "FUTURES"],
    ["AAPL", "NASDAQ"],
  ])("classifies %s as %s for provider configuration", (symbol, exchange) => {
    expect(inferExchange(symbol)).toBe(exchange);
  });
  it("normalizes common US equity symbols for provider usage", () => {
    const config = createSymbolConfig("AAPL");
    expect(config.assetType).toBe("equity");
    expect(config.exchange).toBe("NASDAQ");
    expect(config.providerSymbol).toBe("AAPL");
    expect(config.currency).toBe("USD");
  });

  it("infers currencies for indian symbols", () => {
    expect(inferCurrency("RELIANCE.NS")).toBe("INR");
    expect(inferAssetType("RELIANCE.NS")).toBe("equity");
  });

  it("returns launch peer sets for live comparison tables", () => {
    const usPeers = getPeerConfigs("AAPL");
    const indiaPeers = getPeerConfigs("RELIANCE.NS");

    expect(usPeers.map((peer) => peer.symbol)).toContain("MSFT");
    expect(indiaPeers.map((peer) => peer.symbol)).toContain("INFY.NS");
  });
});

describe("direct-symbol quote currency contracts", () => {
  it.each([
    ["USDINR=X", "INR", "USD/INR"],
    ["EURUSD=X", "USD", "EUR/USD"],
    ["GBPUSD=X", "USD", "GBP/USD"],
    ["USDJPY=X", "JPY", "USD/JPY"],
    ["EURINR=X", "INR", "EUR/INR"],
    ["GBPINR=X", "INR", "GBP/INR"],
    ["USDCHF=X", "CHF", "USD/CHF"],
  ])("preserves canonical metadata for %s instead of guessing from its base currency", (symbol, currency, providerSymbol) => {
    expect(createSymbolConfig(symbol)).toMatchObject({ currency, providerSymbol, assetType: "forex", exchange: "FX" });
    expect(inferCurrency(symbol)).toBe(currency);
  });

  it("uses quote denominations for generic pairs and Yahoo USD-base shorthand", () => {
    expect(createSymbolConfig("NZDCAD=X").currency).toBe("CAD");
    expect(createSymbolConfig("JPY=X").currency).toBe("JPY");
  });

  it("retains configured index metadata, explicit overrides and ordinary equity behavior", () => {
    expect(createSymbolConfig("^FTSE")).toMatchObject({ currency: "GBP", assetType: "index" });
    expect(createSymbolConfig("USDINR=X", { name: "Conversion rate" })).toMatchObject({ currency: "INR", name: "Conversion rate" });
    expect(createSymbolConfig("TCS.NS")).toMatchObject({ currency: "INR", exchange: "NSE" });
    expect(createSymbolConfig("UNCONFIGURED")).toMatchObject({ currency: "USD", exchange: "NASDAQ", providerSymbol: "UNCONFIGURED" });
  });
});
