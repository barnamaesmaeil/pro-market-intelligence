import type { Express, Request, Response } from "express";

type Bar = {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
  complete?: boolean;
};
const intervals: Record<string, { twelve: string; binance: string }> = {
  "1m": { twelve: "1min", binance: "1m" },
  "5m": { twelve: "5min", binance: "5m" },
  "15m": { twelve: "15min", binance: "15m" },
  "30m": { twelve: "30min", binance: "30m" },
  "1h": { twelve: "1h", binance: "1h" },
  "4h": { twelve: "4h", binance: "4h" },
  "1D": { twelve: "1day", binance: "1d" },
};
const approved = new Map<
  string,
  { provider: "twelvedata" | "binance"; symbol: string }
>([
  ["XAU/USD", { provider: "twelvedata", symbol: "XAU/USD" }],
  ["EUR/USD", { provider: "twelvedata", symbol: "EUR/USD" }],
  ["GBP/USD", { provider: "twelvedata", symbol: "GBP/USD" }],
  ["USD/JPY", { provider: "twelvedata", symbol: "USD/JPY" }],
  ["BTC/USDT", { provider: "binance", symbol: "BTCUSDT" }],
  ["ETH/USDT", { provider: "binance", symbol: "ETHUSDT" }],
  ["BNB/USDT", { provider: "binance", symbol: "BNBUSDT" }],
  ["SOL/USDT", { provider: "binance", symbol: "SOLUSDT" }],
]);
const cache = new Map<string, { at: number; data: unknown }>();
const validBar = (b: Bar) =>
  Number.isFinite(Date.parse(b.time)) &&
  [b.open, b.high, b.low, b.close].every(Number.isFinite) &&
  b.high >= Math.max(b.open, b.close) &&
  b.low <= Math.min(b.open, b.close);
function parseTime(value: string) {
  const normalized = value.includes("T")
    ? value
    : `${value.replace(" ", "T")}Z`;
  const d = new Date(normalized);
  return Number.isFinite(d.getTime()) ? d.toISOString() : "";
}
async function requestBars(
  symbol: string,
  timeframe: string
): Promise<{
  bars: Bar[];
  provider: string;
  symbol: string;
  fetchedAt: string;
  dataAsOf: string;
  stale: boolean;
}> {
  const instrument = approved.get(symbol)!;
  const interval = intervals[timeframe];
  const key = `${symbol}:${timeframe}`;
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < 20_000) return cached.data as never;
  let bars: Bar[] = [];
  if (instrument.provider === "binance") {
    const url = new URL("https://api.binance.com/api/v3/klines");
    url.searchParams.set("symbol", instrument.symbol);
    url.searchParams.set("interval", interval.binance);
    url.searchParams.set("limit", "240");
    const response = await fetch(url, {
      signal: AbortSignal.timeout(12_000),
      headers: { Accept: "application/json" },
    });
    if (!response.ok)
      throw new Error(`Binance returned HTTP ${response.status}`);
    const rows = (await response.json()) as unknown[];
    bars = rows
      .map((row: any) => ({
        time: new Date(Number(row[0])).toISOString(),
        open: Number(row[1]),
        high: Number(row[2]),
        low: Number(row[3]),
        close: Number(row[4]),
        volume: Number(row[5]),
        complete: Number(row[6]) < Date.now(),
      }))
      .filter(validBar);
  } else {
    const apiKey = process.env.TWELVE_DATA_API_KEY;
    if (!apiKey)
      throw new Error("Twelve Data API key is not configured on the server");
    const url = new URL("https://api.twelvedata.com/time_series");
    url.searchParams.set("symbol", instrument.symbol);
    url.searchParams.set("interval", interval.twelve);
    url.searchParams.set("outputsize", "240");
    url.searchParams.set("timezone", "UTC");
    url.searchParams.set("apikey", apiKey);
    const response = await fetch(url, {
      signal: AbortSignal.timeout(12_000),
      headers: { Accept: "application/json" },
    });
    let payload: any;
    try {
      payload = await response.json();
    } catch {
      throw new Error(`Twelve Data returned HTTP ${response.status}`);
    }
    if (
      !response.ok ||
      payload.status === "error" ||
      !Array.isArray(payload.values)
    ) {
      const message = String(
        payload.message ?? `Twelve Data returned HTTP ${response.status}`
      )
        .replaceAll(apiKey, "[redacted]")
        .slice(0, 220);
      throw new Error(message);
    }
    const durationMs: Record<string, number> = {
      "1m": 60_000,
      "5m": 300_000,
      "15m": 900_000,
      "30m": 1_800_000,
      "1h": 3_600_000,
      "4h": 14_400_000,
      "1D": 86_400_000,
    };
    bars = payload.values
      .map((r: any) => {
        const time = parseTime(String(r.datetime));
        return {
          time,
          open: Number(r.open),
          high: Number(r.high),
          low: Number(r.low),
          close: Number(r.close),
          volume: r.volume == null ? undefined : Number(r.volume),
          complete: Date.parse(time) + durationMs[timeframe] <= Date.now(),
        };
      })
      .filter(validBar)
      .reverse();
  }
  if (!bars.length)
    throw new Error("The provider returned no valid OHLC candles");
  const data = {
    bars,
    provider: instrument.provider,
    symbol,
    fetchedAt: new Date().toISOString(),
    dataAsOf: bars.at(-1)!.time,
    stale: false,
  };
  cache.set(key, { at: Date.now(), data });
  return data;
}
export function registerMarketDataRoutes(app: Express) {
  app.get("/api/market/bars", async (req: Request, res: Response) => {
    const symbol = String(req.query.symbol ?? ""),
      timeframe = String(req.query.timeframe ?? "");
    if (!approved.has(symbol))
      return res.status(400).json({
        error: "Unsupported symbol. Choose a symbol from the supported list.",
      });
    if (!intervals[timeframe])
      return res.status(400).json({ error: "Unsupported timeframe." });
    try {
      res.set("Cache-Control", "no-store");
      res.json(await requestBars(symbol, timeframe));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Market data request failed";
      res.status(502).json({
        error: message,
        provider: approved.get(symbol)!.provider,
        checkedAt: new Date().toISOString(),
      });
    }
  });
}
