import "server-only";
import { getCompletedMonthKeys } from "@/lib/analysis";
import { createDemoHistory } from "@/lib/demoHistory";
import { mergeSales } from "@/lib/sales";
import type { SourcedSale } from "@/lib/sales";
import { normalizeTransactionBatch } from "./normalize";
import { fetchPayPalTransactions } from "./client";

export type MergedSalesData = {
  sales: SourcedSale[];
  leftOutCount: number;
  currencyLeftOutCount: number;
  transactionsRead: number;
  liveSalesCount: number;
  fetchedAt: string;
};

export async function loadMergedSales(
  now: Date = new Date(),
): Promise<MergedSalesData> {
  const [firstMonth] = getCompletedMonthKeys(now, 4);
  const startDate = new Date(`${firstMonth}-01T00:00:00.000Z`);
  const [demoTransactions, liveTransactions] = await Promise.all([
    Promise.resolve(createDemoHistory(now)),
    fetchPayPalTransactions(startDate, now),
  ]);
  const demoSales = normalizeTransactionBatch(demoTransactions).sales;
  const normalizedLive = normalizeTransactionBatch(liveTransactions);
  if (normalizedLive.leftOutCount > 0) {
    console.info("[api/sales] Excluded PayPal transaction counts:", {
      reasons: normalizedLive.leftOutReasons,
      eventCodes: normalizedLive.leftOutEventCodeCounts,
    });
  }
  const merged = mergeSales(
    demoSales,
    normalizedLive.sales,
    normalizedLive.leftOutCount,
  );
  const fetchedAt = new Date().toISOString();

  return {
    sales: merged.sales,
    leftOutCount: merged.leftOutCount,
    currencyLeftOutCount: merged.currencyLeftOutCount,
    transactionsRead: liveTransactions.length,
    liveSalesCount: merged.sales.filter((sale) => sale.source === "live").length,
    fetchedAt,
  };
}
