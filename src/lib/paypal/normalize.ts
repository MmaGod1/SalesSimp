import type { PayPalTransaction, Sale } from "../types";

const RECEIVED_PAYMENT_EVENT_CODES = new Set(["T0006"]);

export type NormalizationResult = {
  sales: Sale[];
  leftOutCount: number;
  leftOutReasons: Record<LeftOutReason, number>;
  leftOutEventCodeCounts: Record<string, number>;
};

export type LeftOutReason =
  | "invalid_date"
  | "not_successful"
  | "not_received_payment_event"
  | "invalid_currency"
  | "invalid_amount";

export function normalizeTransactionBatch(
  transactions: PayPalTransaction[],
): NormalizationResult {
  const sales: Sale[] = [];
  const leftOutReasons: NormalizationResult["leftOutReasons"] = {
    invalid_date: 0,
    not_successful: 0,
    not_received_payment_event: 0,
    invalid_currency: 0,
    invalid_amount: 0,
  };
  const leftOutEventCodeCounts: Record<string, number> = {};

  transactions.forEach((transaction, index) => {
    const info = transaction.transaction_info;
    const amount = Number(info?.transaction_amount?.value);
    const date = info?.transaction_initiation_date;
    const currency = info?.transaction_amount?.currency_code;
    let reason: LeftOutReason | null = null;

    if (!date || Number.isNaN(Date.parse(date))) {
      reason = "invalid_date";
    } else if (info?.transaction_status !== "S") {
      reason = "not_successful";
    } else if (
      !info.transaction_event_code ||
      !RECEIVED_PAYMENT_EVENT_CODES.has(info.transaction_event_code)
    ) {
      reason = "not_received_payment_event";
    } else if (!currency || !/^[A-Z]{3}$/.test(currency)) {
      reason = "invalid_currency";
    } else if (!Number.isFinite(amount) || amount <= 0) {
      reason = "invalid_amount";
    }

    if (reason !== null || !info || !date || !currency) {
      const exclusionReason = reason ?? "invalid_date";
      leftOutReasons[exclusionReason] += 1;
      if (exclusionReason === "not_received_payment_event") {
        const code = info?.transaction_event_code;
        const safeCode =
          code && /^[A-Z0-9]{5}$/.test(code) ? code : "unknown";
        leftOutEventCodeCounts[safeCode] =
          (leftOutEventCodeCounts[safeCode] ?? 0) + 1;
      }
      return;
    }

    const itemNames =
      transaction.cart_info?.item_details
        ?.map((item) => item.item_name?.trim())
        .filter((name): name is string => Boolean(name)) ?? [];

    sales.push({
      id: info.transaction_id ?? `live-${index + 1}`,
      date,
      amount,
      currency,
      status: "COMPLETED",
      itemNames,
    });
  });

  return {
    sales,
    leftOutCount: transactions.length - sales.length,
    leftOutReasons,
    leftOutEventCodeCounts,
  };
}

export function normalizeTransactions(transactions: PayPalTransaction[]): Sale[] {
  return normalizeTransactionBatch(transactions).sales;
}
