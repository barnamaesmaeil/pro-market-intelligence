import { describe, expect, it } from "vitest";
import { analyzeMarket, type Candle } from "../client/src/lib/market-engine";
const make = (values: number[]): Candle[] =>
  values.map((v, i) => ({
    time: new Date(Date.UTC(2026, 0, 1, 0, i)).toISOString(),
    open: v - 0.2,
    high: v + 1,
    low: v - 1,
    close: v,
    volume: 10,
  }));
const candle = (
  i: number,
  open: number,
  high: number,
  low: number,
  close: number
): Candle => ({
  time: new Date(Date.UTC(2026, 0, 1, 0, i)).toISOString(),
  open,
  high,
  low,
  close,
});
describe("causal market analysis", () => {
  it("does not publish a swing until its right-side confirmation candles exist", () => {
    const bars = make([10, 12, 15, 12, 10, 11, 12]);
    const atFour = analyzeMarket(bars.slice(0, 3), { pivotRadius: 1 });
    const atFive = analyzeMarket(bars.slice(0, 4), { pivotRadius: 1 });
    expect(atFour?.events.some(e => e.kind === "SWING_HIGH")).toBeFalsy();
    const event = atFive?.events.find(e => e.kind === "SWING_HIGH");
    expect(event?.index).toBe(2);
    expect(event?.confirmedAt).toBe(bars[3].time);
  });
  it("uses the identical engine output for equivalent normalized inputs", () => {
    const bars = make([10, 11, 10, 12, 11, 13, 12, 14, 13]);
    expect(analyzeMarket(bars)).toEqual(analyzeMarket([...bars]));
  });
  it("does not analyze invalid OHLC candles", () => {
    const bars = make([10, 11, 10, 12, 11, 13]);
    bars[3] = { ...bars[3], high: 1 };
    expect(analyzeMarket(bars)).not.toBeNull();
    expect(analyzeMarket(bars)?.latestClose).toBe(bars[5].close);
  });
  it("confirms a three-candle fair-value gap when the third candle closes", () => {
    const analysis = analyzeMarket(
      [
        candle(0, 9, 11, 8, 10),
        candle(1, 11.5, 12, 11, 11.8),
        candle(2, 12.5, 13, 12, 12.8),
      ],
      { pivotRadius: 1 }
    );
    const gap = analysis?.events.find(e => e.kind === "FVG_BULL");
    expect(gap?.index).toBe(2);
    expect(gap?.confirmedAt).toBe(analysis?.confirmedThrough);
  });
  it("detects BOS/Order Block and later CHoCH/Liquidity Sweep events causally", () => {
    const up = make([8, 9, 12, 9, 8, 14]);
    up[4] = { ...up[4], open: 8.5 };
    const upAnalysis = analyzeMarket(up);
    expect(upAnalysis?.events.some(e => e.kind === "BOS_UP")).toBe(true);
    expect(upAnalysis?.events.some(e => e.kind === "ORDER_BLOCK_BULL")).toBe(
      true
    );

    const reversal = [
      candle(0, 9.2, 10, 8, 9),
      candle(1, 8, 8.5, 6, 7),
      candle(2, 6, 6.5, 4, 5),
      candle(3, 6.8, 8, 6, 7),
      candle(4, 11.5, 13, 11, 12),
      candle(5, 8.2, 9, 7, 8),
      candle(6, 4, 5, 2, 3),
      candle(7, 12.5, 15, 12, 14),
    ];
    const reversalAnalysis = analyzeMarket(reversal);
    expect(reversalAnalysis?.events.some(e => e.kind === "BOS_DOWN")).toBe(
      true
    );
    const choch = reversalAnalysis?.events.find(e => e.kind === "CHOCH_UP");
    expect(choch?.confirmedAt).toBe(reversal[7].time);

    const sweepBars = [
      candle(0, 9, 10, 8, 9),
      candle(1, 10, 11, 9, 10.5),
      candle(2, 12, 13, 11, 12),
      candle(3, 10, 10.5, 9, 10),
      candle(4, 11, 12, 10, 11),
      candle(5, 12.5, 14, 11, 12),
    ];
    expect(
      analyzeMarket(sweepBars)?.events.some(
        e => e.kind === "LIQUIDITY_SWEEP_HIGH"
      )
    ).toBe(true);
  });
});
