import {
  auditEventSchema,
  predictRequestSchema,
  historyQuerySchema,
  formatIssues,
} from "@/lib/server/validation";

describe("predictRequestSchema", () => {
  it("accepts a valid request and defaults model_type to undefined", () => {
    const parsed = predictRequestSchema.parse({
      ticker: "AAPL",
      timeframe: "1month",
    });
    expect(parsed.ticker).toBe("AAPL");
    expect(parsed.model_type).toBeUndefined();
  });

  it("accepts real-world symbol punctuation", () => {
    for (const ticker of ["RELIANCE.NS", "^NSEI", "GC=F", "BTC-USD", "DX-Y.NYB"]) {
      expect(
        predictRequestSchema.safeParse({ ticker, timeframe: "1week" }).success
      ).toBe(true);
    }
  });

  it("rejects unknown timeframes rather than silently defaulting", () => {
    const result = predictRequestSchema.safeParse({
      ticker: "AAPL",
      timeframe: "next-tuesday",
    });
    expect(result.success).toBe(false);
  });

  it("rejects models outside the predictions_cache CHECK constraint", () => {
    const result = predictRequestSchema.safeParse({
      ticker: "AAPL",
      timeframe: "1month",
      model_type: "NOT_A_MODEL",
    });
    expect(result.success).toBe(false);
  });

  it("rejects path traversal and overlong tickers", () => {
    expect(
      predictRequestSchema.safeParse({
        ticker: "AAPL/../../etc/passwd",
        timeframe: "1month",
      }).success
    ).toBe(false);
    expect(
      predictRequestSchema.safeParse({ ticker: "A".repeat(21), timeframe: "1month" })
        .success
    ).toBe(false);
  });
});

describe("auditEventSchema", () => {
  it("accepts a valid event", () => {
    const parsed = auditEventSchema.parse({
      action_type: "LOGIN",
      entity_type: "auth",
    });
    expect(parsed.action_type).toBe("LOGIN");
  });

  it("rejects action/entity values the DB CHECK would refuse", () => {
    expect(
      auditEventSchema.safeParse({ action_type: "DROP_TABLES", entity_type: "auth" })
        .success
    ).toBe(false);
    expect(
      auditEventSchema.safeParse({ action_type: "LOGIN", entity_type: "nonsense" })
        .success
    ).toBe(false);
  });

  it("rejects a non-UUID entity_id instead of letting Postgres 500", () => {
    const result = auditEventSchema.safeParse({
      action_type: "LOGIN",
      entity_type: "auth",
      entity_id: "not-a-uuid",
    });
    expect(result.success).toBe(false);
  });

  it("caps payload size so audit_log cannot be flooded", () => {
    const result = auditEventSchema.safeParse({
      action_type: "LOGIN",
      entity_type: "auth",
      new_values: { blob: "A".repeat(20_000) },
    });
    expect(result.success).toBe(false);
  });

  it("allows a normal-sized payload through", () => {
    const result = auditEventSchema.safeParse({
      action_type: "RUN_PREDICTION",
      entity_type: "prediction",
      new_values: { ticker: "AAPL", confidence: 49.4 },
    });
    expect(result.success).toBe(true);
  });
});

describe("historyQuerySchema", () => {
  it("applies defaults for interval and range", () => {
    const parsed = historyQuerySchema.parse({ symbol: "AAPL" });
    expect(parsed.interval).toBe("1day");
    expect(parsed.range).toBe("6month");
  });

  it("rejects unsupported intervals", () => {
    expect(
      historyQuerySchema.safeParse({ symbol: "AAPL", interval: "1year" }).success
    ).toBe(false);
  });
});

describe("formatIssues", () => {
  it("prefixes the failing field so the 400 body is actionable", () => {
    const result = predictRequestSchema.safeParse({
      ticker: "AAPL",
      timeframe: "bogus",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(formatIssues(result.error)).toContain("timeframe");
    }
  });
});
