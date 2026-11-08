# منابع فنی

این فهرست مستندات مرجع فنی استفاده‌شده در پیاده‌سازی Pro Market Intelligence را ثبت می‌کند. دسترس‌پذیری سرویس‌ها، سهمیه‌ی API و سازگاری build ممکن است تغییر کند؛ هر منبع در زمان استفاده باید دوباره بررسی شود.

## بازار

- [Twelve Data API Documentation](https://twelvedata.com/docs) — مرجع REST سری زمانی؛ endpoint زنده از `time_series` برای فارکس/فلزات استفاده می‌کند. آزمون شبکه‌ی این پروژه در 2026-10-09 برای `XAU/USD` و `EUR/USD` موفق شد.
- [Twelve Data Commodities](https://twelvedata.com/commodities) — توضیح provider درباره‌ی داده‌ی کالا و نماد واقعی `XAU/USD`; پوشش plan وابسته به حساب و بازار است.
- [Binance Spot REST API — Kline/Candlestick data](https://developers.binance.com/docs/binance-spot-api-docs/rest-api/market-data-endpoints) — مرجع endpoint عمومی OHLCV/klines؛ این پیاده‌سازی آن را فقط برای جفت‌های Spot کریپتو فراخوانی می‌کند، نه برای قیمت طلا.

## Android wrapper/build

- [Android developer tools](https://developer.android.com/tools) — نیازمندی‌های ابزارهای رسمی توسعه Android.
- [Android AAPT2](https://developer.android.com/tools/aapt2) — نقش Android Asset Packaging Tool در build.
- [Android Gradle Plugin release notes](https://developer.android.com/build/releases/gradle-plugin) — سازگاری نسخه‌های AGP/Gradle.
- [Capacitor Android](https://capacitorjs.com/docs/android) — مراحل project sync و native build.
- [Android issue 227219818](https://issuetracker.google.com/issues/227219818) — سابقه‌ی پشتیبانی host arm64 در ابزارهای Android.
- [Building Android apps on Asahi Linux](https://ignacio.tech/blog/building-android-apps-on-asahi-linux/) — یادداشت ثالث درباره‌ی محدودیت‌های AAPT2/host در Linux ARM64؛ منبع رسمی Google نیست.

**وضعیت این مخزن:** wrapper Capacitor sync شده است؛ SDK license توسط کاربر پذیرفته نشد و APK نهایی ساخته/نصب/آزمایش نشده است. فهرست URLها این وضعیت را تغییر نمی‌دهد.
