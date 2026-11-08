export type Timeframe = "1m" | "5m" | "15m" | "30m" | "1h" | "4h" | "1D";
export type Candle = {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
  complete?: boolean;
};
export type StructureEvent = {
  kind:
    | "SWING_HIGH"
    | "SWING_LOW"
    | "BOS_UP"
    | "BOS_DOWN"
    | "CHOCH_UP"
    | "CHOCH_DOWN"
    | "FVG_BULL"
    | "FVG_BEAR"
    | "ORDER_BLOCK_BULL"
    | "ORDER_BLOCK_BEAR"
    | "LIQUIDITY_SWEEP_HIGH"
    | "LIQUIDITY_SWEEP_LOW";
  index: number;
  confirmedAt: string;
  price?: number;
  low?: number;
  high?: number;
  detail: string;
};
export type Level = {
  price: number;
  kind: "support" | "resistance";
  touches: number;
};
export type Scenario = {
  direction: "BUY" | "SELL" | "NO TRADE";
  entryLow?: number;
  entryHigh?: number;
  stop?: number;
  targets: number[];
  invalidation?: string;
  reasons: string[];
  confidence: "low" | "moderate";
};
export type Analysis = {
  events: StructureEvent[];
  levels: Level[];
  trend: "BULLISH" | "BEARISH" | "RANGE";
  scenario: Scenario;
  latestClose: number;
  confirmedThrough: string;
  timeframe?: Timeframe;
};

const round = (n: number) => Number(n.toPrecision(8));
const median = (xs: number[]) => {
  const a = [...xs].sort((x, y) => x - y);
  return a.length ? a[Math.floor(a.length / 2)] : 0;
};

