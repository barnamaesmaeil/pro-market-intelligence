import { describe, expect, it } from "vitest";
import { inferOutcomeReason } from "../client/src/lib/demo-validation";

describe("MT5 demo outcome inference", () => {
  it("reports a close price consistent with a BUY stop without claiming proof", () => {
    const reason = inferOutcomeReason("BUY", 98, 99, [102, 105]);
    expect(reason).toContain("حد ضرر");
    expect(reason).toContain("نمی‌توان");
  });
  it("infers a SELL target reached from the close price", () => {
    expect(inferOutcomeReason("SELL", 94, 105, [98, 95])).toContain("هدف 98");
  });
  it("does not invent a reason when prices do not locate a proposed level", () => {
    expect(inferOutcomeReason("BUY", 101, 95, [105])).toContain(
      "قابل تشخیص نیست"
    );
  });
});
