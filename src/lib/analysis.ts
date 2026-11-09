import type { Sale } from "./types";

export type MonthTotal = {
  month: string;
  totalCents: number;
  saleCount: number;
};

export type TrendRun = {
  direction: "rise" | "fall";
  startMonth: string;
  endMonth: string;
  changeCents: number;
};

export type ItemTotal = {
  name: string;
  totalCents: number;
};

export type ItemChange = {
  name: string;
  firstMonthCents: number;
  lastMonthCents: number;
  changeCents: number;
  changePercent: number | null;
};

export type SalesAnalysis = {
  startMonth: string;
  endMonth: string;
  monthTotals: MonthTotal[];
  totalCents: number;
  saleCount: number;
  averagePaymentCents: number | null;
  bestMonth: MonthTotal | null;
  bestMonthSharePercent: number | null;
  slowestMonth: MonthTotal | null;
  runs: TrendRun[];
  topItems: ItemTotal[];
  itemChanges: ItemChange[];
};

export type MonthRange = {
  startMonth: string;
  endMonth: string;
};

export function getMonthKey(date: Date | string): string {
  const value = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(value.getTime())) {
    throw new RangeError("The date is invalid.");
  }
  return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function getCompletedMonthKeys(
  today: Date = new Date(),
  count = 4,
): string[] {
  if (!Number.isInteger(count) || count < 1) {
    throw new RangeError("Month count must be a positive whole number.");
  }
  const lastCompletedMonth = Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth() - 1,
    1,
  );
  return Array.from({ length: count }, (_, index) => {
    const month = new Date(
      Date.UTC(
        new Date(lastCompletedMonth).getUTCFullYear(),
        new Date(lastCompletedMonth).getUTCMonth() - (count - index - 1),
        1,
      ),
    );
    return getMonthKey(month);
  });
}

export function formatMonth(month: string): string {
  const [year, monthNumber] = month.split("-").map(Number);
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(monthNumber) ||
    monthNumber < 1 ||
    monthNumber > 12
  ) {
    throw new RangeError("Month must be in YYYY-MM format.");
  }
  return new Intl.DateTimeFormat("en", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, monthNumber - 1, 1)));
}

export function formatNaturalPeriod(range: MonthRange): string {
  const [startYear, startMonth] = range.startMonth.split("-").map(Number);
  const [endYear, endMonth] = range.endMonth.split("-").map(Number);
  const start = new Intl.DateTimeFormat("en", {
    month: "long",
    ...(startYear !== endYear ? { year: "numeric" } : {}),
    timeZone: "UTC",
  }).format(new Date(Date.UTC(startYear, startMonth - 1, 1)));
  if (range.startMonth === range.endMonth) {
    return start;
  }
  const end = new Intl.DateTimeFormat("en", {
    month: "long",
    ...(startYear !== endYear ? { year: "numeric" } : {}),
    timeZone: "UTC",
  }).format(new Date(Date.UTC(endYear, endMonth - 1, 1)));
  return `${start} to ${end}`;
}

function monthKeysBetween(startMonth: string, endMonth: string): string[] {
  const [startYear, startNumber] = startMonth.split("-").map(Number);
  const [endYear, endNumber] = endMonth.split("-").map(Number);
  if (
    !Number.isInteger(startYear) ||
    !Number.isInteger(startNumber) ||
    !Number.isInteger(endYear) ||
    !Number.isInteger(endNumber) ||
    startNumber < 1 ||
    startNumber > 12 ||
    endNumber < 1 ||
    endNumber > 12 ||
    startMonth > endMonth
  ) {
    return [];
  }
  const result: string[] = [];
  for (
    let cursor = Date.UTC(startYear, startNumber - 1, 1);
    cursor <= Date.UTC(endYear, endNumber - 1, 1);
    cursor = Date.UTC(
      new Date(cursor).getUTCFullYear(),
      new Date(cursor).getUTCMonth() + 1,
      1,
    )
  ) {
    result.push(getMonthKey(new Date(cursor)));
  }
  return result;
}

export function getMonthKeysBetween(
  startMonth: string,
  endMonth: string,
): string[] {
  return monthKeysBetween(startMonth, endMonth);
}