/** Deterministic, causal structure analysis. All event confirmation stamps are at or after the information needed to confirm the pattern. */
export function analyzeMarket(
  bars: Candle[],
  options: { pivotRadius?: number; timeframe?: Timeframe } = {}
): Analysis | null {
  const valid = bars.filter(
    b =>
      Number.isFinite(Date.parse(b.time)) &&
      [b.open, b.high, b.low, b.close].every(Number.isFinite) &&
      b.high >= Math.max(b.open, b.close) &&
      b.low <= Math.min(b.open, b.close)
  );
  if (valid.length < 3) return null;
  const radius = Math.max(1, options.pivotRadius ?? 2);
  const events: StructureEvent[] = [];
  let lastHigh: { price: number; at: number } | null = null;
  let lastLow: { price: number; at: number } | null = null;
  let structure: "BULLISH" | "BEARISH" | "RANGE" = "RANGE";
  let lastBullPivot: number | null = null,
    priorBullPivot: number | null = null;
  let lastBearPivot: number | null = null,
    priorBearPivot: number | null = null;
  const confirmedHighs: { price: number; at: number }[] = [];
  const confirmedLows: { price: number; at: number }[] = [];
  const seenBreaks = new Set<string>();
  for (let i = 0; i < valid.length; i++) {
    // Pivots are exposed only at the confirmation bar, never at the historical pivot bar.
    const p = i - radius;
    if (p >= radius) {
      const left = valid.slice(p - radius, p),
        right = valid.slice(p + 1, p + radius + 1);
      const high = valid[p].high,
        low = valid[p].low;
      if (left.every(x => high > x.high) && right.every(x => high > x.high)) {
        lastHigh = { price: high, at: p };
        confirmedHighs.push(lastHigh);
        priorBearPivot = lastBearPivot;
        lastBearPivot = high;
        events.push({
          kind: "SWING_HIGH",
          index: p,
          confirmedAt: valid[i].time,
          price: high,
          detail: `Swing high confirmed after ${radius} right-side candle(s)`,
        });
      }
      if (left.every(x => low < x.low) && right.every(x => low < x.low)) {
        lastLow = { price: low, at: p };
        confirmedLows.push(lastLow);
        priorBullPivot = lastBullPivot;
        lastBullPivot = low;
        events.push({
          kind: "SWING_LOW",
          index: p,
          confirmedAt: valid[i].time,
          price: low,
          detail: `Swing low confirmed after ${radius} right-side candle(s)`,
        });
      }
    }
    if (i === 0) continue;
    const c = valid[i],
      prev = valid[i - 1];
    if (lastHigh && prev.close <= lastHigh.price && c.close > lastHigh.price) {
      const kind = structure === "BEARISH" ? "CHOCH_UP" : "BOS_UP";
      const key = `${kind}:${i}:${lastHigh.at}`;
      if (!seenBreaks.has(key)) {
        events.push({
          kind,
          index: i,
          confirmedAt: c.time,
          price: lastHigh.price,
          detail: `Close broke confirmed swing high ${round(lastHigh.price)}`,
        });
        seenBreaks.add(key);
        const ob = findOpposite(valid, i, "bull");
        if (ob)
          events.push({
            kind: "ORDER_BLOCK_BULL",
            index: ob.index,
            confirmedAt: c.time,
            low: ob.low,
            high: ob.high,
            detail:
              "Last bearish candle before confirmed bullish structure break",
          });
        structure = "BULLISH";
      }
    } else if (
      lastLow &&
      prev.close >= lastLow.price &&
      c.close < lastLow.price
    ) {
      const kind = structure === "BULLISH" ? "CHOCH_DOWN" : "BOS_DOWN";
      const key = `${kind}:${i}:${lastLow.at}`;
      if (!seenBreaks.has(key)) {
        events.push({
          kind,
          index: i,
          confirmedAt: c.time,
          price: lastLow.price,
          detail: `Close broke confirmed swing low ${round(lastLow.price)}`,
        });
        seenBreaks.add(key);
        const ob = findOpposite(valid, i, "bear");
        if (ob)
          events.push({
            kind: "ORDER_BLOCK_BEAR",
            index: ob.index,
            confirmedAt: c.time,
            low: ob.low,
            high: ob.high,
            detail:
              "Last bullish candle before confirmed bearish structure break",
          });
        structure = "BEARISH";
      }
    }
    // Three-candle FVG is knowable only once its third candle has printed.
    if (i >= 2) {
      const a = valid[i - 2],
        b = valid[i - 1];
      if (a.high < c.low)
        events.push({
          kind: "FVG_BULL",
          index: i,
          confirmedAt: c.time,
          low: a.high,
          high: c.low,
          detail: `Bullish three-candle gap ${round(a.high)}–${round(c.low)}`,
        });
      if (a.low > c.high)
        events.push({
          kind: "FVG_BEAR",
          index: i,
          confirmedAt: c.time,
          low: c.high,
          high: a.low,
          detail: `Bearish three-candle gap ${round(c.high)}–${round(a.low)}`,
        });
      void b;
    }
    // Sweep references only a swing that was already confirmed before this candle.
    const highForSweep = confirmedHighs.filter(x => x.at < i).at(-1);
    const lowForSweep = confirmedLows.filter(x => x.at < i).at(-1);
    if (
      highForSweep &&
      c.high > highForSweep.price &&
      c.close < highForSweep.price
    )
      events.push({
        kind: "LIQUIDITY_SWEEP_HIGH",
        index: i,
        confirmedAt: c.time,
        price: highForSweep.price,
        detail: `Wick swept confirmed high then closed below ${round(highForSweep.price)}`,
      });
    if (lowForSweep && c.low < lowForSweep.price && c.close > lowForSweep.price)
      events.push({
        kind: "LIQUIDITY_SWEEP_LOW",
        index: i,
        confirmedAt: c.time,
        price: lowForSweep.price,
        detail: `Wick swept confirmed low then closed above ${round(lowForSweep.price)}`,
      });
  }
  const last = valid.at(-1)!;
  const recentHighs = confirmedHighs.slice(-3),
    recentLows = confirmedLows.slice(-3);
  const higherHighs =
    recentHighs.length >= 2 &&
    recentHighs.at(-1)!.price > recentHighs.at(-2)!.price;
  const higherLows =
    recentLows.length >= 2 &&
    recentLows.at(-1)!.price > recentLows.at(-2)!.price;
  const lowerHighs =
    recentHighs.length >= 2 &&
    recentHighs.at(-1)!.price < recentHighs.at(-2)!.price;
  const lowerLows =
    recentLows.length >= 2 &&
    recentLows.at(-1)!.price < recentLows.at(-2)!.price;
  const trend =
    (higherHighs && higherLows) || structure === "BULLISH"
      ? "BULLISH"
      : (lowerHighs && lowerLows) || structure === "BEARISH"
        ? "BEARISH"
        : "RANGE";
  const ranges = valid
    .slice(-20)
    .map(x => x.high - x.low)
    .filter(x => x > 0);
  const tolerance = median(ranges) * 0.25 || last.close * 0.001;
  const levels = clusterLevels(
    [
      ...confirmedLows.map(x => ({ price: x.price, kind: "support" as const })),
      ...confirmedHighs.map(x => ({
        price: x.price,
        kind: "resistance" as const,
      })),
    ],
    tolerance,
    last.close
  );
  const scenario = makeScenario(last, trend, levels, events, valid.length - 1);
  return {
    events,
    levels,
    trend,
    scenario,
    latestClose: last.close,
    confirmedThrough: last.time,
    timeframe: options.timeframe,
  };
}
function findOpposite(
  bars: Candle[],
  index: number,
  direction: "bull" | "bear"
) {
  for (let j = index - 1; j >= Math.max(0, index - 8); j--) {
    const b = bars[j];
    if (direction === "bull" ? b.close < b.open : b.close > b.open)
      return { index: j, low: b.low, high: b.high };
  }
  return null;
}
function clusterLevels(
  input: { price: number; kind: "support" | "resistance" }[],
  tol: number,
  current: number
): Level[] {
  const out: Level[] = [];
  for (const item of input) {
    const existing = out.find(
      x => x.kind === item.kind && Math.abs(x.price - item.price) <= tol
    );
    if (existing) {
      existing.price = round(
        (existing.price * existing.touches + item.price) /
          (existing.touches + 1)
      );
      existing.touches++;
    } else out.push({ ...item, touches: 1 });
  }
  return out
    .filter(x =>
      x.kind === "support"
        ? x.price <= current * 1.01
        : x.price >= current * 0.99
    )
    .sort((a, b) => Math.abs(a.price - current) - Math.abs(b.price - current))
    .slice(0, 8);
}
function makeScenario(
  last: Candle,
  trend: "BULLISH" | "BEARISH" | "RANGE",
  levels: Level[],
  events: StructureEvent[],
  lastIndex: number
): Scenario {
  const recent = events.filter(
    e =>
      e.index >= Math.max(0, lastIndex - 12) &&
      Date.parse(e.confirmedAt) <= Date.parse(last.time)
  );
  const support = levels.find(
    x => x.kind === "support" && x.price < last.close
  );
  const resistance = levels.find(
    x => x.kind === "resistance" && x.price > last.close
  );
  const bullReason = recent
    .filter(e =>
      ["BOS_UP", "CHOCH_UP", "FVG_BULL", "LIQUIDITY_SWEEP_LOW"].includes(e.kind)
    )
    .map(e => e.kind.replaceAll("_", " "));
  const bearReason = recent
    .filter(e =>
      ["BOS_DOWN", "CHOCH_DOWN", "FVG_BEAR", "LIQUIDITY_SWEEP_HIGH"].includes(
        e.kind
      )
    )
    .map(e => e.kind.replaceAll("_", " "));
  if (trend === "BULLISH" && bullReason.length) {
    const entryLow = support?.price ?? last.close * 0.997,
      entryHigh = last.close;
    const stop = Math.min(entryLow, last.low) * 0.998;
    const t1 = last.close + (last.close - stop);
    const t2 = Math.max(resistance?.price ?? 0, t1 + (last.close - stop) * 0.6);
    return {
      direction: "BUY",
      entryLow: round(entryLow),
      entryHigh: round(entryHigh),
      stop: round(stop),
      targets: [round(t1), round(t2)],
      invalidation: `A completed close below ${round(stop)} invalidates the bullish scenario.`,
      reasons: [
        `Confirmed ${trend.toLowerCase()} structure`,
        ...bullReason.slice(-3),
      ],
      confidence: bullConf(bullReason.length),
    };
  }
  if (trend === "BEARISH" && bearReason.length) {
    const entryLow = last.close,
      entryHigh = resistance?.price ?? last.close * 1.003;
    const stop = Math.max(entryHigh, last.high) * 1.002;
    const t1 = last.close - (stop - last.close);
    const t2 = Math.min(
      support?.price ?? Number.POSITIVE_INFINITY,
      t1 - (stop - last.close) * 0.6
    );
    return {
      direction: "SELL",
      entryLow: round(entryLow),
      entryHigh: round(entryHigh),
      stop: round(stop),
      targets: [round(t1), round(t2)],
      invalidation: `A completed close above ${round(stop)} invalidates the bearish scenario.`,
      reasons: [
        `Confirmed ${trend.toLowerCase()} structure`,
        ...bearReason.slice(-3),
      ],
      confidence: bullConf(bearReason.length),
    };
  }
  return {
    direction: "NO TRADE",
    targets: [],
    reasons: [
      `Structure is ${trend.toLowerCase()} or lacks a confirmed directional trigger`,
      `Wait for a candle-close confirmation; no trade is executed by this tool.`,
    ],
    confidence: "low",
  };
}
function bullConf(count: number): "low" | "moderate" {
  return count >= 2 ? "moderate" : "low";
}
