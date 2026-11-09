import { describe, expect, it } from "vitest";
import {
  analyzeSales,
  formatNaturalPeriod,
  getCompletedMonthKeys,
} from "./analysis";
import { createDemoHistory } from "./demoHistory";
import { normalizeTransactions } from "./paypal/normalize";

describe("sales analysis", () => {
  const today = new Date("2026-11-03T12:00:00Z");
  const sales = normalizeTransactions(createDemoHistory(today));

  it("includes only the last four completed months and calculates totals in cents", () => {
    expect(getCompletedMonthKeys(today)).toEqual([
      "2026-07",
      "2026-08",
      "2026-09",
      "2026-10",
    ]);

    const analysis = analyzeSales(sales, {
      startMonth: "2026-07",
      endMonth: "2026-10",
    });

    expect(analysis.monthTotals.map((month) => month.totalCents)).toEqual([
      107300,
      139700,
      99200,
      155200,
    ]);
    expect(analysis.monthTotals.map((month) => month.saleCount)).toEqual([
      16, 16, 16, 16,
    ]);
    expect(analysis.bestMonth?.month).toBe("2026-10");
    expect(analysis.averagePaymentCents).toBe(7834);
    expect(analysis.bestMonthSharePercent).toBe(31);
    expect(analysis.slowestMonth?.month).toBe("2026-09");
    expect(analysis.runs).toEqual([
      {
        direction: "rise",
        startMonth: "2026-07",
        endMonth: "2026-08",
        changeCents: 32400,
      },
      {
        direction: "fall",
        startMonth: "2026-08",
        endMonth: "2026-09",
        changeCents: -40500,
      },
      {
        direction: "rise",
        startMonth: "2026-09",
        endMonth: "2026-10",
        changeCents: 56000,
      },
    ]);
  });

  it("ranks top items and reports changes from the first to last selected month", () => {
    const analysis = analyzeSales(sales, {
      startMonth: "2026-07",
      endMonth: "2026-10",
    });

    expect(analysis.topItems[0]).toEqual({
      name: "Ankara dress",
      totalCents: 121500,
    });
    expect(analysis.itemChanges.find((item) => item.name === "Ankara dress"))
      .toMatchObject({
        firstMonthCents: 22500,
        lastMonthCents: 54000,
        changePercent: 140,
      });
    expect(analysis.itemChanges.find((item) => item.name === "Silk scarf"))
      .toMatchObject({
        firstMonthCents: 12000,
        lastMonthCents: 3000,
        changePercent: -75,
      });
  });

  it("ignores incomplete months, non-completed sales, and non-USD sales", () => {
    const extraSales = [
      ...sales,
      {
        id: "current-month",
        date: "2026-11-03T12:00:00Z",
        amount: 999,
        currency: "USD",
        status: "COMPLETED",
        itemNames: ["Ankara dress"],
      },
      {
        id: "pending",
        date: "2026-10-12T12:00:00Z",
        amount: 999,
        currency: "USD",
        status: "PENDING",
        itemNames: ["Ankara dress"],
      },
      {
        id: "eur",
        date: "2026-10-12T12:00:00Z",
        amount: 999,
        currency: "EUR",
        status: "COMPLETED",
        itemNames: ["Ankara dress"],
      },
    ];

    const analysis = analyzeSales(extraSales, {
      startMonth: "2026-07",
      endMonth: "2026-10",
    });

    expect(analysis.totalCents).toBe(501400);
    expect(analysis.saleCount).toBe(64);
  });

  it("uses natural period wording and returns no average for an empty period", () => {
    expect(
      formatNaturalPeriod({ startMonth: "2026-07", endMonth: "2026-10" }),
    ).toBe("July to October");
    expect(
      formatNaturalPeriod({ startMonth: "2025-11", endMonth: "2026-01" }),
    ).toBe("November 2025 to January 2026");

    const empty = analyzeSales([], {
      startMonth: "2026-07",
      endMonth: "2026-10",
    });
    expect(empty.averagePaymentCents).toBeNull();
    expect(empty.bestMonthSharePercent).toBeNull();
  });
});
