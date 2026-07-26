import {
  classifySentiment,
  extractTickers,
  matchKnownStock,
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

describe("matchKnownStock", () => {
  it("matches a company name to its symbol", () => {
    expect(matchKnownStock("Reliance shares rose 2% on strong earnings")).toBe(
      "RELIANCE.NS"
    );
    expect(matchKnownStock("Infosys wins a major cloud contract")).toBe(
      "INFY.NS"
    );
  });

  it("matches a bare ticker symbol used as the company name", () => {
    expect(matchKnownStock("TCS reports record Q2 profit")).toBe("TCS.NS");
  });

  it("matches multi-word phrases for names that would be dangerously generic split down to one word", () => {
    // "State Bank of India" -> naive first-word split gives "State", which
    // would match almost any economic-news headline. The full phrase is the
    // point of this test.
    expect(matchKnownStock("State Bank raises lending rates")).toBe(
      "SBIN.NS"
    );
    expect(matchKnownStock("Tech Mahindra announces layoffs")).toBe(
      "TECHM.NS"
    );
    expect(
      matchKnownStock("Bajaj Finance stock jumps on strong loan growth")
    ).toBe("BAJFINANCE.NS");
  });

  it("does not match on the generic first word alone", () => {
    // Regression guard for the exact bug the multi-word phrases fix: a
    // headline that only contains "State" or "Tech" must not be attributed
    // to SBIN or TECHM.
    expect(matchKnownStock("The state of the economy remains uncertain")).toBeNull();
    expect(matchKnownStock("Tech layoffs continue across the industry")).toBeNull();
  });

  it("matches Google as an alias for Alphabet (GOOGL)", () => {
    expect(matchKnownStock("Google unveils new AI search features")).toBe(
      "GOOGL"
    );
    expect(matchKnownStock("Alphabet posts strong ad revenue")).toBe("GOOGL");
  });

  it("returns null when no known equity is mentioned", () => {
    expect(matchKnownStock("Oil prices climb amid supply concerns")).toBeNull();
  });

  it("is case-insensitive", () => {
    expect(matchKnownStock("apple unveils new iphone")).toBe("AAPL");
  });
});