function getTrendRuns(monthTotals: MonthTotal[]): TrendRun[] {
  const runs: TrendRun[] = [];
  let startIndex = 0;
  let direction: TrendRun["direction"] | null = null;
  for (let index = 1; index < monthTotals.length; index += 1) {
    const difference =
      monthTotals[index].totalCents - monthTotals[index - 1].totalCents;
    const nextDirection =
      difference > 0 ? "rise" : difference < 0 ? "fall" : null;
    if (nextDirection !== direction) {
      if (direction) {
        runs.push({
          direction,
          startMonth: monthTotals[startIndex].month,
          endMonth: monthTotals[index - 1].month,
          changeCents:
            monthTotals[index - 1].totalCents -
            monthTotals[startIndex].totalCents,
        });
      }
      startIndex = index - 1;
      direction = nextDirection;
    }
  }
  if (direction && monthTotals.length > 1) {
    const lastMonth = monthTotals[monthTotals.length - 1];
    runs.push({
      direction,
      startMonth: monthTotals[startIndex].month,
      endMonth: lastMonth.month,
      changeCents: lastMonth.totalCents - monthTotals[startIndex].totalCents,
    });
  }
  return runs;
}

export function analyzeSales(
  sales: Sale[],
  range: MonthRange,
  currency = sales.find((sale) => sale.status === "COMPLETED")?.currency ?? "USD",
): SalesAnalysis {
  const months = monthKeysBetween(range.startMonth, range.endMonth);
  const monthTotals = months.map((month) => ({
    month,
    totalCents: 0,
    saleCount: 0,
  }));
  const monthIndex = new Map(
    monthTotals.map((month, index) => [month.month, index]),
  );
  const itemTotals = new Map<string, number>();
  const itemMonthlyTotals = new Map<string, Map<string, number>>();
  let saleCount = 0;

  for (const sale of sales) {
    if (
      sale.status !== "COMPLETED" ||
      sale.currency !== currency ||
      !Number.isFinite(sale.amount) ||
      sale.amount <= 0
    ) {
      continue;
    }
    const index = monthIndex.get(getMonthKey(sale.date));
    if (index === undefined) {
      continue;
    }
    const cents = Math.round(sale.amount * 100);
    monthTotals[index].totalCents += cents;
    monthTotals[index].saleCount += 1;
    saleCount += 1;
    for (const name of new Set(sale.itemNames)) {
      itemTotals.set(name, (itemTotals.get(name) ?? 0) + cents);
      const monthly = itemMonthlyTotals.get(name) ?? new Map<string, number>();
      monthly.set(
        monthTotals[index].month,
        (monthly.get(monthTotals[index].month) ?? 0) + cents,
      );
      itemMonthlyTotals.set(name, monthly);
    }
  }

  const rankedItems = [...itemTotals.entries()]
    .map(([name, totalCents]) => ({ name, totalCents }))
    .sort(
      (left, right) =>
        right.totalCents - left.totalCents ||
        left.name.localeCompare(right.name),
    );
  const firstMonth = months[0];
  const lastMonth = months[months.length - 1];
  const itemChanges = [...itemMonthlyTotals.entries()]
    .map(([name, monthly]) => {
      const firstMonthCents = monthly.get(firstMonth) ?? 0;
      const lastMonthCents = monthly.get(lastMonth) ?? 0;
      const changeCents = lastMonthCents - firstMonthCents;
      return {
        name,
        firstMonthCents,
        lastMonthCents,
        changeCents,
        changePercent:
          firstMonthCents === 0
            ? null
            : Math.round((changeCents / firstMonthCents) * 100),
      };
    })
    .sort(
      (left, right) =>
        (right.changePercent ?? Number.NEGATIVE_INFINITY) -
        (left.changePercent ?? Number.NEGATIVE_INFINITY),
    );
  const populatedMonths = monthTotals.filter((month) => month.saleCount > 0);
  const totalCents = monthTotals.reduce(
    (sum, month) => sum + month.totalCents,
    0,
  );
  const bestMonth =
    populatedMonths.length > 0
      ? populatedMonths.reduce((best, month) =>
          month.totalCents > best.totalCents ? month : best,
        )
      : null;

  return {
    startMonth: range.startMonth,
    endMonth: range.endMonth,
    monthTotals,
    totalCents,
    saleCount,
    averagePaymentCents:
      saleCount > 0 ? Math.round(totalCents / saleCount) : null,
    bestMonth,
    bestMonthSharePercent:
      bestMonth && totalCents > 0
        ? Math.round((bestMonth.totalCents / totalCents) * 100)
        : null,
    slowestMonth:
      populatedMonths.length > 0
        ? populatedMonths.reduce((slowest, month) =>
            month.totalCents < slowest.totalCents ? month : slowest,
          )
        : null,
    runs: getTrendRuns(monthTotals),
    topItems: rankedItems.slice(0, 3),
    itemChanges,
  };
}

export { computeQuestionAnswer } from "./answerAnalysis";
export type {
  AnswerNumber,
  AnswerSentence,
  ComputedAnswer,
} from "./answerAnalysis";
