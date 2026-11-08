# راهنمای انتشار برنامه وب — پیش‌نیاز ساخت APK

APK یک پوسته‌ی WebView دور نسخه‌ی وب است. workflow ساخت APK تا وقتی برنامه‌ی وب روی یک آدرس **HTTPS پایدار** منتشر نشده باشد و متغیر مخزن `PMI_APP_URL` تنظیم نشده باشد، عمداً متوقف می‌شود (بررسی سلامت `/` و `/api/health`). این راهنمای کوتاه‌ترین مسیر انتشار است.

## مسیر پیشنهادی: Railway

Railway هم‌زمان سرویس Node و دیتابیس MySQL می‌دهد، Dockerfile این مخزن را خودش می‌سازد و نیازی به کارت اعتباری برای شروع ندارد:

- پلن آزمایشی: **۳۰ روز با ۵ دلار اعتبار یک‌باره، بدون کارت**
- پس از آن پلن Free با سهم مصرف کوچک ماهانه یا پلن Hobby (~۵ دلار در ماه)

> جزئیات پلن‌ها ممکن است تغییر کند؛ قبل از ثبت‌نام صفحه‌ی [railway.com/pricing](https://railway.com/pricing) را ببینید.

### گام ۱ — ساخت سرویس وب

1. در [railway.app](https://railway.app) با حساب GitHub وارد شوید.
2. **New Project → Deploy from GitHub repo** را بزنید و مخزن `pro-market-intelligence-app` را انتخاب کنید (دسترسی Railway به مخزن را تأیید کنید).
3. Railway فایل `Dockerfile` را تشخیص می‌دهد و build می‌گیرد. کانفیگ `railway.json` همین مخزن healthcheck `/api/health` و سیاست راه‌اندازی مجدد را فعال می‌کند.

### گام ۲ — دیتابیس MySQL

1. داخل همان پروژه: **New → Database → MySQL**.
2. سرویس وب را باز کنید → تب **Variables** → متغیر جدید:
   - نام: `DATABASE_URL`
   - مقدار: `${{MySQL.MYSQL_URL}}` (ارجاع به دیتابیس Railway)
3. جداول هنوز ساخته نشده‌اند؛ گام بعدی این را حل می‌کند.

### گام ۳ — اجرای مهاجرت‌ها هنگام استارت

فایل `railway.json` همین مخزن، فرمان استارت را از قبل تنظیم کرده است تا اول جداول ساخته شوند (`drizzle/migrations`) و بعد سرور بالا بیاید:

```bash
pnpm db:migrate && node dist/index.js
```

اگر Railway این فرمان را اعمال نکرد، همان را دستی در **Settings → Deploy → Custom Start Command** قرار دهید.

### گام ۴ — دامنه‌ی عمومی

سرویس وب → **Settings → Networking → Generate Domain**. آدرسی مثل `https://pro-market-intelligence-app-production.up.railway.app` می‌گیرید. برنامه به متغیر `PORT` که Railway تزریق می‌کند گوش می‌دهد.

### گام ۵ — متغیرهای اختیاری

| متغیر | لازم؟ | کاربرد |
|---|---|---|
| `DATABASE_URL` | ✅ لازم | اتصال MySQL (گام ۲) |
| `TWELVE_DATA_API_KEY` | اختیاری | داده‌ی زنده‌ی طلا/فارکس؛ فقط سمت سرور. کریپتو از Binance بدون کلید کار می‌کند. |
| `NODE_ENV` / `PORT` | خودکار | در Dockerfile تنظیم شده / توسط Railway تزریق می‌شود |

### گام ۶ — تست سلامت

آدرس `https://<دامنه-شما>/api/health` را باز کنید؛ باید `{"status":"ok"}` ببینید و صفحه‌ی اصلی برنامه باز شود. **این دامنه را نگه دارید** — APK به همین آدرس وصل می‌شود.

## تنظیم گیت‌هاب و ساخت APK

1. در GitHub: **Settings → Secrets and variables → Actions → تب Variables → New repository variable**
   - نام: `PMI_APP_URL`
   - مقدار: همان دامنه‌ی Railway (با `https://`، بدون مسیر و اسلش انتها)
2. تب **Actions** → «Build Pro Market Intelligence APK» → **Run workflow** → برنچ `main`
3. پس از ✓ سبز (۱۰–۱۵ دقیقه)، صفحه‌ی run → بخش **Artifacts** → دانلود `Pro-Market-Intelligence-debug-apk`
4. ZIP را استخراج و APK را نصب کنید (اجازه‌ی «نصب از منابع ناشناس» لازم است). آرتیفکت ۷ روز نگه داشته می‌شود.

راهنمای کامل‌تر ساخت روی گوشی: [PHONE_ANDROID_BUILD.md](PHONE_ANDROID_BUILD.md)

## نکته‌ها و محدودیت‌ها

- دامنه‌ی Railway در پلن آزمایشی پایدار است، اما اگر سرویس حذف/متوقف شود APK بی‌سرور می‌ماند؛ برای استفاده‌ی دائمی، سرویس را فعال نگه دارید.
- کلید Twelve Data را فقط به‌عنوان متغیر محیطی در Railway و Secret در GitHub نگه دارید؛ هرگز در سورس، مرورگر یا داخل APK قرار نگیرد (workflow هم این را بررسی می‌کند).
- برنامه read-only است، به بروکر وصل نمی‌شود و سیگنال آن توصیه‌ی مالی نیست.
