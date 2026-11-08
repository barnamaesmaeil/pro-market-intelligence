export function inferOutcomeReason(
  direction: "BUY" | "SELL",
  close: number,
  stop?: number,
  targets: number[] = []
): string {
  if (!Number.isFinite(close)) {
    return "علت خروج نامعلوم است: قیمت خروج معتبر در دسترس نیست.";
  }
  const stopHit =
    stop !== undefined &&
    Number.isFinite(stop) &&
    (direction === "BUY" ? close <= stop : close >= stop);
  if (stopHit) {
    return `قیمت خروج ${close} با حد ضرر ثبت‌شده ${stop} سازگار است؛ از CSV به‌تنهایی نمی‌توان علت یا قیمت اجرای قطعی را اثبات کرد.`;
  }
  const hitTargets = targets
    .filter(
      target =>
        Number.isFinite(target) &&
        (direction === "BUY" ? close >= target : close <= target)
    )
    .sort((a, b) => (direction === "BUY" ? a - b : b - a));
  if (hitTargets.length) {
    return `قیمت خروج ${close} به/از هدف ${hitTargets[0]} عبور کرده است؛ این فقط با رسیدن به هدف سازگار است و علت اجرای قطعی را ثابت نمی‌کند.`;
  }
  return `قیمت خروج ${close} با حد ضرر یا اهداف ثبت‌شده تطبیق آشکار ندارد؛ علت دقیق از داده‌ی واردشده قابل تشخیص نیست.`;
}
