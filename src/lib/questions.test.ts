import { describe, expect, it } from "vitest";
import { validateQuestionIntent } from "./questions";

const context = {
  today: new Date("2026-11-04T12:00:00Z"),
  availableMonths: ["2026-07", "2026-08", "2026-09", "2026-10"],
  itemNames: ["Ankara dress", "Linen shirt", "Silk scarf"],
};

describe("validateQuestionIntent", () => {
  it("accepts a valid JSON intent and canonicalizes item names case-insensitively", () => {
    const result = validateQuestionIntent(
      "  How did the dress do?  ",
      JSON.stringify({
        type: "item_trend",
        period: { startMonth: "2026-07", endMonth: "2026-10" },
        item: "ankara DRESS",
      }),
      context,
    );

    expect(result).toMatchObject({
      supported: true,
      question: {
        question: "How did the dress do?",
        item: "Ankara dress",
        periodLabel: "July to October",
      },
    });
  });

  it("rejects malformed or extra JSON fields", () => {
    expect(
      validateQuestionIntent("Totals?", "{nope", context).supported,
    ).toBe(false);
    expect(
      validateQuestionIntent(
        "Totals?",
        { type: "totals", period: "last_3_months", extra: true },
        context,
      ).supported,
    ).toBe(false);
  });

  it("marks unknown items and periods outside available data unsupported", () => {
    expect(
      validateQuestionIntent(
        "How did item X do?",
        {
          type: "item_trend",
          period: "last_3_months",
          item: "Unknown item",
        },
        context,
      ),
    ).toMatchObject({ supported: false });
    expect(
      validateQuestionIntent(
        "How were sales in June 2026?",
        {
          type: "totals",
          period: { startMonth: "2026-06", endMonth: "2026-10" },
        },
        context,
      ),
    ).toMatchObject({ supported: false });
  });

  it("resolves relative periods against fixed today and available completed months", () => {
    expect(
      validateQuestionIntent(
        "Last month totals",
        { type: "totals", period: "last_month" },
        context,
      ),
    ).toMatchObject({
      supported: true,
      question: { range: { startMonth: "2026-10", endMonth: "2026-10" } },
    });
    expect(
      validateQuestionIntent(
        "Compare sales in the last 3 months.",
        { type: "compare_periods", period: "last_3_months" },
        context,
      ),
    ).toMatchObject({
      supported: true,
      question: { range: { startMonth: "2026-08", endMonth: "2026-10" } },
    });
    expect(
      validateQuestionIntent(
        "Year totals",
        { type: "totals", period: "this_year" },
        context,
      ),
    ).toMatchObject({
      supported: true,
      question: { range: { startMonth: "2026-07", endMonth: "2026-10" } },
    });
  });

  it("resolves named, explicit, and relative comparison phrasings", () => {
    const phrasings = [
      {
        question: "Compare September with October.",
        periodA: "2026-09",
        periodB: "2026-10",
      },
      {
        question: "Compare September vs October.",
        periodA: "September",
        periodB: "October",
      },
      {
        question: "Compare 2026-09 with 2026-10.",
        periodA: "2026-09",
        periodB: "2026-10",
      },
      {
        question: "Compare last month with the month before.",
        periodA: "last_month",
        periodB: "month_before_last",
      },
    ];

    for (const { question, periodA, periodB } of phrasings) {
      const result = validateQuestionIntent(
        question,
        { type: "compare_periods", periodA, periodB },
        context,
      );
      const expectedA =
        question === "Compare last month with the month before."
          ? { startMonth: "2026-10", endMonth: "2026-10" }
          : { startMonth: "2026-09", endMonth: "2026-09" };
      const expectedB =
        question === "Compare last month with the month before."
          ? { startMonth: "2026-09", endMonth: "2026-09" }
          : { startMonth: "2026-10", endMonth: "2026-10" };
      expect(result).toMatchObject({
        supported: true,
        question: {
          comparison: {
            a: expectedA,
            b: expectedB,
          },
        },
      });
    }
  });

  it("returns specific unsupported reasons for unavailable comparison periods", () => {
    expect(
      validateQuestionIntent(
        "Compare September 2025 with October 2026.",
        {
          type: "compare_periods",
          periodA: "2025-09",
          periodB: "2026-10",
        },
        context,
      ),
    ).toMatchObject({
      supported: false,
      reason: "Comparison period A is outside available sales data.",
    });
    expect(
      validateQuestionIntent(
        "Compare this year with last year.",
        {
          type: "compare_periods",
          periodA: "this_year",
          periodB: "last_year",
        },
        context,
      ),
    ).toMatchObject({
      supported: false,
      reason: "Last year is not fully covered by the available sales data.",
    });
  });

  it("accepts year comparisons only when all required completed months are covered", () => {
    const fullYearContext = {
      ...context,
      availableMonths: [
        ...Array.from({ length: 12 }, (_, index) =>
          `2025-${String(index + 1).padStart(2, "0")}`,
        ),
        ...Array.from({ length: 10 }, (_, index) =>
          `2026-${String(index + 1).padStart(2, "0")}`,
        ),
      ],
    };
    expect(
      validateQuestionIntent(
        "Compare this year with last year.",
        {
          type: "compare_periods",
          periodA: "this_year",
          periodB: "last_year",
        },
        fullYearContext,
      ),
    ).toMatchObject({
      supported: true,
      question: {
        comparison: {
          a: { startMonth: "2026-01", endMonth: "2026-10" },
          b: { startMonth: "2025-01", endMonth: "2025-12" },
        },
      },
    });
  });

  it("uses every available completed month when no period is named", () => {
    const result = validateQuestionIntent(
      "What were my totals?",
      { type: "totals", period: "last_3_months" },
      context,
    );
    expect(result).toMatchObject({
      supported: true,
      question: {
        range: { startMonth: "2026-07", endMonth: "2026-10" },
        periodWasImplicit: true,
      },
    });
  });

  it("trims and caps questions at 300 characters", () => {
    const result = validateQuestionIntent(
      `  ${"a".repeat(350)}  `,
      { type: "totals", period: "last_3_months" },
      context,
    );

    expect(result.supported).toBe(true);
    if (result.supported) {
      expect(result.question.question).toHaveLength(300);
    }
  });
});
