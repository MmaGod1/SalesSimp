import {
  analyzeSales,
  formatNaturalPeriod,
  getMonthKey,
  getMonthKeysBetween,
  type MonthRange,
} from "./analysis";
import type { ResolvedQuestion } from "./questions";
import type { Sale } from "./types";

export type AnswerNumber = {
  label: string;
  value: string;
};

export type AnswerSentence = {
  id: string;
  tone: "up" | "down" | "neutral";
  text: string;
  numbers: AnswerNumber[];
};

export type ComputedAnswer = {
  type: ResolvedQuestion["type"];
  range: MonthRange;
  periodLabel: string;
  naturalPeriod: string;
  currency: string;
  itemNames: string[];
  numbers: AnswerNumber[];
  sentences: AnswerSentence[];
};

function formatCurrency(cents: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

function formatPercent(change: number, base: number): string {
  return base === 0
    ? "not available"
    : `${Math.abs(Math.round((change / base) * 100))}%`;
}

function changePhrase(change: number, base: number, currency: string): string {
  if (change === 0) {
    return "stayed the same";
  }
  return `${change > 0 ? "rose" : "fell"} by ${formatCurrency(
    Math.abs(change),
    currency,
  )} (${formatPercent(Math.abs(change), base)})`;
}

function completedSalesInRange(
  sales: Sale[],
  range: MonthRange,
  currency: string,
): Sale[] {
  return sales.filter((sale) => {
    const month = getMonthKey(sale.date);
    return (
      sale.status === "COMPLETED" &&
      sale.currency === currency &&
      Number.isFinite(sale.amount) &&
      sale.amount > 0 &&
      month >= range.startMonth &&
      month <= range.endMonth
    );
  });
}

function totalCents(sales: Sale[]): number {
  return sales.reduce((sum, sale) => sum + Math.round(sale.amount * 100), 0);
}

function itemTotals(sales: Sale[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const sale of sales) {
    for (const name of new Set(sale.itemNames)) {
      totals.set(
        name,
        (totals.get(name) ?? 0) + Math.round(sale.amount * 100),
      );
    }
  }
  return totals;
}

function number(label: string, value: string): AnswerNumber {
  return { label, value };
}

function answer(
  question: ResolvedQuestion,
  currency: string,
  numbers: AnswerNumber[],
  sentences: AnswerSentence[],
  itemNames: string[] = question.item ? [question.item] : [],
): ComputedAnswer {
  return {
    type: question.type,
    range: question.range,
    periodLabel: question.periodLabel,
    naturalPeriod: formatNaturalPeriod(question.range),
    currency,
    itemNames,
    numbers,
    sentences: sentences.map((sentence) => ({
      ...sentence,
      text: sentence.text
        ? `${sentence.text[0].toLocaleUpperCase()}${sentence.text.slice(1)}`
        : sentence.text,
    })),
  };
}

function comparePeriods(
  sales: Sale[],
  question: ResolvedQuestion,
  currency: string,
): ComputedAnswer | null {
  const months = getMonthKeysBetween(
    question.range.startMonth,
    question.range.endMonth,
  );
  const comparison = question.comparison;
  if (!comparison && months.length < 2) {
    return null;
  }
  const split = Math.floor(months.length / 2);
  const firstRange = comparison?.a ?? {
    startMonth: months[0],
    endMonth: months[split - 1],
  };
  const secondRange = comparison?.b ?? {
    startMonth: months[split],
    endMonth: months[months.length - 1],
  };
  const firstSales = completedSalesInRange(sales, firstRange, currency);
  const secondSales = completedSalesInRange(sales, secondRange, currency);
  const firstTotal = totalCents(firstSales);
  const secondTotal = totalCents(secondSales);
  const change = secondTotal - firstTotal;
  const firstItems = itemTotals(firstSales);
  const secondItems = itemTotals(secondSales);
  const itemChanges = [...new Set([...firstItems.keys(), ...secondItems.keys()])]
    .map((name) => ({
      name,
      change: (secondItems.get(name) ?? 0) - (firstItems.get(name) ?? 0),
    }))
    .sort((left, right) => right.change - left.change);
  const biggestRise = itemChanges.find((item) => item.change > 0);
  const biggestFall = [...itemChanges].reverse().find((item) => item.change < 0);
  const comparisonNumbers = [
    number(
      formatNaturalPeriod(firstRange),
      formatCurrency(firstTotal, currency),
    ),
    number(
      formatNaturalPeriod(secondRange),
      formatCurrency(secondTotal, currency),
    ),
    number(
      "Change",
      formatCurrency(Math.abs(change), currency),
    ),
    number("Change percent", formatPercent(change, firstTotal)),
  ];
  const riseNumber = biggestRise
    ? number(
        `Largest item rise · ${biggestRise.name}`,
        `${formatCurrency(biggestRise.change, currency)} (${formatPercent(
          biggestRise.change,
          firstItems.get(biggestRise.name) ?? 0,
        )})`,
      )
    : null;
  const fallNumber = biggestFall
    ? number(
        `Largest item fall · ${biggestFall.name}`,
        `${formatCurrency(Math.abs(biggestFall.change), currency)} (${formatPercent(
          biggestFall.change,
          firstItems.get(biggestFall.name) ?? 0,
        )})`,
      )
    : null;
  const numbers = [
    ...comparisonNumbers,
    ...(riseNumber ? [riseNumber] : []),
    ...(fallNumber ? [fallNumber] : []),
  ];
  const sentences: AnswerSentence[] = [
    {
      id: "comparison",
      tone: change > 0 ? "up" : change < 0 ? "down" : "neutral",
      text: `${question.periodWasImplicit ? `From ${formatNaturalPeriod(question.range)}, ` : ""}sales ${changePhrase(change, firstTotal, currency)} when comparing ${formatNaturalPeriod(firstRange)} with ${formatNaturalPeriod(secondRange)}.`,
      numbers: comparisonNumbers,
    },
  ];
  if (biggestRise && riseNumber) {
    sentences.push({
      id: "item-rise",
      tone: "up",
      text: `${biggestRise.name} rose by ${riseNumber.value} between ${formatNaturalPeriod(firstRange)} and ${formatNaturalPeriod(secondRange)}.`,
      numbers: [riseNumber],
    });
  }
  if (biggestFall && fallNumber) {
    sentences.push({
      id: "item-fall",
      tone: "down",
      text: `${biggestFall.name} fell by ${fallNumber.value} between ${formatNaturalPeriod(firstRange)} and ${formatNaturalPeriod(secondRange)}.`,
      numbers: [fallNumber],
    });
  }
  return answer(
    question,
    currency,
    numbers,
    sentences,
    [biggestRise?.name, biggestFall?.name].filter(
      (name): name is string => Boolean(name),
    ),
  );
}

function bestWorstMonth(
  sales: Sale[],
  question: ResolvedQuestion,
  currency: string,
): ComputedAnswer {
  const totals = getMonthKeysBetween(
    question.range.startMonth,
    question.range.endMonth,
  ).map((month) => ({
    month,
    cents: totalCents(
      completedSalesInRange(
        sales,
        { startMonth: month, endMonth: month },
        currency,
      ),
    ),
  }));
  const populated = totals.filter((month) => month.cents > 0);
  const best = populated.reduce<(typeof populated)[number] | null>(
    (result, item) => (!result || item.cents > result.cents ? item : result),
    null,
  );
  const worst = populated.reduce<(typeof populated)[number] | null>(
    (result, item) => (!result || item.cents < result.cents ? item : result),
    null,
  );
  const numbers = [
    ...(best
      ? [
          number(
            `Best month · ${formatNaturalPeriod({ startMonth: best.month, endMonth: best.month })}`,
            formatCurrency(best.cents, currency),
          ),
        ]
      : []),
    ...(worst
      ? [
          number(
            `Slowest month · ${formatNaturalPeriod({ startMonth: worst.month, endMonth: worst.month })}`,
            formatCurrency(worst.cents, currency),
          ),
        ]
      : []),
  ];
  const sentences: AnswerSentence[] =
    best && worst
      ? best.month === worst.month
        ? [
            {
              id: "best-month",
              tone: "neutral",
              text: `${formatNaturalPeriod({ startMonth: best.month, endMonth: best.month })} was the best month, with ${formatCurrency(best.cents, currency)} in completed sales.`,
              numbers: numbers.slice(0, 1),
            },
          ]
        : [
            {
              id: "best-month",
              tone: "neutral",
              text: `${formatNaturalPeriod({ startMonth: best.month, endMonth: best.month })} was the best month, with ${formatCurrency(best.cents, currency)} in completed sales.`,
              numbers: numbers.slice(0, 1),
            },
            {
              id: "slowest-month",
              tone: "neutral",
              text: `${formatNaturalPeriod({ startMonth: worst.month, endMonth: worst.month })} was the slowest month, with ${formatCurrency(worst.cents, currency)} in completed sales.`,
              numbers: numbers.slice(1, 2),
            },
          ]
      : [
          {
            id: "best-worst",
            tone: "neutral",
            text: `There were no completed sales from ${formatNaturalPeriod(question.range)}.`,
            numbers: [],
          },
        ];
  return answer(question, currency, numbers, sentences);
}

function bestWorstWeek(
  sales: Sale[],
  question: ResolvedQuestion,
  currency: string,
): ComputedAnswer {
  const buckets = new Map<string, number>();
  const periodStart = new Date(`${question.range.startMonth}-01T00:00:00Z`);
  const endYear = Number(question.range.endMonth.slice(0, 4));
  const endMonth = Number(question.range.endMonth.slice(5, 7));
  const lastDay = new Date(Date.UTC(endYear, endMonth, 0)).getUTCDate();
  const periodEnd = new Date(
    `${question.range.endMonth}-${String(lastDay).padStart(2, "0")}T23:59:59.999Z`,
  );
  const firstMonday = new Date(periodStart);
  firstMonday.setUTCDate(
    firstMonday.getUTCDate() + ((8 - firstMonday.getUTCDay()) % 7),
  );
  const fullWeekStarts: string[] = [];
  for (
    const monday = new Date(firstMonday);
    monday.getTime() + 6 * 24 * 60 * 60 * 1000 <= periodEnd.getTime();
    monday.setUTCDate(monday.getUTCDate() + 7)
  ) {
    fullWeekStarts.push(monday.toISOString().slice(0, 10));
  }
  for (const sale of completedSalesInRange(sales, question.range, currency)) {
    const monday = new Date(sale.date);
    monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
    const key = monday.toISOString().slice(0, 10);
    if (fullWeekStarts.includes(key)) {
      buckets.set(key, (buckets.get(key) ?? 0) + Math.round(sale.amount * 100));
    }
  }
  const weeks = fullWeekStarts.map((weekStart) => ({
    weekStart,
    cents: buckets.get(weekStart) ?? 0,
  })).filter((week) => week.cents > 0);
  const best = weeks.reduce<(typeof weeks)[number] | null>(
    (result, week) => (!result || week.cents > result.cents ? week : result),
    null,
  );
  const worst = weeks.reduce<(typeof weeks)[number] | null>(
    (result, week) => (!result || week.cents < result.cents ? week : result),
    null,
  );
  const weekLabel = (weekStart: string) => {
    const monday = new Date(`${weekStart}T00:00:00Z`);
    const sunday = new Date(monday);
    sunday.setUTCDate(sunday.getUTCDate() + 6);
    const includeYear = monday.getUTCFullYear() !== sunday.getUTCFullYear();
    const display = (date: Date) =>
      new Intl.DateTimeFormat("en", {
        month: "short",
        day: "numeric",
        ...(includeYear ? { year: "numeric" } : {}),
        timeZone: "UTC",
      }).format(date);
    return `${display(monday)} to ${display(sunday)}`;
  };
  const numbers = [
    ...(best
      ? [
          number(
            `Best week · ${weekLabel(best.weekStart)}`,
            formatCurrency(best.cents, currency),
          ),
        ]
      : []),
    ...(worst
      ? [
          number(
            `Slowest week · ${weekLabel(worst.weekStart)}`,
            formatCurrency(worst.cents, currency),
          ),
        ]
      : []),
  ];
  const sentences: AnswerSentence[] =
    best && worst
      ? best.weekStart === worst.weekStart
        ? [
            {
              id: "best-week",
              tone: "neutral",
              text: `Your best week was ${weekLabel(best.weekStart)}, with ${formatCurrency(best.cents, currency)} in completed sales.`,
              numbers: numbers.slice(0, 1),
            },
          ]
        : fullWeekStarts.length === 0
          ? [
              {
                id: "no-full-weeks",
                tone: "neutral" as const,
                text: `There are no full Monday-to-Sunday weeks in ${formatNaturalPeriod(question.range)}.`,
                numbers: [],
              },
            ]
        : [
            {
              id: "best-week",
              tone: "neutral",
              text: `Your best week was ${weekLabel(best.weekStart)}, with ${formatCurrency(best.cents, currency)} in completed sales.`,
              numbers: numbers.slice(0, 1),
            },
            {
              id: "slowest-week",
              tone: "neutral",
              text: `Your slowest week was ${weekLabel(worst.weekStart)}, with ${formatCurrency(worst.cents, currency)} in completed sales.`,
              numbers: numbers.slice(1, 2),
            },
          ]
      : [
          {
            id: "best-worst-week",
            tone: "neutral",
            text: `There were no completed sales in a full Monday-to-Sunday week from ${formatNaturalPeriod(question.range)}.`,
            numbers: [],
          },
        ];
  return answer(question, currency, numbers, sentences);
}

function itemTrend(
  sales: Sale[],
  question: ResolvedQuestion,
  currency: string,
): ComputedAnswer | null {
  const itemName = question.item ?? "";
  const monthly = getMonthKeysBetween(
    question.range.startMonth,
    question.range.endMonth,
  ).map((month) => ({
    month,
    cents: totalCents(
      completedSalesInRange(
        sales.filter((sale) =>
          sale.itemNames.some(
            (name) => name.toLocaleLowerCase() === itemName.toLocaleLowerCase(),
          ),
        ),
        { startMonth: month, endMonth: month },
        currency,
      ),
    ),
  }));
  if (monthly.length < 2) {
    return null;
  }
  const first = monthly[0];
  const last = monthly[monthly.length - 1];
  const overallChange = last.cents - first.cents;
  const low = monthly.reduce((result, month) =>
    month.cents < result.cents ? month : result,
  );
  const high = monthly.reduce((result, month) =>
    month.cents > result.cents ? month : result,
  );
  const previous = monthly[monthly.length - 2];
  const latest = monthly[monthly.length - 1];
  const latestChange = latest.cents - previous.cents;
  const monthRange = (month: string): MonthRange => ({
    startMonth: month,
    endMonth: month,
  });
  const overallNumbers = [
    number(formatNaturalPeriod(monthRange(first.month)), formatCurrency(first.cents, currency)),
    number(formatNaturalPeriod(monthRange(last.month)), formatCurrency(last.cents, currency)),
    number(
      "Overall change",
      formatCurrency(Math.abs(overallChange), currency),
    ),
    number("Overall change percent", formatPercent(overallChange, first.cents)),
  ];
  const lowNumber = number(
    formatNaturalPeriod(monthRange(low.month)),
    formatCurrency(low.cents, currency),
  );
  const highNumber = number(
    formatNaturalPeriod(monthRange(high.month)),
    formatCurrency(high.cents, currency),
  );
  const latestNumbers = [
    number(formatNaturalPeriod(monthRange(previous.month)), formatCurrency(previous.cents, currency)),
    number(formatNaturalPeriod(monthRange(latest.month)), formatCurrency(latest.cents, currency)),
    number(
      "Latest month change",
      formatCurrency(Math.abs(latestChange), currency),
    ),
    number(
      "Latest month change percent",
      formatPercent(latestChange, previous.cents),
    ),
  ];
  const numbers = [...overallNumbers, lowNumber, highNumber, ...latestNumbers];
  const period = formatNaturalPeriod(question.range);
  const firstMonth = formatNaturalPeriod(monthRange(first.month));
  const lastMonth = formatNaturalPeriod(monthRange(last.month));
  const latestPercent =
    previous.cents === 0
      ? "not available"
      : `${Math.abs(Math.round((latestChange / previous.cents) * 100))}%`;
  const latestDescription =
    previous.cents === 0
      ? `${formatNaturalPeriod(monthRange(latest.month))} ${latestChange === 0 ? "stayed the same" : `${latestChange > 0 ? "rose" : "fell"} by ${formatCurrency(Math.abs(latestChange), currency)}`} from ${formatNaturalPeriod(monthRange(previous.month))}.`
      : `${formatNaturalPeriod(monthRange(latest.month))} ${latestChange === 0 ? "stayed the same" : `${latestChange > 0 ? "rose" : "fell"} by ${formatCurrency(Math.abs(latestChange), currency)} (${latestPercent})`} from ${formatNaturalPeriod(monthRange(previous.month))}.`;
  const sentences: AnswerSentence[] = [
    {
      id: "item-overall",
      tone: overallChange > 0 ? "up" : overallChange < 0 ? "down" : "neutral",
      text: question.periodWasImplicit
        ? `From ${period}, ${itemName} ${changePhrase(overallChange, first.cents, currency)}.`
        : `${itemName} ${changePhrase(overallChange, first.cents, currency)} from ${firstMonth} to ${lastMonth}.`,
      numbers: overallNumbers,
    },
    {
      id: "item-low",
      tone: "down",
      text: `${itemName} was lowest in ${formatNaturalPeriod(monthRange(low.month))}, at ${formatCurrency(low.cents, currency)}.`,
      numbers: [lowNumber],
    },
    {
      id: "item-high",
      tone: "up",
      text: `${itemName} was highest in ${formatNaturalPeriod(monthRange(high.month))}, at ${formatCurrency(high.cents, currency)}.`,
      numbers: [highNumber],
    },
    {
      id: "item-latest",
      tone: latestChange > 0 ? "up" : latestChange < 0 ? "down" : "neutral",
      text: latestDescription,
      numbers: latestNumbers,
    },
  ];
  return answer(question, currency, numbers, sentences, [itemName]);
}

function totals(
  sales: Sale[],
  question: ResolvedQuestion,
  currency: string,
): ComputedAnswer | null {
  const analysis = analyzeSales(sales, question.range, currency);
  const period = formatNaturalPeriod(question.range);
  const totalNumber = number(
    "Completed sales",
    formatCurrency(analysis.totalCents, currency),
  );
  const paymentNumber = number("Payments", String(analysis.saleCount));
  const averageNumber =
    analysis.averagePaymentCents === null
      ? null
      : number(
          "Average payment",
          formatCurrency(analysis.averagePaymentCents, currency),
        );
  const bestMonthName = analysis.bestMonth
    ? formatNaturalPeriod({
        startMonth: analysis.bestMonth.month,
        endMonth: analysis.bestMonth.month,
      })
    : null;
  const bestMonthNumber =
    analysis.bestMonth && bestMonthName
      ? number(
          `Best month · ${bestMonthName}`,
          formatCurrency(analysis.bestMonth.totalCents, currency),
        )
      : null;
  const bestShareNumber =
    analysis.bestMonthSharePercent === null
      ? null
      : number("Best month share", `${analysis.bestMonthSharePercent}%`);
  const numbers: AnswerNumber[] = [
    totalNumber,
    paymentNumber,
    ...(averageNumber ? [averageNumber] : []),
    ...(bestMonthNumber ? [bestMonthNumber] : []),
    ...(bestShareNumber ? [bestShareNumber] : []),
  ];
  const sentences: AnswerSentence[] = [
    {
      id: "total-sales",
      tone: "neutral",
      text: `Completed sales from ${period} totaled ${formatCurrency(analysis.totalCents, currency)}.`,
      numbers: [totalNumber],
    },
    {
      id: "payment-count",
      tone: "neutral",
      text: `${analysis.saleCount} ${
        analysis.saleCount === 1 ? "payment" : "payments"
      } were completed from ${period}.`,
      numbers: [paymentNumber],
    },
  ];
  if (analysis.averagePaymentCents !== null && averageNumber) {
    sentences.push({
      id: "average-payment",
      tone: "neutral",
      text: `The average payment was ${formatCurrency(
        analysis.averagePaymentCents,
        currency,
      )}.`,
      numbers: [averageNumber],
    });
  }
  if (analysis.bestMonth && bestMonthName && bestMonthNumber && bestShareNumber) {
    sentences.push({
      id: "best-month",
      tone: "neutral",
      text: `${bestMonthName} was the best month, with ${formatCurrency(
        analysis.bestMonth.totalCents,
        currency,
      )} in sales.`,
      numbers: [bestMonthNumber],
    });
    sentences.push({
      id: "best-month-share",
      tone: "neutral",
      text: `${bestMonthName} contributed ${bestShareNumber.value} of sales from ${period}.`,
      numbers: [bestShareNumber],
    });
  }
  return answer(question, currency, numbers, sentences);
}

function whatChanged(
  sales: Sale[],
  question: ResolvedQuestion,
  currency: string,
): ComputedAnswer {
  const previousMonth = {
    startMonth: question.range.startMonth,
    endMonth: question.range.startMonth,
  };
  const targetMonth = {
    startMonth: question.range.endMonth,
    endMonth: question.range.endMonth,
  };
  const previousSales = completedSalesInRange(sales, previousMonth, currency);
  const targetSales = completedSalesInRange(sales, targetMonth, currency);
  const previousTotal = totalCents(previousSales);
  const targetTotal = totalCents(targetSales);
  const totalChange = targetTotal - previousTotal;
  const previousItems = itemTotals(previousSales);
  const targetItems = itemTotals(targetSales);
  const changes = [...new Set([...previousItems.keys(), ...targetItems.keys()])]
    .map((name) => ({
      name,
      change: (targetItems.get(name) ?? 0) - (previousItems.get(name) ?? 0),
    }))
    .filter(({ change }) => change !== 0)
    .sort((left, right) => Math.abs(right.change) - Math.abs(left.change));
  const largestRise = changes.find(({ change }) => change > 0);
  const largestFall = changes.find(({ change }) => change < 0);
  const totalNumber = number(
    "Total change",
    formatCurrency(Math.abs(totalChange), currency),
  );
  const previousNumber = number(
    formatNaturalPeriod(previousMonth),
    formatCurrency(previousTotal, currency),
  );
  const targetNumber = number(
    formatNaturalPeriod(targetMonth),
    formatCurrency(targetTotal, currency),
  );
  const changeNumbers = [previousNumber, targetNumber, totalNumber];
  const itemNumbers = (item: { name: string; change: number }) => [
    number(
      `${item.name} change`,
      formatCurrency(Math.abs(item.change), currency),
    ),
    number(
      "Share of net change",
      totalChange === 0
        ? "not available"
        : `${Math.abs(Math.round((item.change / totalChange) * 100))}%`,
    ),
  ];
  const sentences: AnswerSentence[] = [
    {
      id: "what-changed-total",
      tone: totalChange > 0 ? "up" : totalChange < 0 ? "down" : "neutral",
      text: `I can see what changed in your sales, but not why: sales ${
        totalChange === 0
          ? "stayed the same"
          : `${totalChange > 0 ? "rose" : "fell"} by ${formatCurrency(
              Math.abs(totalChange),
              currency,
            )}`
      } from ${formatNaturalPeriod(previousMonth)} to ${formatNaturalPeriod(targetMonth)}.`,
      numbers: changeNumbers,
    },
  ];
  const appendItemChange = (
    item: { name: string; change: number } | undefined,
  ) => {
    if (!item) {
      return;
    }
    const sameDirection = totalChange !== 0 && Math.sign(item.change) === Math.sign(totalChange);
    const relation = sameDirection ? "contributing to" : "offsetting";
    const share = totalChange === 0
      ? "with its share not available because total sales did not change"
      : `${itemNumbers(item)[1]!.value} of the net change`;
    sentences.push({
      id: `what-changed-${item.change > 0 ? "rise" : "fall"}`,
      tone: item.change > 0 ? "up" : "down",
      text: `${item.name} ${item.change > 0 ? "rose" : "fell"} by ${formatCurrency(
        Math.abs(item.change),
        currency,
      )}, ${relation} ${share}.`,
      numbers: itemNumbers(item),
    });
  };
  appendItemChange(largestRise);
  appendItemChange(largestFall);
  return answer(
    question,
    currency,
    [...changeNumbers, ...changes.slice(0, 2).flatMap(itemNumbers)],
    sentences,
    changes.slice(0, 2).map(({ name }) => name),
  );
}

export function computeQuestionAnswer(
  sales: Sale[],
  question: ResolvedQuestion,
  currency = sales.find((sale) => sale.status === "COMPLETED")?.currency ?? "USD",
): ComputedAnswer | null {
  switch (question.type) {
    case "compare_periods":
      return comparePeriods(sales, question, currency);
    case "best_worst_period":
      return question.granularity === "week"
        ? bestWorstWeek(sales, question, currency)
        : bestWorstMonth(sales, question, currency);
    case "item_trend":
      return itemTrend(sales, question, currency);
    case "totals":
      return totals(sales, question, currency);
    case "what_changed":
      return whatChanged(sales, question, currency);
    default:
      return null;
  }
}
