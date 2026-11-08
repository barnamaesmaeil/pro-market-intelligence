# Pro Market Intelligence

داشبورد واکنش‌گرای تحلیل خواندنی بازار و بازبینی تاریخچه؛ داده‌ی زنده و CSV از یک موتور قاعده‌محور مشترک استفاده می‌کنند. **این ابزار سفارش ارسال نمی‌کند و سیگنال آن تضمین سود یا توصیه‌ی مالی نیست.**

## وضعیت تحویل و شواهد

- برنامه‌ی وب در Manus Preview اجرا شده است؛ endpoint سلامت HTTP 200 می‌دهد.
- در ۹ اکتبر ۲۰۲۶ endpoint بازار برنامه با داده‌ی واقعی `XAU/USD` از Twelve Data، `BTC/USDT` از Binance Spot و `EUR/USD` از Twelve Data آزمایش شد. برای هر سه ۲۴۰ کندل با OHLC سازگار برگشت. در ۱۰ اکتبر مرورگر Preview به `XAU/USD` واقعی متصل شد و contextهای 1h/4h را نشان داد؛ کنسول خطای runtime نداشت. این snapshotها تضمین دسترس‌پذیری آینده‌ی منبع نیستند.
- UI تاریخی با fixture ساختگی شش‌ردیفی آزمایش شد: تشخیص 15m، نمایش شش کندل و replay از گام 6 به 5. fixture با OHLC خراب خطا داد و scenario را مخفی کرد. UI دمو نیز یک ردیف synthetic MT5 را وارد کرد؛ اختلاف entry برابر صفر نمایش داده شد و دلیل عبور قیمت خروج از TP فقط به‌صورت استنباط محتاطانه ثبت شد. این‌ها smoke test هستند؛ native OS file picker، export نهایی، همه‌ی فرمت‌های MT5، همه‌ی نمادها/تایم‌فریم‌ها و همه‌ی اعلان‌ها end-to-end پوشش نشده‌اند.
- TypeScript check، ۱۹ آزمون واحد در پنج فایل و production build وب موفق شدند. screenshot smoke desktop/mobile گرفته شد.
- **APK ساخته یا روی دستگاه Android نصب/آزمایش نشده است.** کاربر پذیرش Android SDK License Agreement را رد کرد و ما آن را نپذیرفتیم؛ نصب SDK Platform/Build Tools لازم متوقف شده است. wrapper موبایل همچنین به origin عمومی HTTPS پایدار نیاز دارد. Preview فعلی را انتشار پایدار فرض نکنید.
- انتشار عمومی وب هم انجام/تأیید نشده است؛ لینک Preview محیط توسعه است، نه production.

## اجرای وب

نیازمند Node.js و pnpm مطابق lockfile:

```bash
pnpm install --frozen-lockfile
pnpm dev
```

فرمان‌های check:

```bash
pnpm check
pnpm test
pnpm build
```

## LIVE ANALYSIS

1. منبع آخرین داده و زمان دریافت در نوار بالا نمایش داده می‌شود. در خطای provider، وضعیت قطع اتصال، خطا و آخرین دریافت موفق دیده می‌شود. کندل آخر با عنوان `STALE` می‌ماند، اما سناریوی قدیمی غیرفعال می‌شود.
2. نمادهای فعال کد: `XAU/USD`, `EUR/USD`, `GBP/USD`, `USD/JPY`, `BTC/USDT`, `ETH/USDT`, `BNB/USDT`, `SOL/USDT`. تایم‌فریم‌ها: `1m`, `5m`, `15m`, `30m`, `1h`, `4h`, `1D`.
3. **طلا:** `XAU/USD` از endpoint تاریخچه‌ی Twelve Data با نماد واقعی `XAU/USD` می‌آید؛ از قیمت BTC یا proxy مصنوعی مشتق نمی‌شود. کلید Twelve Data باید فقط به‌عنوان secret سمت سرور (`TWELVE_DATA_API_KEY`) در تنظیمات امن پروژه ثبت باشد. آن را در سورس، مرورگر، CSV یا گفتگو نگذارید. فارکس هم از Twelve Data است.
4. **رمزارز:** جفت‌های Spot پشتیبانی‌شده از REST عمومی Binance می‌آیند. Binance منبع طلا نیست. کریپتو هر ۳۰ ثانیه و طلا/فارکس هر ۱۸۰ ثانیه poll می‌شود؛ cache سمت سرور کوتاه‌مدت است. این ticker/WebSocket نیست.
5. کندل در حال شکل‌گیری از تحلیل ساختاری کنار گذاشته می‌شود؛ قیمت آخرین کندل زنده ممکن است هنوز تغییر کند. تحلیل چندتایم‌فریمی از کندل‌های بسته‌ی `1h` و `4h` می‌آید و context در شکست refresh به‌عنوان داده‌ی تازه نگه داشته نمی‌شود.
6. سناریوها `BUY`, `SELL` و `NO TRADE` هستند؛ در صورت وجود شواهد قواعدی، محدوده‌ی ورود، توقف/ابطال، هدف‌ها و علت نمایش داده می‌شوند. این‌ها پیش‌بینی قطعی یا دستور معامله نیستند.
7. دکمه‌ی `آزمون داده نمونه` مجموعه‌ی ساختگی آشکارا با برچسب DEMO می‌سازد؛ داده‌ی DEMO را LIVE فرض نکنید.
8. اعلان، عبور قیمت از یک آستانه‌ی بالا/پایین را بررسی می‌کند. اجازه‌ی Notification مرورگر لازم دارد و فقط وقتی صفحه باز است و poll بعدی اجرا می‌شود فعال است؛ اعلان Push پس‌زمینه در این نسخه وجود ندارد.

