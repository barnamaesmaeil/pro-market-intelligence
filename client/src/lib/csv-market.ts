import type { Candle, Timeframe } from "./market-engine";
export type ColumnMap = {
  time: string;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
};
export type CsvResult = {
  headers: string[];
  rows: Candle[];
  errors: string[];
  warnings: string[];
  timeframe: Timeframe | null;
  mapping: ColumnMap;
};
export function isCsvAnalysisReady(
  result: CsvResult | null
): result is CsvResult {
  return (
    result !== null && result.errors.length === 0 && result.rows.length >= 3
  );
}
const aliases: Record<keyof ColumnMap, string[]> = {
  time: ["time", "timestamp", "date", "datetime", "gmt time", "open time"],
  open: ["open", "o"],
  high: ["high", "h"],
  low: ["low", "l"],
  close: ["close", "c", "last"],
  volume: ["volume", "vol", "tickvol", "tick volume"],
};
export function parseCsvText(text: string): CsvResult {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter(x => x.trim().length > 0);
  const empty: ColumnMap = {
    time: "",
    open: "",
    high: "",
    low: "",
    close: "",
    volume: "",
  };
  if (lines.length < 2)
    return {
      headers: [],
      rows: [],
      errors: ["فایل باید یک سطر header و دست‌کم یک ردیف داده داشته باشد."],
      warnings: [],
      timeframe: null,
      mapping: empty,
    };
  const headers = splitLine(lines[0]).map(x => x.trim());
  const normalized = headers.map(x => x.toLowerCase().replace(/[ _-]+/g, " "));
  const mapping = {} as ColumnMap;
  for (const key of Object.keys(aliases) as (keyof ColumnMap)[]) {
    const i = normalized.findIndex(h => aliases[key].includes(h));
    mapping[key] = i >= 0 ? headers[i] : "";
  }
  return parseWithMapping(lines, headers, mapping);
}
export function parseWithMapping(
  lines: string[],
  headers: string[],
  mapping: ColumnMap
): CsvResult {
  const errors: string[] = [],
    warnings: string[] = [],
    rows: Candle[] = [];
  const normalizedHeaders = headers.map(x => x.trim());
  const col = (key: keyof ColumnMap) => normalizedHeaders.indexOf(mapping[key]);
  for (const required of ["time", "open", "high", "low", "close"] as const)
    if (!mapping[required] || col(required) < 0)
      errors.push(`ستون اجباری «${required}» نگاشت نشده است.`);
  const claimed = new Map<string, keyof ColumnMap>();
  for (const key of Object.keys(mapping) as (keyof ColumnMap)[]) {
    const header = mapping[key];
    if (!header || col(key) < 0) continue;
    const previous = claimed.get(header);
    if (previous)
      errors.push(
        `ستون «${header}» هم‌زمان برای ${previous} و ${key} نگاشت شده است.`
      );
    else claimed.set(header, key);
  }
  if (errors.length)
    return { headers, rows, errors, warnings, timeframe: null, mapping };
  const seen = new Set<number>();
  let previous = -Infinity;
  for (let li = 1; li < lines.length; li++) {
    const raw = splitLine(lines[li]);
    if (raw.every(x => !x.trim())) continue;
    const rowNo = li + 1;
    const stamp = Date.parse(raw[col("time")] ?? "");
    if (!Number.isFinite(stamp)) {
      errors.push(`ردیف ${rowNo}: زمان نامعتبر است.`);
      continue;
    }
    const nums = {} as Record<"open" | "high" | "low" | "close", number>;
    let bad = false;
    for (const key of ["open", "high", "low", "close"] as const) {
      const val = Number(String(raw[col(key)] ?? "").replace(/,/g, ""));
      if (!Number.isFinite(val)) {
        errors.push(`ردیف ${rowNo}: ${key} عددی نیست.`);
        bad = true;
      } else nums[key] = val;
    }
    const volumeIndex = col("volume");
    let volume: number | undefined;
    if (volumeIndex >= 0 && raw[volumeIndex]?.trim()) {
      volume = Number(String(raw[volumeIndex]).replace(/,/g, ""));
      if (!Number.isFinite(volume) || volume < 0) {
        errors.push(`ردیف ${rowNo}: Volume نامعتبر است.`);
        bad = true;
      }
    }
    if (bad) continue;
    if (
      nums.high < Math.max(nums.open, nums.close) ||
      nums.low > Math.min(nums.open, nums.close)
    ) {
      errors.push(
        `ردیف ${rowNo}: OHLC ناسازگار است (High/Low قیمت Open/Close را در بر نمی‌گیرد).`
      );
      continue;
    }
    if (seen.has(stamp)) {
      errors.push(`ردیف ${rowNo}: timestamp تکراری است.`);
      continue;
    }
    seen.add(stamp);
    if (stamp < previous)
      warnings.push(
        `ردیف ${rowNo}: زمان خارج از ترتیب است؛ داده‌ها در حافظه مرتب می‌شوند.`
      );
    previous = stamp;
    rows.push({
      time: new Date(stamp).toISOString(),
      ...nums,
      volume,
      complete: true,
    });
  }
  rows.sort((a, b) => Date.parse(a.time) - Date.parse(b.time));
  const deltas = rows
    .slice(1)
    .map((r, i) => Date.parse(r.time) - Date.parse(rows[i].time))
    .filter(x => x > 0);
  const tf = detectTimeframe(deltas);
  if (!rows.length && !errors.length)
    errors.push("هیچ کندل معتبر در فایل پیدا نشد.");
  return { headers, rows, errors, warnings, timeframe: tf, mapping };
}
function splitLine(line: string) {
  const cells: string[] = [];
  let cur = "",
    quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"' && line[i + 1] === '"' && quoted) {
      cur += '"';
      i++;
    } else if (c === '"') quoted = !quoted;
    else if (c === "," && !quoted) {
      cells.push(cur);
      cur = "";
    } else cur += c;
  }
  cells.push(cur);
  return cells;
}
function detectTimeframe(deltas: number[]): Timeframe | null {
  if (deltas.length < 2) return null;
  const sorted = [...deltas].sort((a, b) => a - b),
    mid = sorted[Math.floor(sorted.length / 2)];
  const candidates: [number, Timeframe][] = [
    [60_000, "1m"],
    [300_000, "5m"],
    [900_000, "15m"],
    [1_800_000, "30m"],
    [3_600_000, "1h"],
    [14_400_000, "4h"],
    [86_400_000, "1D"],
  ];
  const best = candidates.sort(
    (a, b) => Math.abs(a[0] - mid) - Math.abs(b[0] - mid)
  )[0];
  const near =
    deltas.filter(x => Math.abs(x - mid) <= mid * 0.02).length / deltas.length;
  return Math.abs(best[0] - mid) / best[0] < 0.08 && near > 0.7
    ? best[1]
    : null;
}
