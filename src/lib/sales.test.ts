import { describe, expect, it } from "vitest";
import {
  formatLeftOutMessage,
  getCurrentMonthSummary,
  mergeSales,
} from "./sales";
import type { Sale } from "./types";

function sale(
  id: string,
  date: string,
  amount: number,
  currency = "USD",
  itemNames = ["Ankara dress"],
  status = "COMPLETED",
): Sale {
  return { id, date, amount, currency, status, itemNames };
}

describe("mergeSales", () => {
  it("marks demo and live sources and counts excluded and other-currency payments", () => {
    const result = mergeSales(
      [sale("demo", "2026-07-01T12:00:00Z", 50)],
      [
        sale("live", "2026-11-02T12:00:00Z", 45),
        sale("foreign", "2026-11-03T12:00:00Z", 20, "EUR"),
      ],
      2,
    );

    expect(result.currency).toBe("USD");
    expect(result.sales.map(({ source }) => source)).toEqual(["demo", "live"]);
    expect(result.leftOutCount).toBe(3);
    expect(result.currencyLeftOutCount).toBe(1);
  });
});

describe("formatLeftOutMessage", () => {
  it("uses singular wording for one incomplete payment", () => {
    expect(formatLeftOutMessage(1, 0)).toBe(
      "1 payment was left out because it wasn't a completed sale.",
    );
  });

  it("uses plural wording for multiple incomplete payments", () => {
    expect(formatLeftOutMessage(3, 0)).toBe(
      "3 payments were left out because they weren't completed sales.",
    );
  });
});

describe("getCurrentMonthSummary", () => {
  it("summarizes only completed payments in the current month", () => {
    const summary = getCurrentMonthSummary(
      [
        sale("nov-1", "2026-11-02T12:00:00Z", 45),
        sale("nov-2", "2026-11-03T12:00:00Z", 25, "USD", ["Linen shirt"]),
        sale("oct", "2026-10-30T12:00:00Z", 100),
        sale("pending", "2026-11-04T12:00:00Z", 90, "USD", [], "PENDING"),
      ],
      new Date("2026-11-10T12:00:00Z"),
    );

    expect(summary).toEqual({
      month: "2026-11",
      totalCents: 7000,
      paymentCount: 2,
      payments: [
        {
          date: "2026-11-02T12:00:00Z",
          amountCents: 4500,
          itemNames: ["Ankara dress"],
        },
        {
          date: "2026-11-03T12:00:00Z",
          amountCents: 2500,
          itemNames: ["Linen shirt"],
        },
      ],
    });
  });
});