### تنظیم کلید Twelve Data

در داشبورد پروژه از ورودی امن Secrets برای `TWELVE_DATA_API_KEY` استفاده کنید. مقدار محرمانه را وارد Git یا چت نکنید. سهمیه/پلن provider می‌تواند فاصله‌ی refresh، دسترسی به نماد/بازه یا تعداد درخواست را محدود کند. در خطا، وضعیت برنامه و پاسخ provider را بررسی کنید؛ قیمت غیرطلا برای `XAU/USD` جایگزین نمی‌شود.

## CHART & FILE ANALYSIS

1. وارد `CHART & FILE` شوید و CSV تاریخچه‌ی کندل را انتخاب کنید. داده در مرورگر پردازش می‌شود و به سرور آپلود نمی‌شود.
2. سطر نخست باید header باشد. برای تحلیل ستون زمان و `Open`, `High`, `Low`, `Close` الزامی‌اند؛ `Volume` اختیاری است. سرستون‌های شناخته‌شده خودکار نگاشت می‌شوند و همه‌ی نگاشت‌ها دستی قابل‌تغییرند. هر ستون ورودی فقط می‌تواند یک نقش تحلیلی داشته باشد.
3. زمان باید توسط `Date.parse` مرورگر خوانده شود؛ قیمت‌ها عددی باشند و `High >= max(Open, Close)`, `Low <= min(Open, Close)`. timestamp تکراری، زمان/عدد خراب و OHLC ناسازگار گزارش خطا می‌شوند. زمان خارج از ترتیب هشدار می‌گیرد و پس از هشدار، ردیف‌ها در حافظه زمانی مرتب می‌شوند.
4. **با وجود حتی یک خطای پیش‌بررسی، موتور تحلیل اجرا نمی‌شود.** فایل یا نگاشت را اصلاح کنید تا خطاها صفر شوند. موتور برای نتیجه دست‌کم ۳ کندل معتبر نیاز دارد.
5. تایم‌فریم از فاصله‌ی timestampها حدس زده می‌شود؛ اگر مبهم/ناموجود بود یکی از هفت گزینه را دستی انتخاب کنید. تاریخ شروع/پایان، بازه را محدود می‌کند.
6. replay با اسلایدر و دکمه‌های اول/قبل/بعد/آخر حرکت می‌کند. در هر قدم همان موتور از نو فقط با کندل‌های تا همان لحظه اجرا می‌شود؛ pattern قبل از زمان تأیید واقعی خود نمایان نمی‌شود.
7. یافته‌ها و سناریوی دیده‌شده را با `ذخیره / JSON` خروجی بگیرید. نسخه‌ی اخیر در `localStorage` همان مرورگر هم ذخیره می‌شود؛ بین دستگاه‌ها sync نیست.

## موتور مشترک تحلیل

`client/src/lib/market-engine.ts` موتور pure مشترک LIVE، CSV و DEMO VALIDATION است. ساختار swing با pivot radius پیش‌فرض ۲، روند، BOS، CHoCH، FVG، Order Block، liquidity sweep، support/resistance، سناریو، invalidation و علت را می‌سازد. زمان رخداد و `confirmedAt` جدا هستند. replay تنها از پیشوند داده‌ی قابل‌مشاهده استفاده می‌کند. الگوریتم قاعده‌محور و ساده است، نه موتور جامع ICT یا مدل تضمین‌کننده‌ی سود.

## DEMO VALIDATION / MT5

- سناریوی BUY/SELL جاری را در دفتر محلی ثبت کنید. snapshot شامل زمان سیگنال، زمان تأیید آخرین trigger سازنده و زمان داده‌ی انتهایی، نماد/TF، جهت، وسط محدوده‌ی ورود، SL/TP و دلایل است. `NO TRADE` به‌عنوان معامله ثبت نمی‌شود.
- قیمت ورود MT5 و نتیجه را می‌توان دستی تنظیم کرد؛ اختلاف علامت‌دار برابر `suggestedEntry - MT5Open` است.
- فایل MT5 باید CSV با header باشد؛ comma/semicolon/tab پذیرفته می‌شود. header زمان و Open/Price لازم است؛ در export با دو header یکسان `Price`, قیمت دوم برای close در نظر گرفته می‌شود. زمان close هم در صورت وجود نگه‌داری می‌شود. تطبیق نماد/جهت/زمان را بازبینی کنید. ردیف نامنطبق هم وارد می‌شود. گزارش HTML یا اتصال مستقیم به terminal/account پشتیبانی نشده است.
- در صورت وجود ستون Profit، برچسب اولیه‌ی Win/Loss/Break-even از آن گرفته می‌شود؛ اگر close قیمت SL/TP ثبت‌شده را لمس/عبور کند دلیل سازگار نمایش داده می‌شود، نه اثبات قطعی اجرای stop/target. موارد مبهم به بازبینی انسانی نیاز دارند. دفتر را CSV صادر کنید؛ داده در `localStorage` همین مرورگر باقی می‌ماند.
- هیچ معامله‌ی واقعی/دمویی خودکار ارسال یا اجرا نمی‌شود. اتصال مستقیم MT5 در پیاده‌سازی فعلی نیست.

