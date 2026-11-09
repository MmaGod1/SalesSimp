import { getMonthKey } from "./analysis";
import type { Sale } from "./types";

export type SourcedSale = Sale & {
  source: "demo" | "live";
};

export type SalesMergeResult = {
  sales: SourcedSale[];
  currency: string;
  leftOutCount: number;
  currencyLeftOutCount: number;
};

export type CurrentMonthPayment = {
  date: string;
  amountCents: number;
  itemNames: string[];
};

export type CurrentMonthSummary = {
  month: string;
  totalCents: number;
  paymentCount: number;
  payments: CurrentMonthPayment[];
};

export function formatLeftOutMessage(
  leftOutCount: number,
  currencyLeftOutCount: number,
): string {
  if (
    !Number.isInteger(leftOutCount) ||
    !Number.isInteger(currencyLeftOutCount) ||
    leftOutCount < 0 ||
    currencyLeftOutCount < 0 ||
    currencyLeftOutCount > leftOutCount
  ) {
    throw new RangeError("Left-out counts must be non-negative whole numbers.");
  }

  const incompleteCount = leftOutCount - currencyLeftOutCount;
  if (currencyLeftOutCount === 0) {
    return leftOutCount === 1
      ? "1 payment was left out because it wasn't a completed sale."
      : `${leftOutCount} payments were left out because they weren't completed sales.`;
  }

  const leftOutNoun = leftOutCount === 1 ? "payment was" : "payments were";
  const details = [
    ...(incompleteCount > 0
      ? [
          incompleteCount === 1
            ? "1 was not a completed sale"
            : `${incompleteCount} were not completed sales`,
        ]
      : []),
    currencyLeftOutCount === 1
      ? "1 used another currency"
      : `${currencyLeftOutCount} used another currency`,
  ];
  return `${leftOutCount} ${leftOutNoun} left out: ${details.join(" and ")}.`;
}

function mostCommonCurrency(sales: Sale[]): string {
  const counts = new Map<string, number>();
  for (const sale of sales) {
    counts.set(sale.currency, (counts.get(sale.currency) ?? 0) + 1);
  }

  return [...counts.entries()].sort(
    ([currencyA, countA], [currencyB, countB]) =>
      countB - countA || currencyA.localeCompare(currencyB),
  )[0]?.[0] ?? "USD";
}

export function mergeSales(
  demoSales: Sale[],
  liveSales: Sale[],
  leftOutCount = 0,
): SalesMergeResult {
  if (!Number.isInteger(leftOutCount) || leftOutCount < 0) {
    throw new RangeError("Left-out count must be a non-negative whole number.");
  }

  const currency =
    demoSales.find((sale) => sale.currency)?.currency ??
    mostCommonCurrency(liveSales);
  const keptLiveSales = liveSales.filter((sale) => sale.currency === currency);
  const currencyLeftOutCount = liveSales.length - keptLiveSales.length;

  return {
    currency,
    leftOutCount: leftOutCount + currencyLeftOutCount,
    currencyLeftOutCount,
    sales: [
      ...demoSales
        .filter((sale) => sale.currency === currency)
        .map((sale) => ({ ...sale, source: "demo" as const })),
      ...keptLiveSales.map((sale) => ({ ...sale, source: "live" as const })),
    ],
  };
}

export function getCurrentMonthSummary(
  sales: Sale[],
  today: Date,
): CurrentMonthSummary {
  if (Number.isNaN(today.getTime())) {
    throw new RangeError("The current date is invalid.");
  }

  const month = getMonthKey(today);
  const payments = sales
    .filter(
      (sale) =>
        sale.status === "COMPLETED" &&
        getMonthKey(sale.date) === month &&
        Number.isFinite(sale.amount) &&
        sale.amount > 0,
    )
    .map((sale) => ({
      date: sale.date,
      amountCents: Math.round(sale.amount * 100),
      itemNames: [...new Set(sale.itemNames)],
    }));

  return {
    month,
    totalCents: payments.reduce((total, payment) => total + payment.amountCents, 0),
    paymentCount: payments.length,
    payments,
  };
}
