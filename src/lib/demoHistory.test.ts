import { describe, expect, it } from "vitest";
import { createDemoHistory } from "./demoHistory";

describe("createDemoHistory", () => {
  it("creates deterministic sales for the four completed months before today", () => {
    const today = new Date("2026-11-03T12:00:00Z");
    const first = createDemoHistory(today);
    const second = createDemoHistory(today);

    expect(first).toEqual(second);
    expect(first).toHaveLength(64);
    expect(
      [...new Set(first.map((sale) => sale.transaction_info?.transaction_initiation_date?.slice(0, 7)))],
    ).toEqual(["2026-07", "2026-08", "2026-09", "2026-10"]);
    expect(
      first.every(
        (sale) =>
          sale.transaction_info?.transaction_event_code === "T0006" &&
          sale.transaction_info.transaction_status === "S" &&
          sale.transaction_info.transaction_amount?.currency_code === "USD",
      ),
    ).toBe(true);
  });
});