## Android / APK — هنوز ساخته نشده

Source wrapper Capacitor و پروژه‌ی `android/` در مخزن قرار دارند. هنگام build متغیر `PMI_APP_URL` باید origin عمومی HTTPS پایدار باشد تا WebView به وب/API وصل شود و کلید provider داخل APK نرود. Preview موقت را production فرض نکنید.

مسیر محلی به Android SDK روی رایانه نیاز دارد و این‌جا build نشده است. مسیر گوشی در راهنمای [`PHONE_ANDROID_BUILD.md`](PHONE_ANDROID_BUILD.md) و `.github/workflows/android-apk.yml` آماده است؛ workflow ریشه‌ی `package.json` را پیدا می‌کند یا ZIP تخت را باز می‌کند، اما تا اجرای موفق GitHub Actions APK تحویل‌شده محسوب نمی‌شود. هیچ اشتراک Capawesome لازم نیست.

فرمان آماده‌شده (پس از فراهم‌بودن پیش‌نیازها):

```bash
export ANDROID_HOME="$HOME/Android/sdk"
export PMI_APP_URL="https://your-stable-public-app-origin.example"
pnpm install --frozen-lockfile
pnpm android:apk
```

خروجی مورد انتظار `dist/apk/ProMarket-Intelligence-debug.apk` است، ولی **اکنون APK وجود ندارد و این فرمان در این Sandbox با موفقیت تأیید نشده است**. برای API 35 و Build Tools 35.0.0 نصب‌کننده‌ی رسمی قرارداد Android SDK را خواست؛ کاربر پذیرش را رد کرد و نصب متوقف شد. مجوز را نمی‌پذیریم و دور نمی‌زنیم. میزبان فعلی ARM64 است و زنجیره‌ی رسمی Google هم محدودیت باینری host دارد. تا فراهم‌شدن SDK مجاز در محیط واجدشرایط و build/sign/install verification، APK تحویل‌شده محسوب نمی‌شود.

## فایل‌های سورس کلیدی

- `client/src/pages/Home.tsx`: سه workspace اصلی.
- `client/src/features/MarketChart.tsx`: نمودار و overlay.
- `client/src/features/DemoValidation.tsx`: دفتر دمو، import/export MT5 CSV.
- `client/src/lib/market-engine.ts`: موتور مشترک causal.
- `client/src/lib/csv-market.ts`: parser، mapping و اعتبارسنجی CSV.
- `client/src/lib/demo-validation.ts`: تابع pure برای تفسیر محتاطانه‌ی خروج نسبت به سطوح پیشنهادی.
- `server/marketData.ts`: API خواندنی Twelve Data/Binance، secret فقط سمت سرور.
- `server/*test.ts`: آزمون parser، رویدادهای causal موتور، تفسیر محتاطانه‌ی نتیجه‌ی MT5 و template integration.
- `capacitor.config.ts`, `android/`: source و wrapper موبایل (APK هنوز تولید نشده).

## محدودیت و ایمنی

برنامه read-only است و به حساب بروکر/MT5 وصل نمی‌شود. قیمت provider می‌تواند با نرخ بروکر متفاوت باشد؛ اختلاف در DEMO VALIDATION فقط اندازه‌گیری می‌شود، نه اینکه feedها هم‌ارز فرض شوند. سناریو ابزار تصمیم قطعی یا توصیه‌ی مالی نیست و باید مستقل روی دمو اعتبارسنجی شود. Preview محیط توسعه است، SLA و ماندگاری deployment ندارد.

## ساخت APK فقط با گوشی

برای اجرای build در GitHub Actions از مرورگر گوشی، بدون نصب SDK یا Termux روی گوشی و بدون اشتراک Capawesome، راهنمای [PHONE_ANDROID_BUILD.md](PHONE_ANDROID_BUILD.md) و workflow آماده‌ی [.github/workflows/android-apk.yml](.github/workflows/android-apk.yml) را ببینید. **workflow هنوز در حساب GitHub اجرا نشده و APK تولیدشده‌ای وجود ندارد.** آدرس پایدار HTTPS برنامه نیز پیش‌نیاز build است؛ مراحل انتشار وب و تنظیم `PMI_APP_URL` در [DEPLOY.md](DEPLOY.md) آمده است.
