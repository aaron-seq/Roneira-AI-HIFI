import {
  classifySentiment,
  extractTickers,
  buildQuery,
} from "@/lib/news/classify";

describe("classifySentiment", () => {
  it("classifies text containing only positive signals as positive", () => {
    expect(classifySentiment("Shares surge on record profit")).toBe("positive");
  });

  it("classifies text containing only negative signals as negative", () => {
    expect(classifySentiment("Stock slumps after earnings miss")).toBe(
      "negative"
    );
  });

  it("is case insensitive", () => {
    expect(classifySentiment("SHARES RALLY")).toBe("positive");
    expect(classifySentiment("BEARISH OUTLOOK")).toBe("negative");
  });

  it("returns neutral when signals point both ways", () => {
    expect(classifySentiment("Profit up but downgrade follows")).toBe("neutral");
  });

  it("returns neutral when no keyword matches", () => {
    expect(classifySentiment("Company announces annual meeting date")).toBe(
      "neutral"
    );
  });

  it("handles empty text without throwing", () => {
    expect(classifySentiment("")).toBe("neutral");
  });
});

describe("extractTickers", () => {
  it("pulls uppercase ticker-shaped tokens out of text", () => {
    expect(extractTickers("AAPL and MSFT both rose")).toEqual(["AAPL", "MSFT"]);
  });

  it("recognises Indian exchange suffixes", () => {
    expect(extractTickers("RELIANCE.NS led the index")).toContain(
      "RELIANCE.NS"
    );
  });

  it("de-duplicates repeated mentions", () => {
    expect(extractTickers("AAPL AAPL AAPL")).toEqual(["AAPL"]);
  });

  it("caps the result at five tickers", () => {
    const result = extractTickers("AA BB CC DD EE FF GG");
    expect(result).toHaveLength(5);
  });

  it("ignores lowercase words and returns an empty list when nothing matches", () => {
    expect(extractTickers("the market rose today")).toEqual([]);
  });
});

describe("buildQuery", () => {
  it("uses the caller's query when one is supplied", () => {
    expect(buildQuery("us", "tesla earnings")).toBe("tesla earnings");
  });

  it("treats a whitespace-only query as absent", () => {
    expect(buildQuery("us", "   ")).toBe(
      "stock market OR equities OR investing"
    );
  });

  it("falls back to an India-specific query for the india market", () => {
    expect(buildQuery("india", "")).toBe(
      "India stock market OR NSE OR BSE OR Sensex OR Nifty"
    );
  });

  it("falls back to a generic query for any other market", () => {
    expect(buildQuery("us", "")).toBe(
      "stock market OR equities OR investing"
    );
  });
});
