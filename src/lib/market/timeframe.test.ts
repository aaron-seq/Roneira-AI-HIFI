import {
  getTargetDate,
  getTimeframeDays,
  TIMEFRAME_DAYS,
} from "@/lib/market/timeframe";

const BASE = new Date("2026-01-01T00:00:00.000Z");

describe("getTimeframeDays", () => {
  it("maps each known timeframe to its day count", () => {
    expect(getTimeframeDays("tomorrow")).toBe(1);
    expect(getTimeframeDays("1week")).toBe(7);
    expect(getTimeframeDays("1month")).toBe(30);
    expect(getTimeframeDays("3month")).toBe(90);
    expect(getTimeframeDays("6month")).toBe(180);
    expect(getTimeframeDays("1year")).toBe(365);
    expect(getTimeframeDays("1year_plus")).toBe(400);
  });

  it("defaults an unknown timeframe to 30 days", () => {
    expect(getTimeframeDays("not-a-timeframe")).toBe(30);
    expect(getTimeframeDays("")).toBe(30);
  });

  it("covers every key declared in TIMEFRAME_DAYS", () => {
    for (const [key, days] of Object.entries(TIMEFRAME_DAYS)) {
      expect(getTimeframeDays(key)).toBe(days);
    }
  });
});

describe("getTargetDate", () => {
  it("advances the base date by the timeframe's day count", () => {
    expect(getTargetDate("tomorrow", BASE)).toBe("2026-01-02T00:00:00.000Z");
    expect(getTargetDate("1week", BASE)).toBe("2026-01-08T00:00:00.000Z");
  });

  it("rolls over month and year boundaries correctly", () => {
    expect(getTargetDate("1month", BASE)).toBe("2026-01-31T00:00:00.000Z");
    expect(getTargetDate("1year", BASE)).toBe("2027-01-01T00:00:00.000Z");
  });

  it("falls back to 30 days for an unknown timeframe", () => {
    expect(getTargetDate("bogus", BASE)).toBe(getTargetDate("1month", BASE));
  });

  it("does not mutate the date it was given", () => {
    const from = new Date(BASE.getTime());
    getTargetDate("1year", from);
    expect(from.toISOString()).toBe(BASE.toISOString());
  });

  it("returns a parseable ISO string when defaulting to the current time", () => {
    const result = getTargetDate("1week");
    expect(Number.isNaN(Date.parse(result))).toBe(false);
  });
});
