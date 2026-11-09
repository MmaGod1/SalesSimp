import { getMonthKey, getMonthKeysBetween } from "./analysis";
import { computeQuestionAnswer } from "./answerAnalysis";
import type { QuestionIntent, QuestionValidationContext } from "./questions";
import { validateQuestionIntent } from "./questions";
import type { Sale } from "./types";

export type AskExample = {
  question: string;
  intent: QuestionIntent;
};

function monthName(month: string, includeYear: boolean): string {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("en", {
    month: "long",
    ...(includeYear ? { year: "numeric" } : {}),
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, monthNumber - 1, 1)));
}

export function buildAskExamples(sales: Sale[], today: Date): AskExample[] {
  const currency =
    sales.find((sale) => sale.status === "COMPLETED")?.currency ?? "USD";
  const monthsWithSales = [
    ...new Set(
      sales
        .filter(
          (sale) =>
            sale.status === "COMPLETED" &&
            sale.currency === currency &&
            sale.amount > 0 &&
            getMonthKey(sale.date) < getMonthKey(today),
        )
        .map((sale) => getMonthKey(sale.date)),
    ),
  ].sort();
  if (monthsWithSales.length === 0) {
    return [];
  }
  const availableMonths = getMonthKeysBetween(
    monthsWithSales[0],
    monthsWithSales[monthsWithSales.length - 1],
  );
  const context: QuestionValidationContext = {
    today,
    availableMonths,
    itemNames: [
      ...new Set(
        sales
          .filter(
            (sale) =>
              sale.status === "COMPLETED" &&
              sale.currency === currency &&
              sale.amount > 0,
          )
          .flatMap((sale) => sale.itemNames)
          .filter(Boolean),
      ),
    ],
  };
  const items = context.itemNames;
  const lastThree = availableMonths.slice(-3);
  const lastTwo = availableMonths.slice(-2);
  const examples: AskExample[] = [];

  if (lastThree.length === 3) {
    examples.push({
      question: "Which month was my best?",
      intent: { type: "best_worst_period", period: "last_3_months" },
    });
    if (items[0]) {
      examples.push({
        question: `How did ${items[0]} do over the last 3 months?`,
        intent: {
          type: "item_trend",
          period: "last_3_months",
          item: items[0],
        },
      });
    }
  }

  if (lastTwo.length === 2) {
    const sameYear =
      lastTwo[0].slice(0, 4) === lastTwo[1].slice(0, 4);
    examples.push({
      question: `Compare ${monthName(lastTwo[0], !sameYear)} with ${monthName(lastTwo[1], !sameYear)}.`,
      intent: {
        type: "compare_periods",
        period: { startMonth: lastTwo[0], endMonth: lastTwo[1] },
      },
    });
  }

  if (
    availableMonths.some((month) =>
      month.startsWith(`${today.getUTCFullYear()}-`),
    )
  ) {
    examples.push({
      question: "What were my total sales this year?",
      intent: { type: "totals", period: "this_year" },
    });
  }

  if (lastTwo.length === 2) {
    const latestMonth = lastTwo[lastTwo.length - 1]!;
    examples.push({
      question: `What changed in ${monthName(latestMonth, false)}?`,
      intent: { type: "what_changed", period: latestMonth },
    });
  }

  return examples.filter((example) => {
    const validation = validateQuestionIntent(
      example.question,
      example.intent,
      context,
    );
    return (
      validation.supported &&
      computeQuestionAnswer(sales, validation.question, currency) !== null
    );
  });
}
