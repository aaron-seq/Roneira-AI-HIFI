import {
  createSymbolConfig,
  getPeerConfigs,
  inferAssetType,
  inferCurrency,
} from "@/lib/market/constants";

describe("market symbol helpers", () => {
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
