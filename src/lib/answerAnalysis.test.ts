import { describe, expect, it } from "vitest";
import { computeQuestionAnswer } from "./analysis";
import type { ResolvedQuestion } from "./questions";
import type { Sale } from "./types";

describe("question answer calculations", () => {
  const knownSales: Sale[] = [
    {
      id: "dress-jul",
      date: "2026-07-06T12:00:00Z",
      amount: 100,
      currency: "USD",
      status: "COMPLETED",
      itemNames: ["Ankara dress"],
    },
    {
      id: "shirt-aug",
      date: "2026-08-12T12:00:00Z",
      amount: 50,
      currency: "USD",
      status: "COMPLETED",
      itemNames: ["Linen shirt"],
    },
    {
      id: "dress-sep",
      date: "2026-09-10T12:00:00Z",
      amount: 150,
      currency: "USD",
      status: "COMPLETED",
      itemNames: ["Ankara dress"],
    },
    {
      id: "shirt-oct",
      date: "2026-10-28T12:00:00Z",
      amount: 25,
      currency: "USD",
      status: "COMPLETED",
      itemNames: ["Linen shirt"],
    },
  ];
  const range = { startMonth: "2026-07", endMonth: "2026-10" };
  const question = (
    type: ResolvedQuestion["type"],
    extras: Partial<ResolvedQuestion> = {},
  ): ResolvedQuestion => ({
    question: "Analyze this period",
    type,
    range,
    periodWasImplicit: false,
    periodLabel: "July 2026 to October 2026",
    granularity: "month",
    ...extras,
  });

  it("calculates a two-part comparison and largest item rises and falls", () => {
    const result = computeQuestionAnswer(
      knownSales,
      question("compare_periods"),
    );
    expect(result?.numbers.map(({ value }) => value)).toEqual([
      "$150.00",
      "$175.00",
      "$25.00",
      "17%",
      "$50.00 (50%)",
      "$25.00 (50%)",
    ]);
  });

  it("uses unsigned figures with directional wording for falls and no change", () => {
    const falling = computeQuestionAnswer(
      knownSales,
      question("compare_periods", {
        range: { startMonth: "2026-09", endMonth: "2026-10" },
        comparison: {
          a: { startMonth: "2026-09", endMonth: "2026-09" },
          b: { startMonth: "2026-10", endMonth: "2026-10" },
        },
      }),
    );
    expect(falling?.sentences[0].text).toContain("Sales fell by $125.00 (83%)");
    expect(falling?.sentences[0].text).not.toContain("-");
    expect(falling?.numbers[2].value).toBe("$125.00");
    expect(falling?.numbers[3].value).toBe("83%");

    const unchangedSales = [
      { ...knownSales[0], amount: 100 },
      { ...knownSales[1], amount: 100 },
    ];
    const unchanged = computeQuestionAnswer(
      unchangedSales,
      question("compare_periods", {
        range: { startMonth: "2026-07", endMonth: "2026-08" },
        comparison: {
          a: { startMonth: "2026-07", endMonth: "2026-07" },
          b: { startMonth: "2026-08", endMonth: "2026-08" },
        },
      }),
    );
    expect(unchanged?.sentences[0].text).toContain("Sales stayed the same");
    expect(unchanged?.sentences[0].text).not.toContain("changed by");
  });

  it("finds the best and slowest completed month and calendar week", () => {
    const monthly = computeQuestionAnswer(
      knownSales,
      question("best_worst_period"),
    );
    expect(monthly?.numbers.map(({ value }) => value)).toEqual([
      "$150.00",
      "$25.00",
    ]);
    expect(monthly?.sentences[0].text[0]).toBe(
      monthly?.sentences[0].text[0].toLocaleUpperCase(),
    );
    expect(monthly?.sentences[0].text).not.toContain("July to October:");

    const weekly = computeQuestionAnswer(
      knownSales,
      question("best_worst_period", {
        granularity: "week",
        question: "What was my best week?",
      }),
    );
    expect(weekly?.numbers.map(({ value }) => value)).toEqual([
      "$150.00",
      "$50.00",
    ]);
    expect(weekly?.sentences[0].text).toBe(
      "Your best week was Sep 7 to Sep 13, with $150.00 in completed sales.",
    );
    expect(weekly?.sentences[1].text).toBe(
      "Your slowest week was Aug 10 to Aug 16, with $50.00 in completed sales.",
    );
  });

  it("excludes partial weeks at both ends of a selected period", () => {
    const boundarySales: Sale[] = [
      {
        id: "partial-start",
        date: "2026-07-01T12:00:00Z",
        amount: 1000,
        currency: "USD",
        status: "COMPLETED",
        itemNames: ["Linen shirt"],
      },
      {
        id: "full-week-high",
        date: "2026-07-06T12:00:00Z",
        amount: 100,
        currency: "USD",
        status: "COMPLETED",
        itemNames: ["Linen shirt"],
      },
      {
        id: "full-week-low",
        date: "2026-08-12T12:00:00Z",
        amount: 50,
        currency: "USD",
        status: "COMPLETED",
        itemNames: ["Linen shirt"],
      },
      {
        id: "partial-end",
        date: "2026-08-31T12:00:00Z",
        amount: 900,
        currency: "USD",
        status: "COMPLETED",
        itemNames: ["Linen shirt"],
      },
    ];
    const result = computeQuestionAnswer(
      boundarySales,
      question("best_worst_period", {
        range: { startMonth: "2026-07", endMonth: "2026-08" },
        granularity: "week",
      }),
    );
    expect(result?.numbers.map(({ value }) => value)).toEqual([
      "$100.00",
      "$50.00",
    ]);
    expect(result?.sentences.map(({ text }) => text)).toEqual([
      "Your best week was Jul 6 to Jul 12, with $100.00 in completed sales.",
      "Your slowest week was Aug 10 to Aug 16, with $50.00 in completed sales.",
    ]);
  });

  it("computes an item's monthly trend and total sales", () => {
    const trend = computeQuestionAnswer(
      knownSales,
      question("item_trend", { item: "Ankara dress" }),
    );
    expect(trend?.numbers.map(({ value }) => value)).toEqual([
      "$100.00",
      "$0.00",
      "$100.00",
      "100%",
      "$0.00",
      "$150.00",
      "$150.00",
      "$0.00",
      "$150.00",
      "100%",
    ]);

    const total = computeQuestionAnswer(knownSales, question("totals"));
    expect(total?.numbers.map(({ value }) => value)).toEqual([
      "$325.00",
      "4",
      "$81.25",
      "$150.00",
      "46%",
    ]);
    expect(total?.naturalPeriod).toBe("July to October");
    expect(total?.sentences.map(({ id }) => id)).toEqual([
      "total-sales",
      "payment-count",
      "average-payment",
      "best-month",
      "best-month-share",
    ]);
    expect(total?.sentences.map(({ numbers }) => numbers.length)).toEqual([
      1, 1, 1, 1, 1,
    ]);
    expect(
      total?.sentences.map((sentence) => sentence.numbers[0].value),
    ).toEqual(["$325.00", "4", "$81.25", "$150.00", "46%"]);
  });

  it("reports an item's middle-month dip and latest month recovery distinctly", () => {
    const dipSales: Sale[] = [
      {
        id: "aug",
        date: "2026-08-12T12:00:00Z",
        amount: 315,
        currency: "USD",
        status: "COMPLETED",
        itemNames: ["Ankara dress"],
      },
      {
        id: "sep",
        date: "2026-09-12T12:00:00Z",
        amount: 135,
        currency: "USD",
        status: "COMPLETED",
        itemNames: ["Ankara dress"],
      },
      {
        id: "oct",
        date: "2026-10-12T12:00:00Z",
        amount: 540,
        currency: "USD",
        status: "COMPLETED",
        itemNames: ["Ankara dress"],
      },
    ];
    const result = computeQuestionAnswer(
      dipSales,
      question("item_trend", {
        item: "Ankara dress",
        range: { startMonth: "2026-08", endMonth: "2026-10" },
        periodLabel: "August to October",
        periodWasImplicit: true,
      }),
    );

    expect(result?.sentences.map(({ id }) => id)).toEqual([
      "item-overall",
      "item-low",
      "item-high",
      "item-latest",
    ]);
    expect(result?.sentences[0].text).toBe(
      "From August to October, Ankara dress rose by $225.00 (71%).",
    );
    expect(result?.sentences[0].text.match(/August to October/g)).toHaveLength(1);
    expect(result?.sentences[1].text).toContain("lowest in September");
    expect(result?.sentences[1].text).toContain("$135.00");
    expect(result?.sentences[2].text).toContain("highest in October");
    expect(result?.sentences[2].text).toContain("$540.00");
    expect(result?.sentences[3].text).toContain("rose by $405.00 (300%)");
    expect(result?.sentences.every(({ numbers }) => numbers.length > 0)).toBe(true);
  });

  it("reports the biggest item changes without claiming why they happened", () => {
    const result = computeQuestionAnswer(
      knownSales,
      question("what_changed", {
        range: { startMonth: "2026-08", endMonth: "2026-09" },
        periodLabel: "August to September",
      }),
    );

    expect(result?.numbers.map(({ value }) => value)).toEqual([
      "$50.00",
      "$150.00",
      "$100.00",
      "$150.00",
      "150%",
      "$50.00",
      "50%",
    ]);
    expect(result?.sentences.map(({ text }) => text)).toEqual([
      "I can see what changed in your sales, but not why: sales rose by $100.00 from August to September.",
      "Ankara dress rose by $150.00, contributing to 150% of the net change.",
      "Linen shirt fell by $50.00, offsetting 50% of the net change.",
    ]);
    expect(result?.sentences.map(({ text }) => text).join(" ")).not.toMatch(
      /\bbecause\b|\bcaused by\b/i,
    );
    expect(result?.sentences.every(({ numbers }) => numbers.length > 0)).toBe(
      true,
    );
  });
});
