import {
  analyzeSales,
  formatMonth,
  type MonthRange,
  type SalesAnalysis,
} from "./analysis";
import type { Sale } from "./types";

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

function currency(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

function periodLabel(range: MonthRange): string {
  if (!range.startMonth || !range.endMonth || range.startMonth > range.endMonth) {
    return "Choose a month range";
  }
  return `${formatMonth(range.startMonth)} to ${formatMonth(range.endMonth)}`;
}

function asNumber(label: string, cents: number): StoryNumber {
  return { label, value: currency(cents) };
}

function buildSentences(analysis: SalesAnalysis): StorySentence[] {
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
        asNumber(monthName(first.month), first.totalCents),
        asNumber(monthName(last.month), last.totalCents),
        asNumber(
          "Change",
          Math.abs(overallChange),
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
        asNumber(monthName(month.month), month.totalCents),
      ),
    });
  } else {
    sentences.push({
      id: "movement",
      tone: "neutral",
      text: "Sales moved steadily across the months in this period.",
      numbers: analysis.monthTotals.map((month) =>
        asNumber(monthName(month.month), month.totalCents),
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
        ),
        asNumber(
          `Slowest · ${monthName(analysis.slowestMonth.month)}`,
          analysis.slowestMonth.totalCents,
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
        asNumber(item.name, item.totalCents),
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
        asNumber(monthName(first.month), risingItem.firstMonthCents),
        asNumber(monthName(last.month), risingItem.lastMonthCents),
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
        asNumber(monthName(first.month), fadingItem.firstMonthCents),
        asNumber(monthName(last.month), fadingItem.lastMonthCents),
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
): SalesStory {
  const period = periodLabel(range);
  const analysis = analyzeSales(sales, range);
  const populatedMonths = analysis.monthTotals.filter(
    (month) => month.saleCount > 0,
  );

  if (analysis.saleCount === 0) {
    return {
      period,
      message:
        "There were no completed sales in this period. Try choosing a wider month range.",
      sentences: [],
    };
  }

  if (populatedMonths.length < 2) {
    return {
      period,
      message:
        "There is not enough completed-month history for a useful story yet. Try choosing a wider month range.",
      sentences: [],
    };
  }

  return {
    period,
    message: null,
    sentences: buildSentences(analysis),
  };
}
