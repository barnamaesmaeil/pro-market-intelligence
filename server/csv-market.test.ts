import { describe, expect, it } from "vitest";
import {
  isCsvAnalysisReady,
  parseCsvText,
  parseWithMapping,
} from "../client/src/lib/csv-market";
describe("CSV candle import", () => {
  it("maps standard OHLCV headers and estimates a regular timeframe", () => {
    const csv = [
      "Timestamp,Open,High,Low,Close,Volume",
      "2026-01-01T00:00:00Z,10,12,9,11,100",
      "2026-01-01T00:01:00Z,11,13,10,12,120",
      "2026-01-01T00:02:00Z,12,14,11,13,90",
    ].join("\n");
    const result = parseCsvText(csv);
    expect(result.errors).toHaveLength(0);
    expect(result.rows).toHaveLength(3);
    expect(result.timeframe).toBe("1m");
  });
  it("reports impossible high/low instead of silently treating the candle as valid", () => {
    const result = parseCsvText(
      [
        "Time,Open,High,Low,Close",
        "2026-01-01T00:00:00Z,10,9,8,11",
        "2026-01-01T00:01:00Z,11,12,10,11",
        "2026-01-01T00:02:00Z,11,12,10,12",
      ].join("\n")
    );
    expect(result.errors.some(x => x.includes("OHLC ناسازگار"))).toBe(true);
    expect(result.rows).toHaveLength(2);
  });
  it("allows manual mapping when CSV headers differ", () => {
    const headers = ["DateTime", "BidO", "BidH", "BidL", "BidC"];
    const lines = [
      "DateTime,BidO,BidH,BidL,BidC",
      "2026-01-01T00:00:00Z,10,12,9,11",
      "2026-01-01T00:01:00Z,11,13,10,12",
      "2026-01-01T00:02:00Z,12,14,11,13",
    ];
    const result = parseWithMapping(lines, headers, {
      time: "DateTime",
      open: "BidO",
      high: "BidH",
      low: "BidL",
      close: "BidC",
      volume: "",
    });
    expect(result.errors).toHaveLength(0);
    expect(result.rows[0].open).toBe(10);
  });
  it("blocks downstream analysis whenever preflight reports a data error", () => {
    const result = parseCsvText(
      [
        "Time,Open,High,Low,Close",
        "2026-01-01T00:00:00Z,10,9,8,11",
        "2026-01-01T00:01:00Z,11,12,10,11",
        "2026-01-01T00:02:00Z,11,12,10,12",
      ].join("\n")
    );
    expect(result.rows).toHaveLength(2);
    expect(isCsvAnalysisReady(result)).toBe(false);
    const valid = parseCsvText(
      [
        "Time,Open,High,Low,Close",
        "2026-01-01T00:00:00Z,10,12,9,11",
        "2026-01-01T00:01:00Z,11,13,10,12",
        "2026-01-01T00:02:00Z,12,14,11,13",
      ].join("\n")
    );
    expect(isCsvAnalysisReady(valid)).toBe(true);
  });
  it("rejects two OHLC roles mapped to the same source column", () => {
    const headers = ["Time", "Open", "High", "Low", "Close"];
    const result = parseWithMapping(
      [
        "Time,Open,High,Low,Close",
        "2026-01-01T00:00:00Z,10,12,9,11",
        "2026-01-01T00:01:00Z,11,13,10,12",
        "2026-01-01T00:02:00Z,12,14,11,13",
      ],
      headers,
      {
        time: "Time",
        open: "Open",
        high: "High",
        low: "Low",
        close: "High",
        volume: "",
      }
    );
    expect(result.errors.some(x => x.includes("هم‌زمان"))).toBe(true);
    expect(isCsvAnalysisReady(result)).toBe(false);
  });
});
