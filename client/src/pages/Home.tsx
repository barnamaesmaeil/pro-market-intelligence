import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import MarketChart from "@/features/MarketChart";
import DemoValidation from "@/features/DemoValidation";
import {
  analyzeMarket,
  type Candle,
  type Timeframe,
} from "@/lib/market-engine";
import {
  isCsvAnalysisReady,
  parseCsvText,
  parseWithMapping,
  type ColumnMap,
  type CsvResult,
} from "@/lib/csv-market";

type Mode = "LIVE ANALYSIS" | "CHART & FILE" | "DEMO VALIDATION";
const symbols = [
  "XAU/USD",
  "EUR/USD",
  "GBP/USD",
  "USD/JPY",
  "BTC/USDT",
  "ETH/USDT",
  "BNB/USDT",
  "SOL/USDT",
];
const timeframes: Timeframe[] = ["1m", "5m", "15m", "30m", "1h", "4h", "1D"];
const intervalMs: Record<Timeframe, number> = {
  "1m": 60_000,
  "5m": 300_000,
  "15m": 900_000,
  "30m": 1_800_000,
  "1h": 3_600_000,
  "4h": 14_400_000,
  "1D": 86_400_000,
};
const eventLabel: Record<string, string> = {
  SWING_HIGH: "Swing High",
  SWING_LOW: "Swing Low",
  BOS_UP: "BOS ↑",
  BOS_DOWN: "BOS ↓",
  CHOCH_UP: "CHoCH ↑",
  CHOCH_DOWN: "CHoCH ↓",
  FVG_BULL: "Bullish FVG",
  FVG_BEAR: "Bearish FVG",
  ORDER_BLOCK_BULL: "Bullish Order Block",
  ORDER_BLOCK_BEAR: "Bearish Order Block",
  LIQUIDITY_SWEEP_HIGH: "Liquidity Sweep High",
  LIQUIDITY_SWEEP_LOW: "Liquidity Sweep Low",
};
function makeDemo(symbol: string, tf: Timeframe): Candle[] {
  let seed = symbol.split("").reduce((a, c) => a + c.charCodeAt(0), 7);
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  const step = intervalMs[tf];
  let p =
    symbol === "XAU/USD"
      ? 2650
      : symbol.includes("JPY")
        ? 150
        : symbol.includes("BTC")
          ? 82000
          : symbol.includes("ETH")
            ? 3100
            : 1.1;
  const out: Candle[] = [];
  for (let i = 0; i < 180; i++) {
    const change = (rnd() - 0.48) * p * 0.003;
    const open = p;
    p += change;
    const high = Math.max(open, p) + rnd() * p * 0.0008;
    const low = Math.min(open, p) - rnd() * p * 0.0008;
    out.push({
      time: new Date(Date.now() - (179 - i) * step).toISOString(),
      open,
      high,
      low,
      close: p,
      volume: 10 + rnd() * 100,
      complete: true,
    });
  }
  return out;
}
function fmt(value?: number) {
  return value === undefined || !Number.isFinite(value)
    ? "—"
    : value >= 1000
      ? value.toLocaleString(undefined, { maximumFractionDigits: 2 })
      : value.toPrecision(7);
}
function download(name: string, text: string, mime = "application/json") {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type: mime }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}
export default function Home() {
  const [mode, setMode] = useState<Mode>("LIVE ANALYSIS");
  const [symbol, setSymbol] = useState("XAU/USD");
  const [timeframe, setTimeframe] = useState<Timeframe>("15m");
  const [liveBars, setLiveBars] = useState<Candle[]>([]);
  const [provider, setProvider] = useState("");
  const [lastUpdated, setLastUpdated] = useState("");
  const [connection, setConnection] = useState<
    "connecting" | "connected" | "disconnected"
  >("connecting");
  const [dataError, setDataError] = useState("");
  const [demoMode, setDemoMode] = useState(false);
  const [higher, setHigher] = useState<
    Record<string, { trend: string; asOf: string }>
  >({});
  const [loading, setLoading] = useState(false);
  const [fileBars, setFileBars] = useState<Candle[]>([]);
  const [fileName, setFileName] = useState("");
  const [csvResult, setCsvResult] = useState<CsvResult | null>(null);
  const [rawLines, setRawLines] = useState<string[]>([]);
  const [columnMap, setColumnMap] = useState<ColumnMap>({
    time: "",
    open: "",
    high: "",
    low: "",
    close: "",
    volume: "",
  });
  const [selectedTf, setSelectedTf] = useState<Timeframe>("15m");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [replayIndex, setReplayIndex] = useState(0);
  const [alertPrice, setAlertPrice] = useState("");
  const [alertSide, setAlertSide] = useState<"above" | "below">("above");
  const [alertEnabled, setAlertEnabled] = useState(false);
  const lastAlertClose = useRef<number | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const refresh = useCallback(async () => {
    if (demoMode) {
      const demo = makeDemo(symbol, timeframe);
      setLiveBars(demo);
      setProvider("نمونه‌ی ساختگی • DEMO");
      setLastUpdated(new Date().toISOString());
      setConnection("connected");
      setDataError("");
      return;
    }
    setLoading(true);
    try {
      const url = `/api/market/bars?symbol=${encodeURIComponent(symbol)}&timeframe=${encodeURIComponent(timeframe)}`;
      const response = await fetch(url, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok)
        throw new Error(payload.error || `HTTP ${response.status}`);
      setLiveBars(payload.bars);
      setProvider(
        payload.provider === "binance"
          ? "Binance Spot REST"
          : "Twelve Data • XAU/FX"
      );
      setLastUpdated(payload.fetchedAt);
      setConnection("connected");
      setDataError("");
      if (alertEnabled && alertPrice && payload.bars.length) {
        const price = Number(alertPrice),
          now = payload.bars.at(-1)!.close,
          prev = lastAlertClose.current;
        if (
          Number.isFinite(price) &&
          prev !== null &&
          ((alertSide === "above" && prev < price && now >= price) ||
            (alertSide === "below" && prev > price && now <= price))
        ) {
          if ("Notification" in window && Notification.permission === "granted")
            new Notification(`${symbol} price alert`, {
              body: `Price crossed ${fmt(price)} (${alertSide})`,
            });
        }
        lastAlertClose.current = now;
      }
    } catch (error) {
      setConnection("disconnected");
      setDataError(
        error instanceof Error ? error.message : "Market data unavailable"
      );
    } finally {
      setLoading(false);
    }
  }, [symbol, timeframe, demoMode, alertEnabled, alertPrice, alertSide]);
  useEffect(() => {
    void refresh();
    const isCrypto = symbol.endsWith("/USDT");
    const id = window.setInterval(
      () => void refresh(),
      isCrypto ? 30_000 : 180_000
    );
    return () => window.clearInterval(id);
  }, [refresh, symbol]);
  useEffect(() => {
    if (demoMode) return;
    setLiveBars([]);
    setProvider("");
    setLastUpdated("");
    setDataError("");
    setConnection("connecting");
    lastAlertClose.current = null;
  }, [symbol, timeframe, demoMode]);
  useEffect(() => {
    setHigher({});
    if (mode !== "LIVE ANALYSIS" || demoMode) return;
    let cancelled = false;
    const load = async () => {
      setHigher({});
      const fresh: Record<string, { trend: string; asOf: string }> = {};
      for (const tf of ["1h", "4h"] as Timeframe[]) {
        try {
          const r = await fetch(
            `/api/market/bars?symbol=${encodeURIComponent(symbol)}&timeframe=${tf}`,
            { cache: "no-store" }
          );
          if (!r.ok) continue;
          const p = await r.json();
          const a = analyzeMarket(
            p.bars.filter((b: Candle) => b.complete !== false),
            { timeframe: tf }
          );
          if (!cancelled && a)
            fresh[tf] = { trend: a.trend, asOf: a.confirmedThrough };
        } catch {
          /* high-timeframe context remains explicitly unavailable */
        }
      }
      if (!cancelled) setHigher(fresh);
    };
    void load();
    const timer = window.setInterval(() => void load(), 900_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [symbol, timeframe, mode, demoMode]);
  const effectiveTf = mode === "CHART & FILE" ? selectedTf : timeframe;
  const filteredFile = useMemo(
    () =>
      fileBars.filter(
        b =>
          (!fromDate || b.time.slice(0, 10) >= fromDate) &&
          (!toDate || b.time.slice(0, 10) <= toDate)
      ),
    [fileBars, fromDate, toDate]
  );
  const replayBars =
    mode === "CHART & FILE" && filteredFile.length
      ? filteredFile.slice(
          0,
          Math.min(replayIndex || filteredFile.length, filteredFile.length)
        )
      : liveBars;
  const activeBars = mode === "CHART & FILE" ? replayBars : liveBars;
  const analysisBars =
    mode === "CHART & FILE"
      ? isCsvAnalysisReady(csvResult)
        ? activeBars
        : []
      : connection !== "connected"
        ? []
        : activeBars.filter(b => b.complete !== false);
  const analysis = useMemo(
    () => analyzeMarket(analysisBars, { timeframe: effectiveTf }),
    [analysisBars, effectiveTf]
  );
  async function loadCsv(file?: File) {
    if (!file) return;
    const text = await file.text();
    const result = parseCsvText(text);
    const lines = text
      .replace(/^\uFEFF/, "")
      .split(/\r?\n/)
      .filter(x => x.trim());
    setRawLines(lines);
    setCsvResult(result);
    setColumnMap(result.mapping);
    setFileName(file.name);
    setFileBars(result.rows);
    setSelectedTf(result.timeframe ?? "15m");
    setReplayIndex(result.rows.length);
    setFromDate("");
    setToDate("");
  }
  function remap(next: ColumnMap) {
    setColumnMap(next);
    if (csvResult && rawLines.length) {
      const parsed = parseWithMapping(rawLines, csvResult.headers, next);
      setCsvResult(parsed);
      setFileBars(parsed.rows);
      setReplayIndex(parsed.rows.length);
      if (parsed.timeframe) setSelectedTf(parsed.timeframe);
    }
  }
  function saveAnalysis() {
    if (!analysis) return;
    const payload = {
      savedAt: new Date().toISOString(),
      source: mode,
      symbol: mode === "CHART & FILE" ? fileName || "Imported CSV" : symbol,
      timeframe: effectiveTf,
      barCount: activeBars.length,
      analysis,
    };
    try {
      const previous = JSON.parse(
        localStorage.getItem("pmi-analysis-saved") || "[]"
      );
      localStorage.setItem(
        "pmi-analysis-saved",
        JSON.stringify([payload, ...previous].slice(0, 100))
      );
    } catch {
      /* ignore storage failures */
    }
    download(
      `analysis-${effectiveTf}-${Date.now()}.json`,
      JSON.stringify(payload, null, 2)
    );
  }
  async function enableAlert() {
    if (!("Notification" in window)) {
      setDataError("مرورگر اعلان سیستم را پشتیبانی نمی‌کند.");
      return;
    }
    const result = await Notification.requestPermission();
    setAlertEnabled(result === "granted");
  }
  const last = activeBars.at(-1);
  const viewTab = (name: Mode, label: string, icon: string) => (
    <button
      className={`nav-item ${mode === name ? "active" : ""}`}
      onClick={() => setMode(name)}
    >
      <span className="nav-icon">{icon}</span>
      {label}
    </button>
  );
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">PM</div>
          <div>
            <strong>PRO MARKET</strong>
            <small>INTELLIGENCE</small>
          </div>
        </div>
        <div className="workspace-label">WORKSPACE</div>
        <nav>
          {viewTab("LIVE ANALYSIS", "LIVE ANALYSIS", "◉")}
          {viewTab("CHART & FILE", "CHART & FILE", "▤")}
          {viewTab("DEMO VALIDATION", "DEMO VALIDATION", "◷")}
        </nav>
        <div className="sidebar-bottom">
          <div className="engine-chip">
            <span className="pulse-dot" />
            SHARED ANALYSIS ENGINE<small>causal · no look-ahead</small>
          </div>
          <div className="sidebar-foot">
            READ-ONLY MARKET DATA
            <br />
            NO LIVE TRADE EXECUTION
          </div>
        </div>
      </aside>
      <main className="main-area">
        <header className="topbar">
          <div className="mobile-brand">
            PMI <span>MARKET INTELLIGENCE</span>
          </div>
          <div className="topbar-right">
            <span className={`connection-pill ${connection}`}>
              <i />
              {connection === "connected"
                ? demoMode
                  ? "DEMO DATA"
                  : "CONNECTED"
                : connection === "connecting"
                  ? "CONNECTING"
                  : "DISCONNECTED"}
            </span>
            <span className="top-clock">
              {lastUpdated
                ? `UPDATED ${new Date(lastUpdated).toLocaleTimeString()}`
                : "NO UPDATE YET"}
            </span>
          </div>
        </header>
        <div className="content-wrap">
          <section className="page-heading">
            <div>
              <span className="eyebrow">
                MARKET STRUCTURE · PRICE ACTION · VALIDATION
              </span>
              <h1>{mode}</h1>
              <p>
                تحلیل قابل‌ردیابی بازار؛ داده‌ی زنده و تاریخی، یک موتور مشترک.
              </p>
            </div>
            <div className="heading-badges">
              <span className="badge badge-muted">READ ONLY</span>
              <span className="badge badge-amber">NO REAL TRADES</span>
            </div>
          </section>
          {mode !== "DEMO VALIDATION" && (
            <section className="toolbar panel">
              <label className="select-field">
                <span>نماد</span>
                <select
                  value={symbol}
                  onChange={e => setSymbol(e.target.value)}
                >
                  {symbols.map(s => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
              <div className="tf-group">
                {timeframes.map(tf => (
                  <button
                    key={tf}
                    className={`tf-button ${(mode === "CHART & FILE" ? selectedTf : timeframe) === tf ? "selected" : ""}`}
                    onClick={() =>
                      mode === "CHART & FILE"
                        ? setSelectedTf(tf)
                        : setTimeframe(tf)
                    }
                  >
                    {tf}
                  </button>
                ))}
              </div>
              {mode === "LIVE ANALYSIS" && (
                <>
                  <button
                    className="button button-quiet"
                    onClick={() => void refresh()}
                    disabled={loading}
                  >
                    {loading ? "در حال دریافت…" : "↻ بروزرسانی"}
                  </button>
                  <button
                    className={`button ${demoMode ? "button-primary" : ""}`}
                    onClick={() => setDemoMode(x => !x)}
                  >
                    {demoMode ? "DEMO SAMPLE • روشن" : "آزمون داده نمونه"}
                  </button>
                </>
              )}
            </section>
          )}
          {mode === "LIVE ANALYSIS" && (
            <>
              {dataError && (
                <div className="connection-error">
                  <strong>دریافت بازار ناموفق بود</strong>
                  <span>{dataError}</span>
                  <small>
                    {symbol === "XAU/USD"
                      ? "XAU/USD از منبع واقعی طلا (Twelve Data) خوانده می‌شود؛ قیمت رمزارز جایگزین طلا نمی‌شود."
                      : "اتصال خواندنی بازار در دسترس نیست؛ داده‌ی قبلی را تازه فرض نکنید."}
                  </small>
                  <small>
                    آخرین دریافت موفق:{" "}
                    {lastUpdated
                      ? new Date(lastUpdated).toLocaleString()
                      : "ندارد"}
                    ؛ کندل‌های باقی‌مانده stale هستند و سناریوی قبلی غیرفعال
                    است.
                  </small>
                  <button className="button" onClick={() => void refresh()}>
                    تلاش دوباره
                  </button>
                </div>
              )}
              <div className="market-grid">
                <div className="primary-column">
                  <section className="quote-row">
                    <div>
                      <span className="eyebrow">
                        {symbol} · {timeframe} ·{" "}
                        {provider || "WAITING FOR SOURCE"}
                      </span>
                      <div className="large-price">
                        {fmt(last?.close)}
                        {last && (
                          <span className="last-change">
                            {last.close >= last.open ? "▲" : "▼"}{" "}
                            {Math.abs(
                              ((last.close - last.open) / last.open) * 100
                            ).toFixed(2)}
                            %
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="quote-side">
                      <span>LAST BAR</span>
                      <strong>
                        {last ? new Date(last.time).toLocaleString() : "—"}
                      </strong>
                      <small>
                        {last?.complete === false
                          ? "کندل جاری · ممکن است تغییر کند"
                          : "UTC feed time"}
                      </small>
                    </div>
                  </section>
                  <section className="panel chart-panel">
                    <MarketChart
                      bars={activeBars}
                      analysis={analysis}
                      title={`${symbol} / ${timeframe}${connection === "disconnected" ? " / STALE" : ""}`}
                    />
                  </section>
                  <section className="panel structure-panel">
                    <div className="section-title compact">
                      <div>
                        <span className="eyebrow">CONFIRMED STRUCTURE</span>
                        <h2>یافته‌های موتور</h2>
                      </div>
                      <button
                        className="button button-small"
                        onClick={saveAnalysis}
                        disabled={!analysis}
                      >
                        ذخیره / JSON
                      </button>
                    </div>
                    <div className="event-list">
                      {analysis?.events
                        .slice(-10)
                        .reverse()
                        .map((event, i) => (
                          <div
                            className="event-row"
                            key={`${event.kind}-${event.confirmedAt}-${i}`}
                          >
                            <span
                              className={`event-tag ${event.kind.includes("BULL") || event.kind.endsWith("UP") ? "positive" : event.kind.includes("BEAR") || event.kind.endsWith("DOWN") ? "negative" : "neutral"}`}
                            >
                              {eventLabel[event.kind] ?? event.kind}
                            </span>
                            <span>{event.detail}</span>
                            <time title={event.confirmedAt}>
                              {new Date(event.confirmedAt).toLocaleString()}
                            </time>
                          </div>
                        ))}
                    </div>
                    {!analysis?.events.length && (
                      <div className="empty-inline">
                        تا این لحظه ساختار تأییدشده‌ای برای نمایش نیست.
                      </div>
                    )}
                  </section>
                </div>
                <aside className="analysis-column">
                  <section className="panel scenario-panel">
                    <div className="section-title compact">
                      <div>
                        <span className="eyebrow">RULE-BASED SETUP</span>
                        <h2>سناریوی فعلی</h2>
                      </div>
                      <span
                        className={`direction-badge ${analysis?.scenario.direction === "BUY" ? "buy" : analysis?.scenario.direction === "SELL" ? "sell" : "flat"}`}
                      >
                        {analysis?.scenario.direction ?? "WAIT"}
                      </span>
                    </div>
                    <div className="trend-line">
                      <span>ساختار روند</span>
                      <strong
                        className={
                          analysis?.trend === "BULLISH"
                            ? "tone-up"
                            : analysis?.trend === "BEARISH"
                              ? "tone-down"
                              : ""
                        }
                      >
                        {analysis?.trend ?? "—"}
                      </strong>
                    </div>
                    {analysis?.scenario.direction !== "NO TRADE" &&
                      analysis?.scenario.entryLow !== undefined && (
                        <div className="levels-grid">
                          <div>
                            <span>ENTRY ZONE</span>
                            <strong>
                              {fmt(analysis.scenario.entryLow)} –{" "}
                              {fmt(analysis.scenario.entryHigh)}
                            </strong>
                          </div>
                          <div>
                            <span>STOP / INVALIDATION</span>
                            <strong>{fmt(analysis.scenario.stop)}</strong>
                          </div>
                          <div>
                            <span>TARGETS</span>
                            <strong>
                              {analysis.scenario.targets.map(fmt).join(" · ")}
                            </strong>
                          </div>
                        </div>
                      )}
                    <div className="reason-list">
                      {analysis?.scenario.reasons.map((r, i) => (
                        <div key={i}>
                          <span>↳</span>
                          {r}
                        </div>
                      ))}
                    </div>
                    {analysis?.scenario.invalidation && (
                      <div className="invalidation">
                        ابطال: {analysis.scenario.invalidation}
                      </div>
                    )}
                    <div className="confidence-line">
                      کیفیت قواعدی{" "}
                      <span>{analysis?.scenario.confidence ?? "—"}</span>
                      <small>
                        این نتیجه قطعی نیست و دستور معامله محسوب نمی‌شود.
                      </small>
                    </div>
                  </section>
                  <section className="panel mtf-panel">
                    <div className="section-title compact">
                      <div>
                        <span className="eyebrow">CLOSED-BAR CONTEXT</span>
                        <h2>چندتایم‌فریمی</h2>
                      </div>
                      <span className="badge badge-muted">MTF</span>
                    </div>
                    {["1h", "4h"].map(tf => (
                      <div className="mtf-row" key={tf}>
                        <strong>{tf}</strong>
                        <span
                          className={
                            higher[tf]?.trend === "BULLISH"
                              ? "tone-up"
                              : higher[tf]?.trend === "BEARISH"
                                ? "tone-down"
                                : ""
                          }
                        >
                          {higher[tf]?.trend ?? "در انتظار داده"}
                        </span>
                        <small>
                          {higher[tf]?.asOf
                            ? new Date(higher[tf].asOf).toLocaleTimeString()
                            : "—"}
                        </small>
                      </div>
                    ))}
                    <p className="footnote">
                      در تحلیل تاریخی فقط کندل‌های بالاترِ بسته‌شده تا زمان
                      انتخاب‌شده مجازند.
                    </p>
                  </section>
                  <section className="panel alert-panel">
                    <div className="eyebrow">PRICE CONDITION</div>
                    <h3>اعلان مرورگر</h3>
                    <div className="alert-control">
                      <select
                        value={alertSide}
                        onChange={e =>
                          setAlertSide(e.target.value as "above" | "below")
                        }
                      >
                        <option value="above">عبور به بالای</option>
                        <option value="below">افت به زیر</option>
                      </select>
                      <input
                        type="number"
                        value={alertPrice}
                        onChange={e => setAlertPrice(e.target.value)}
                        placeholder="قیمت"
                      />
                    </div>
                    <button
                      className="button button-primary full-button"
                      onClick={() => void enableAlert()}
                      disabled={!alertPrice}
                    >
                      {alertEnabled
                        ? "اعلان فعال است"
                        : "اجازه و فعال‌سازی اعلان"}
                    </button>
                    <small>
                      اعلان فقط وقتی صفحه باز است و مرورگر اجازه داده باشد بررسی
                      می‌شود.
                    </small>
                  </section>
                </aside>
              </div>
            </>
          )}
          {mode === "CHART & FILE" && (
            <div className="file-layout">
              <section className="panel file-import">
                <div className="section-title">
                  <div>
                    <span className="eyebrow">CSV · OHLCV</span>
                    <h2>تحلیل چارت و فایل تاریخی</h2>
                    <p>
                      سطر header لازم است. زمان‌ها در مرورگر به UTC نرمال
                      می‌شوند.
                    </p>
                  </div>
                </div>
                <input
                  ref={fileInput}
                  type="file"
                  accept=".csv,text/csv"
                  hidden
                  onChange={e => void loadCsv(e.target.files?.[0])}
                />
                <div
                  className="drop-zone"
                  onClick={() => fileInput.current?.click()}
                >
                  <div className="upload-icon">⇧</div>
                  <strong>{fileName || "انتخاب فایل CSV"}</strong>
                  <span>
                    فایل از دستگاه شما خوانده می‌شود و بارگذاری سروری ندارد.
                  </span>
                  <button className="button">مرور فایل‌ها</button>
                </div>
                {csvResult && (
                  <>
                    <div className="mapping-grid">
                      {(
                        [
                          "time",
                          "open",
                          "high",
                          "low",
                          "close",
                          "volume",
                        ] as (keyof ColumnMap)[]
                      ).map(key => (
                        <label key={key}>
                          <span>
                            {key.toUpperCase()}
                            {key !== "volume" && <b>*</b>}
                          </span>
                          <select
                            value={columnMap[key]}
                            onChange={e =>
                              remap({ ...columnMap, [key]: e.target.value })
                            }
                          >
                            <option value="">— انتخاب ستون —</option>
                            {csvResult.headers.map(h => (
                              <option key={h}>{h}</option>
                            ))}
                          </select>
                        </label>
                      ))}
                    </div>
                    <div className="validation-report">
                      <div className="report-head">
                        <strong>پیش‌بررسی فایل</strong>
                        <span
                          className={
                            csvResult.errors.length ? "tone-down" : "tone-up"
                          }
                        >
                          {csvResult.errors.length
                            ? `${csvResult.errors.length} خطا`
                            : `${csvResult.rows.length} کندل معتبر`}
                        </span>
                      </div>
                      {csvResult.errors.slice(0, 10).map((e, i) => (
                        <div className="validation-error" key={i}>
                          ! {e}
                        </div>
                      ))}
                      {csvResult.warnings.map((e, i) => (
                        <div className="validation-warning" key={i}>
                          △ {e}
                        </div>
                      ))}
                      {!csvResult.errors.length && (
                        <div className="validation-ok">
                          ساختار OHLC بررسی شد؛ داده‌ی نامعتبر حذف خاموش نشده
                          است. بازه‌ی زمانی نامنظم را بازبینی کنید.
                        </div>
                      )}
                    </div>
                    <div className="file-controls">
                      <label>
                        تایم‌فریم
                        <select
                          value={selectedTf}
                          onChange={e =>
                            setSelectedTf(e.target.value as Timeframe)
                          }
                        >
                          {timeframes.map(tf => (
                            <option key={tf}>{tf}</option>
                          ))}
                        </select>
                      </label>
                      <label>
                        از تاریخ
                        <input
                          type="date"
                          value={fromDate}
                          onChange={e => setFromDate(e.target.value)}
                        />
                      </label>
                      <label>
                        تا تاریخ
                        <input
                          type="date"
                          value={toDate}
                          onChange={e => setToDate(e.target.value)}
                        />
                      </label>
                    </div>
                    <div className="detected-line">
                      تشخیص خودکار:{" "}
                      <strong>
                        {csvResult.timeframe ?? "نامشخص — انتخاب دستی کنید"}
                      </strong>{" "}
                      · بازه فیلترشده: {filteredFile.length} کندل
                    </div>
                  </>
                )}
              </section>
              <div className="file-main">
                {fileBars.length > 0 && (
                  <>
                    <section className="panel chart-panel">
                      <MarketChart
                        bars={replayBars}
                        analysis={analysis}
                        title={`${fileName} / ${selectedTf} / REPLAY`}
                      />
                    </section>
                    <section className="panel replay-panel">
                      <div className="replay-title">
                        <strong>بازپخش تاریخی</strong>
                        <span>
                          گام {Math.min(replayIndex, filteredFile.length)} از{" "}
                          {filteredFile.length} · تحلیل فقط بر اساس کندل‌های
                          قابل‌مشاهده
                        </span>
                      </div>
                      <div className="replay-controls">
                        <button
                          className="button"
                          onClick={() => setReplayIndex(1)}
                          disabled={!filteredFile.length}
                        >
                          اول
                        </button>
                        <button
                          className="button"
                          onClick={() =>
                            setReplayIndex(x => Math.max(1, x - 1))
                          }
                          disabled={replayIndex <= 1}
                        >
                          ◀
                        </button>
                        <input
                          type="range"
                          min="1"
                          max={Math.max(1, filteredFile.length)}
                          value={Math.min(
                            replayIndex,
                            Math.max(1, filteredFile.length)
                          )}
                          onChange={e => setReplayIndex(Number(e.target.value))}
                          disabled={!filteredFile.length}
                        />
                        <button
                          className="button"
                          onClick={() =>
                            setReplayIndex(x =>
                              Math.min(filteredFile.length, x + 1)
                            )
                          }
                          disabled={replayIndex >= filteredFile.length}
                        >
                          ▶
                        </button>
                        <button
                          className="button"
                          onClick={() => setReplayIndex(filteredFile.length)}
                          disabled={!filteredFile.length}
                        >
                          آخر
                        </button>
                      </div>
                      <div className="replay-current">
                        زمان تصمیم:{" "}
                        {replayBars.at(-1)
                          ? new Date(replayBars.at(-1)!.time).toLocaleString()
                          : "—"}{" "}
                        · تأیید الگوهای قابل‌مشاهده در موتور ثبت می‌شود.
                      </div>
                    </section>
                    <section className="panel scenario-panel">
                      <div className="section-title compact">
                        <div>
                          <span className="eyebrow">
                            SAME ENGINE · REPLAY PREFIX
                          </span>
                          <h2>سناریو در این لحظه</h2>
                        </div>
                        <span
                          className={`direction-badge ${analysis?.scenario.direction === "BUY" ? "buy" : analysis?.scenario.direction === "SELL" ? "sell" : "flat"}`}
                        >
                          {analysis?.scenario.direction ?? "—"}
                        </span>
                      </div>
                      <p>
                        روند: <strong>{analysis?.trend ?? "—"}</strong>
                      </p>
                      {analysis?.scenario.reasons.map((r, i) => (
                        <div className="reason-row" key={i}>
                          • {r}
                        </div>
                      ))}
                      {analysis?.scenario.invalidation && (
                        <div className="invalidation">
                          ابطال: {analysis.scenario.invalidation}
                        </div>
                      )}
                      <button
                        className="button button-primary"
                        onClick={saveAnalysis}
                        disabled={!analysis}
                      >
                        ذخیره خروجی JSON
                      </button>
                    </section>
                  </>
                )}
                {!fileBars.length && (
                  <section className="panel empty-file">
                    <div className="empty-icon">▤</div>
                    <h2>برای شروع، یک تاریخچه کندل بارگذاری کنید</h2>
                    <p>
                      ستون‌های زمان و OHLC الزامی‌اند. فایل ورودی روی همین
                      دستگاه پردازش می‌شود.
                    </p>
                  </section>
                )}
              </div>
            </div>
          )}
          {mode === "DEMO VALIDATION" && (
            <DemoValidation
              analysis={analysis}
              symbol={symbol}
              timeframe={timeframe}
            />
          )}
          <footer className="app-footer">
            <span>PRO MARKET INTELLIGENCE</span>
            <span>
              Read-only · هیچ معامله‌ی واقعی اجرا نمی‌شود · نتایج، سیگنال قطعی
              نیستند
            </span>
            <span>SHARED ENGINE v0.1</span>
          </footer>
        </div>
      </main>
    </div>
  );
}
