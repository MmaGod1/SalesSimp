import {
  analyzeSales,
  formatMonth,
  type MonthRange,
  type SalesAnalysis,
} from "./analysis";
import type { Sale } from "./types";
import type { CurrentMonthSummary } from "./sales";

export type StoryNumber = {
  label: string;
  value: string;
};

export type StorySentence = {
  id: string;
  tone: "up" | "down" | "neutral";
  text: string;
  numbers: StoryNumber[];
  countUpPercent?: number;
};

export type SalesStory = {
  period: string;
  message: string | null;
  sentences: StorySentence[];
};

function currency(cents: number, currencyCode: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currencyCode,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

function periodLabel(range: MonthRange): string {
  if (!range.startMonth || !range.endMonth || range.startMonth > range.endMonth) {
    return "Choose a month range";
  }
  return `${formatMonth(range.startMonth)} to ${formatMonth(range.endMonth)}`;
}

function asNumber(
  label: string,
  cents: number,
  currencyCode: string,
): StoryNumber {
  return { label, value: currency(cents, currencyCode) };
}

function buildSentences(
  analysis: SalesAnalysis,
  currencyCode: string,
): StorySentence[] {
  const first = analysis.monthTotals[0];
  const last = analysis.monthTotals[analysis.monthTotals.length - 1];
  const includeYear = analysis.startMonth.slice(0, 4) !== analysis.endMonth.slice(0, 4);
  const monthName = (month: string) => {
    const formatted = formatMonth(month);
    return includeYear ? formatted : formatted.replace(/ \d{4}$/, "");
  };
  const overallChange = last.totalCents - first.totalCents;
  const overallPercent =
    first.totalCents === 0
      ? null
      : Math.round((overallChange / first.totalCents) * 100);
  const dip = analysis.runs.find((run) => run.direction === "fall");
  const recovery =
    dip &&
    analysis.runs.find(
      (run) => run.direction === "rise" && run.startMonth >= dip.endMonth,
    );
  const sentences: StorySentence[] = [
    {
      id: "overall",
      tone: overallChange >= 0 ? "up" : "down",
      text:
        overallPercent === null
          ? `Sales ${overallChange >= 0 ? "rose" : "fell"} over this period.`
          : `Sales ${overallChange >= 0 ? "grew" : "eased"} overall by ${Math.abs(overallPercent)}% from ${monthName(first.month)} to ${monthName(last.month)}.`,
      numbers: [
        asNumber(monthName(first.month), first.totalCents, currencyCode),
        asNumber(monthName(last.month), last.totalCents, currencyCode),
        asNumber(
          "Change",
          Math.abs(overallChange),
          currencyCode,
        ),
      ],
      ...(overallPercent === null
        ? {}
        : { countUpPercent: Math.abs(overallPercent) }),
    },
  ];

  if (dip) {
    sentences.push({
      id: "movement",
      tone: recovery ? "down" : "neutral",
      text: recovery
        ? `After a dip in ${monthName(dip.endMonth)}, sales picked up again in ${monthName(recovery.endMonth)}.`
        : `Sales dipped between ${monthName(dip.startMonth)} and ${monthName(dip.endMonth)}.`,
      numbers: analysis.monthTotals.map((month) =>
        asNumber(monthName(month.month), month.totalCents, currencyCode),
      ),
    });
  } else {
    sentences.push({
      id: "movement",
      tone: "neutral",
      text: "Sales moved steadily across the months in this period.",
      numbers: analysis.monthTotals.map((month) =>
        asNumber(monthName(month.month), month.totalCents, currencyCode),
      ),
    });
  }

  if (analysis.bestMonth && analysis.slowestMonth) {
    sentences.push({
      id: "months",
      tone: "neutral",
      text:
        analysis.bestMonth.month === analysis.slowestMonth.month
          ? `${monthName(analysis.bestMonth.month)} had the same total at both ends of the range.`
          : `${monthName(analysis.bestMonth.month)} was your strongest month, while ${monthName(analysis.slowestMonth.month)} was the slowest.`,
      numbers: [
        asNumber(
          `Strongest · ${monthName(analysis.bestMonth.month)}`,
          analysis.bestMonth.totalCents,
          currencyCode,
        ),
        asNumber(
          `Slowest · ${monthName(analysis.slowestMonth.month)}`,
          analysis.slowestMonth.totalCents,
          currencyCode,
        ),
      ],
    });
  }

  if (analysis.topItems[0]) {
    sentences.push({
      id: "top-item",
      tone: "neutral",
      text: `${analysis.topItems[0].name} brought in the most sales across this period.`,
      numbers: analysis.topItems.map((item) =>
        asNumber(item.name, item.totalCents, currencyCode),
      ),
    });
  }

  const risingItem = [...analysis.itemChanges]
    .filter((item) => item.changePercent !== null && item.changePercent > 0)
    .sort((left, right) => (right.changePercent ?? 0) - (left.changePercent ?? 0))[0];
  const fadingItem = [...analysis.itemChanges]
    .filter((item) => item.changePercent !== null && item.changePercent < 0)
    .sort((left, right) => (left.changePercent ?? 0) - (right.changePercent ?? 0))[0];

  if (risingItem) {
    sentences.push({
      id: "rising-item",
      tone: "up",
      text: `${risingItem.name} rose strongly between ${monthName(first.month)} and ${monthName(last.month)}.`,
      numbers: [
        asNumber(monthName(first.month), risingItem.firstMonthCents, currencyCode),
        asNumber(monthName(last.month), risingItem.lastMonthCents, currencyCode),
        {
          label: "Change",
          value: `+${risingItem.changePercent}%`,
        },
      ],
    });
  }

  if (fadingItem) {
    sentences.push({
      id: "fading-item",
      tone: "down",
      text: `${fadingItem.name} brought in less at the end of the period than at the start.`,
      numbers: [
        asNumber(monthName(first.month), fadingItem.firstMonthCents, currencyCode),
        asNumber(monthName(last.month), fadingItem.lastMonthCents, currencyCode),
        {
          label: "Change",
          value: `${fadingItem.changePercent}%`,
        },
      ],
    });
  }

  return sentences;
}

export function createSalesStory(
  sales: Sale[],
  range: MonthRange,
  currencyCode = sales.find((sale) => sale.status === "COMPLETED")?.currency ?? "USD",
  currentMonth: CurrentMonthSummary | null = null,
): SalesStory {
  const period = periodLabel(range);
  const analysis = analyzeSales(sales, range, currencyCode);
  const populatedMonths = analysis.monthTotals.filter(
    (month) => month.saleCount > 0,
  );

  let message: string | null = null;
  let sentences: StorySentence[] = [];

  if (analysis.saleCount === 0) {
    message =
      "There were no completed sales in this period. Try choosing a wider month range.";
  } else if (populatedMonths.length < 2) {
    message =
      "There is not enough completed-month history for a useful story yet. Try choosing a wider month range.";
  } else {
    sentences = buildSentences(analysis, currencyCode);
  }

  if (currentMonth && currentMonth.paymentCount > 0) {
    const monthName = formatMonth(currentMonth.month);
    const paymentLabel =
      currentMonth.paymentCount === 1 ? "payment" : "payments";
    sentences.push({
      id: "current-month",
      tone: "neutral",
      text: `${monthName} so far: ${currency(currentMonth.totalCents, currencyCode)} from ${currentMonth.paymentCount} ${paymentLabel}. These sales are not included in completed-month comparisons.`,
      numbers: currentMonth.payments.map((payment) => ({
        label: `${new Intl.DateTimeFormat("en", {
          month: "short",
          day: "numeric",
          timeZone: "UTC",
        }).format(new Date(payment.date))} · ${payment.itemNames.join(", ") || "Payment"}`,
        value: currency(payment.amountCents, currencyCode),
      })),
    });
  }

  return {
    period,
    message,
    sentences,
  };
}
