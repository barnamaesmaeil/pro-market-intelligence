import { useRef, useState } from "react";
import type { Analysis, Timeframe } from "@/lib/market-engine";
import { inferOutcomeReason } from "@/lib/demo-validation";

type RecordItem = {
  id: string;
  createdAt: string;
  signalConfirmedAt?: string;
  signalDataAsOf?: string;
  symbol: string;
  timeframe: Timeframe;
  direction: "BUY" | "SELL";
  entry: number;
  stop?: number;
  targets: number[];
  result: string;
  mt5Open?: number;
  mt5Close?: number;
  mt5CloseAt?: string;
  notes: string;
};
const STORAGE = "pmi-demo-records-v1";
function load(): RecordItem[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE) ?? "[]");
  } catch {
    return [];
  }
}
function download(name: string, content: string, type = "text/csv") {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([content], { type }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}
function splitLine(line: string, delimiter = ",") {
  const out: string[] = [];
  let value = "",
    quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"' && line[i + 1] === '"' && quoted) {
      value += '"';
      i++;
    } else if (c === '"') quoted = !quoted;
    else if (c === delimiter && !quoted) {
      out.push(value);
      value = "";
    } else value += c;
  }
  out.push(value);
  return out;
}
function canon(s: string) {
  return s.replace(/[._/\s-]/g, "").toLowerCase();
}
export default function DemoValidation({
  analysis,
  symbol,
  timeframe,
}: {
  analysis: Analysis | null;
  symbol: string;
  timeframe: Timeframe;
}) {
  const [items, setItems] = useState<RecordItem[]>(load);
  const [message, setMessage] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  function persist(next: RecordItem[]) {
    setItems(next);
    localStorage.setItem(STORAGE, JSON.stringify(next));
  }
  function addSignal() {
    if (!analysis || analysis.scenario.direction === "NO TRADE") {
      setMessage("برای ثبت، ابتدا یک سناریوی BUY یا SELL لازم است.");
      return;
    }
    const entry =
      (analysis.scenario.entryLow! + analysis.scenario.entryHigh!) / 2;
    const signalKinds =
      analysis.scenario.direction === "BUY"
        ? ["BOS_UP", "CHOCH_UP", "FVG_BULL", "LIQUIDITY_SWEEP_LOW"]
        : ["BOS_DOWN", "CHOCH_DOWN", "FVG_BEAR", "LIQUIDITY_SWEEP_HIGH"];
    const signalConfirmedAt =
      analysis.events.filter(e => signalKinds.includes(e.kind)).at(-1)
        ?.confirmedAt ?? analysis.confirmedThrough;
    const item: RecordItem = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      signalConfirmedAt,
      signalDataAsOf: analysis.confirmedThrough,
      symbol,
      timeframe,
      direction: analysis.scenario.direction,
      entry,
      stop: analysis.scenario.stop,
      targets: analysis.scenario.targets,
      result: "Open",
      notes: analysis.scenario.reasons.join("; "),
    };
    persist([item, ...items]);
    setMessage("سیگنال دمو ذخیره شد؛ هیچ معامله‌ای اجرا نشده است.");
  }
  function update(
    id: string,
    key: "result" | "notes" | "mt5Open",
    value: string
  ) {
    persist(
      items.map(x =>
        x.id !== id
          ? x
          : {
              ...x,
              [key]: key === "mt5Open" ? Number(value) || undefined : value,
            }
      )
    );
  }
  async function importFile(file?: File) {
    if (!file) return;
    const text = await file.text();
    const lines = text
      .replace(/^\uFEFF/, "")
      .split(/\r?\n/)
      .filter(Boolean);
    if (lines.length < 2) {
      setMessage("فایل MT5 خالی یا نامعتبر است.");
      return;
    }
    const delimiter = [",", ";", "\t"].sort(
      (a, b) => splitLine(lines[0], b).length - splitLine(lines[0], a).length
    )[0];
    const header = splitLine(lines[0], delimiter).map(x =>
      x.trim().toLowerCase()
    );
    const idx = (...names: string[]) =>
      header.findIndex(x => names.includes(x));
    const iTime = idx("time", "open time", "date", "datetime", "timestamp"),
      iSymbol = idx("symbol", "item"),
      iType = idx("type", "side", "action"),
      iDirection = idx("direction"),
      iOpen = idx("open price", "entry price", "price", "open"),
      iCloseByLabel = idx("close price", "exit price", "close"),
      iClose =
        iCloseByLabel >= 0
          ? iCloseByLabel
          : header.findIndex((x, i) => x === "price" && i !== iOpen),
      iCloseTime = idx("close time", "exit time"),
      iProfit = idx("profit", "p/l", "net profit"),
      iStop = idx("s/l", "sl", "stop loss", "stoploss"),
      iTarget = idx("t/p", "tp", "take profit", "takeprofit");
    if (iTime < 0 || iOpen < 0) {
      setMessage(
        "ستون زمان و قیمت/ورود از header فایل قابل تشخیص نیست. از MT5 گزارش CSV با ستون‌های زمان و Price یا Open Price صادر کنید."
      );
      return;
    }
    const additions: RecordItem[] = [];
    let updatedItems = [...items];
    let matched = 0,
      bad = 0;
    for (const line of lines.slice(1)) {
      const row = splitLine(line, delimiter);
      const entry = Number(String(row[iOpen] ?? "").replace(/,/g, ""));
      const date = Date.parse(row[iTime] ?? "");
      if (!Number.isFinite(entry) || !Number.isFinite(date)) {
        bad++;
        continue;
      }
      const type = (iType >= 0 ? row[iType] : "").toLowerCase(),
        directionText = iDirection >= 0 ? row[iDirection].toLowerCase() : "";
      const direction: RecordItem["direction"] = type.includes("sell")
        ? "SELL"
        : type.includes("buy")
          ? "BUY"
          : directionText.includes("out")
            ? "SELL"
            : "BUY";
      const tradeSymbol = iSymbol >= 0 && row[iSymbol] ? row[iSymbol] : symbol;
      const rawProfit =
        iProfit >= 0 ? Number(String(row[iProfit]).replace(/,/g, "")) : NaN;
      const close =
        iClose >= 0 ? Number(String(row[iClose]).replace(/,/g, "")) : NaN;
      const closeTime =
        iCloseTime >= 0 ? Date.parse(row[iCloseTime] ?? "") : NaN;
      const importedStop =
        iStop >= 0
          ? Number(String(row[iStop]).replace(/,/g, "")) || undefined
          : undefined;
      const importedTarget =
        iTarget >= 0 ? Number(String(row[iTarget]).replace(/,/g, "")) : NaN;
      const match = updatedItems.find(
        x =>
          canon(x.symbol) === canon(tradeSymbol) &&
          x.direction === direction &&
          Math.abs(Date.parse(x.createdAt) - date) < 24 * 3600_000
      );
      if (match) {
        matched++;
        updatedItems = updatedItems.map(x =>
          x.id === match.id
            ? {
                ...x,
                mt5Open: entry,
                mt5Close: Number.isFinite(close) ? close : undefined,
                mt5CloseAt: Number.isFinite(closeTime)
                  ? new Date(closeTime).toISOString()
                  : undefined,
                result: Number.isFinite(rawProfit)
                  ? rawProfit > 0
                    ? "Win"
                    : rawProfit < 0
                      ? "Loss"
                      : "Breakeven"
                  : "Imported",
                notes: `${x.notes} | MT5 CSV matched by symbol/side/time | ${Number.isFinite(close) ? inferOutcomeReason(x.direction, close, x.stop, x.targets) : "Exit reason cannot be inferred: close price missing."}`,
              }
            : x
        );
        continue;
      }
      additions.push({
        id: crypto.randomUUID(),
        createdAt: new Date(date).toISOString(),
        symbol: tradeSymbol,
        timeframe,
        direction,
        entry,
        stop: importedStop,
        targets: Number.isFinite(importedTarget) ? [importedTarget] : [],
        result: Number.isFinite(rawProfit)
          ? rawProfit > 0
            ? "Win"
            : rawProfit < 0
              ? "Loss"
              : "Breakeven"
          : "Imported",
        mt5Open: entry,
        mt5Close: Number.isFinite(close) ? close : undefined,
        mt5CloseAt: Number.isFinite(closeTime)
          ? new Date(closeTime).toISOString()
          : undefined,
        notes: `${Number.isFinite(rawProfit) ? `Imported from MT5 CSV · profit ${rawProfit}` : "Imported from MT5 CSV · review outcome"} | ${Number.isFinite(close) ? inferOutcomeReason(direction, close, importedStop, Number.isFinite(importedTarget) ? [importedTarget] : []) : "Exit reason cannot be inferred: close price missing."}`,
      });
    }
    persist([...additions, ...updatedItems]);
    setMessage(
      `ورود فایل انجام شد: ${additions.length} معامله‌ی دمو وارد شد، ${matched} ردیف به سیگنال موجود متصل شد${bad ? `، ${bad} ردیف نامعتبر نادیده گرفته شد` : ""}. تایم‌فریم در صورت نبودن در فایل با مقدار انتخاب‌شده پر شده؛ بازبینی کنید.`
    );
  }
  const exportCsv = () => {
    const header =
      "createdAt,signalConfirmedAt,signalDataAsOf,symbol,timeframe,direction,entry,stop,targets,result,mt5Open,mt5Close,mt5CloseAt,priceDifference,notes";
    const rows = items.map(x =>
      [
        x.createdAt,
        x.signalConfirmedAt ?? "",
        x.signalDataAsOf ?? "",
        x.symbol,
        x.timeframe,
        x.direction,
        x.entry,
        x.stop ?? "",
        x.targets.join("|"),
        x.result,
        x.mt5Open ?? "",
        x.mt5Close ?? "",
        x.mt5CloseAt ?? "",
        x.mt5Open === undefined ? "" : x.entry - x.mt5Open,
        `"${x.notes.replaceAll('"', '""')}"`,
      ].join(",")
    );
    download("pmi-demo-validation.csv", [header, ...rows].join("\n"));
  };
  return (
    <section className="panel demo-panel">
      <div className="section-title">
        <div>
          <span className="eyebrow">SIMULATED RECORDS ONLY</span>
          <h2>DEMO VALIDATION</h2>
          <p>
            ثبت دستی سناریو و مقایسه با خروجی حساب دمو MT5؛ بدون اتصال به
            کارگزاری و بدون اجرای سفارش.
          </p>
        </div>
        <span className="badge badge-muted">{items.length} RECORDS</span>
      </div>
      <div className="demo-actions">
        <button className="button button-primary" onClick={addSignal}>
          ＋ ثبت سناریوی فعلی
        </button>
        <button className="button" onClick={() => fileRef.current?.click()}>
          واردکردن CSV از MT5
        </button>
        <button className="button" onClick={exportCsv}>
          خروجی CSV
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          hidden
          onChange={e => void importFile(e.target.files?.[0])}
        />
      </div>
      {message && <div className="inline-note">{message}</div>}
      {items.length === 0 ? (
        <div className="empty-state">
          هنوز سیگنالی در دفتر دمو ثبت نشده است.
        </div>
      ) : (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>زمان</th>
                <th>نماد/TF</th>
                <th>جهت</th>
                <th>Entry / SL / TP</th>
                <th>MT5 Open</th>
                <th>اختلاف Entry−MT5</th>
                <th>نتیجه</th>
                <th>یادداشت</th>
              </tr>
            </thead>
            <tbody>
              {items.map(x => (
                <tr key={x.id}>
                  <td>
                    {new Date(x.createdAt).toLocaleString()}
                    <small>
                      تأیید:{" "}
                      {x.signalConfirmedAt
                        ? new Date(x.signalConfirmedAt).toLocaleString()
                        : "در فایل موجود نیست"}
                    </small>
                  </td>
                  <td>
                    {x.symbol}
                    <small>{x.timeframe}</small>
                  </td>
                  <td>
                    <span
                      className={
                        x.direction === "BUY" ? "tone-up" : "tone-down"
                      }
                    >
                      {x.direction}
                    </span>
                  </td>
                  <td>
                    {x.entry.toPrecision(7)}
                    <small>
                      SL {x.stop?.toPrecision(7) ?? "—"} · TP{" "}
                      {x.targets.map(t => t.toPrecision(6)).join(" / ")}
                    </small>
                  </td>
                  <td>
                    <input
                      className="table-input"
                      type="number"
                      value={x.mt5Open ?? ""}
                      placeholder="ورود دمو"
                      onChange={e => update(x.id, "mt5Open", e.target.value)}
                    />
                  </td>
                  <td>
                    {x.mt5Open === undefined
                      ? "—"
                      : (x.entry - x.mt5Open).toPrecision(6)}
                  </td>
                  <td>
                    <select
                      className="table-input"
                      value={x.result}
                      onChange={e => update(x.id, "result", e.target.value)}
                    >
                      <option>Open</option>
                      <option>Win</option>
                      <option>Loss</option>
                      <option>Breakeven</option>
                      <option>Imported</option>
                    </select>
                  </td>
                  <td>
                    <input
                      className="table-input note-input"
                      value={x.notes}
                      onChange={e => update(x.id, "notes", e.target.value)}
                      aria-label="دلیل یا یادداشت"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="footnote">
        ورودی MT5 در این نسخه CSV با header را می‌خواند؛ جداکننده‌ی کاما،
        سمی‌کالن یا tab پذیرفته می‌شود. فایل HTML گزارش MT5 هنوز پشتیبانی
        نمی‌شود. ردیف‌های نامنطبق به‌عنوان سابقه‌ی واردشده ذخیره می‌شوند؛ تطبیق
        باید بازبینی شود. اختلاف علامت‌دار: قیمت پیشنهادی − قیمت ورود MT5.
      </p>
    </section>
  );
}
