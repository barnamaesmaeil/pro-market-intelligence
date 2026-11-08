import type { Analysis, Candle } from "@/lib/market-engine";

type Props = { bars: Candle[]; analysis: Analysis | null; title?: string };
const fmt = (v: number) =>
  v >= 1000
    ? v.toLocaleString(undefined, { maximumFractionDigits: 2 })
    : v.toPrecision(6).replace(/0+$/, "").replace(/\.$/, "");
export default function MarketChart({
  bars,
  analysis,
  title = "PRICE ACTION",
}: Props) {
  const data = bars.slice(-72);
  if (!data.length)
    return (
      <div className="chart-empty">داده‌ی کندل برای نمایش موجود نیست.</div>
    );
  const W = 960,
    H = 360,
    L = 64,
    R = 18,
    T = 22,
    B = 35,
    innerW = W - L - R,
    innerH = H - T - B;
  const lo = Math.min(...data.map(x => x.low)),
    hi = Math.max(...data.map(x => x.high)),
    pad = (hi - lo) * 0.08 || Math.abs(hi) * 0.002;
  const min = lo - pad,
    max = hi + pad,
    priceY = (p: number) => T + ((max - p) / (max - min)) * innerH,
    xAt = (i: number) => L + ((i + 0.5) * innerW) / data.length;
  const candleW = Math.max(3, Math.min(9, (innerW / data.length) * 0.58));
  const indexOffset = Math.max(0, bars.length - data.length);
  const timeLabel = (s: string) => {
    const d = new Date(s);
    return Number.isNaN(d.getTime())
      ? s
      : d.toLocaleString(undefined, {
          month: "short",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        });
  };
  const levels =
    analysis?.levels.filter(x => x.price >= min && x.price <= max) ?? [];
  const zones =
    analysis?.events.filter(
      e =>
        [
          "FVG_BULL",
          "FVG_BEAR",
          "ORDER_BLOCK_BULL",
          "ORDER_BLOCK_BEAR",
        ].includes(e.kind) &&
        e.low !== undefined &&
        e.high !== undefined &&
        e.high >= min &&
        e.low <= max &&
        e.index >= indexOffset
    ) ?? [];
  const markers =
    analysis?.events.filter(
      e =>
        [
          "SWING_HIGH",
          "SWING_LOW",
          "BOS_UP",
          "BOS_DOWN",
          "CHOCH_UP",
          "CHOCH_DOWN",
          "LIQUIDITY_SWEEP_HIGH",
          "LIQUIDITY_SWEEP_LOW",
        ].includes(e.kind) &&
        e.price !== undefined &&
        e.price >= min &&
        e.price <= max &&
        e.index >= indexOffset &&
        e.index < bars.length
    ) ?? [];
  const ticks = Array.from(
    { length: 5 },
    (_, i) => min + ((max - min) * i) / 4
  );
  return (
    <div className="chart-frame">
      <div className="chart-heading">
        <div>
          <span className="eyebrow">{title}</span>
          <h3>
            ساختار قیمت{" "}
            <span className="chart-value">{fmt(data.at(-1)!.close)}</span>
          </h3>
        </div>
        <div className="chart-key">
          <span>
            <i className="key-up" />
            صعودی
          </span>
          <span>
            <i className="key-down" />
            نزولی
          </span>
        </div>
      </div>
      <div className="chart-scroll">
        <svg
          className="market-chart"
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label="نمودار کندلی قیمت"
        >
          {ticks.map((p, i) => (
            <g key={i}>
              <line
                x1={L}
                x2={W - R}
                y1={priceY(p)}
                y2={priceY(p)}
                className="chart-grid"
              />
              <text
                x={L - 8}
                y={priceY(p) + 4}
                textAnchor="end"
                className="axis-label"
              >
                {fmt(p)}
              </text>
            </g>
          ))}
          {zones.map((e, i) => {
            const x = xAt(e.index - indexOffset) - candleW;
            const y = priceY(e.high!);
            const h = Math.max(2, priceY(e.low!) - y);
            return (
              <g key={`z${i}`}>
                <rect
                  x={Math.max(L, x)}
                  y={y}
                  width={Math.max(8, W - R - Math.max(L, x))}
                  height={h}
                  className={
                    e.kind.includes("BULL") ? "zone-bull" : "zone-bear"
                  }
                />
                <text x={Math.max(L, x) + 4} y={y + 11} className="zone-label">
                  {e.kind.startsWith("FVG") ? "FVG" : "OB"}
                </text>
              </g>
            );
          })}
          {levels.map((l, i) => (
            <g key={`l${i}`}>
              <line
                x1={L}
                x2={W - R}
                y1={priceY(l.price)}
                y2={priceY(l.price)}
                className={
                  l.kind === "support" ? "level-support" : "level-resistance"
                }
              />
              <text
                x={W - R - 5}
                y={priceY(l.price) - 3}
                textAnchor="end"
                className="level-label"
              >
                {l.kind === "support" ? "S" : "R"} {fmt(l.price)}
              </text>
            </g>
          ))}
          {markers.map((e, i) => {
            const x = xAt(e.index - indexOffset);
            const y = priceY(e.price!);
            const label = e.kind.startsWith("SWING")
              ? e.kind === "SWING_HIGH"
                ? "SH"
                : "SL"
              : e.kind.startsWith("LIQUIDITY")
                ? "SWEEP"
                : e.kind.startsWith("CHOCH")
                  ? "CHoCH"
                  : "BOS";
            const tone =
              e.kind === "SWING_HIGH" || e.kind === "SWING_LOW"
                ? "neutral"
                : e.kind.endsWith("UP") || e.kind === "LIQUIDITY_SWEEP_LOW"
                  ? "up"
                  : "down";
            return (
              <g key={`m${i}`} className={`structure-marker marker-${tone}`}>
                <title>{`${e.detail} · confirmed ${timeLabel(e.confirmedAt)}`}</title>
                <circle cx={x} cy={y} r="3.5" />
                <text x={x + 5} y={y - 5}>
                  {label}
                </text>
              </g>
            );
          })}
          {data.map((b, i) => {
            const up = b.close >= b.open;
            const x = xAt(i),
              yo = priceY(Math.max(b.open, b.close)),
              yc = priceY(Math.min(b.open, b.close));
            return (
              <g key={`${b.time}-${i}`}>
                <title>{`${timeLabel(b.time)} · O ${fmt(b.open)} H ${fmt(b.high)} L ${fmt(b.low)} C ${fmt(b.close)}`}</title>
                <line
                  x1={x}
                  x2={x}
                  y1={priceY(b.high)}
                  y2={priceY(b.low)}
                  className={up ? "wick-up" : "wick-down"}
                />
                <rect
                  x={x - candleW / 2}
                  y={Math.min(yo, yc)}
                  width={candleW}
                  height={Math.max(1, Math.abs(yc - yo))}
                  className={up ? "candle-up" : "candle-down"}
                />
              </g>
            );
          })}
          {data
            .filter(
              (_, i) =>
                i === 0 ||
                i === data.length - 1 ||
                i % Math.ceil(data.length / 6) === 0
            )
            .map(b => (
              <text
                key={b.time}
                x={xAt(data.indexOf(b))}
                y={H - 8}
                textAnchor="middle"
                className="axis-label"
              >
                {timeLabel(b.time)}
              </text>
            ))}
          <line
            x1={L}
            x2={W - R}
            y1={priceY(data.at(-1)!.close)}
            y2={priceY(data.at(-1)!.close)}
            className="last-price-line"
          />
        </svg>
      </div>
    </div>
  );
}
