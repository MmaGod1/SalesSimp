import type { PayPalTransaction, Sale } from "../types";

const RECEIVED_PAYMENT_EVENT_CODES = new Set(["T0006"]);

export function normalizeTransactions(
  transactions: PayPalTransaction[],
): Sale[] {
  return transactions.flatMap((transaction) => {
    const info = transaction.transaction_info;
    const amount = Number(info?.transaction_amount?.value);
    const date = info?.transaction_initiation_date;

    if (
      !info?.transaction_id ||
      !date ||
      Number.isNaN(Date.parse(date)) ||
      info.transaction_status !== "S" ||
      !info.transaction_event_code ||
      !RECEIVED_PAYMENT_EVENT_CODES.has(info.transaction_event_code) ||
      info.transaction_amount?.currency_code !== "USD" ||
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      return [];
    }

    const itemNames =
      transaction.cart_info?.item_details
        ?.map((item) => item.item_name?.trim())
        .filter((name): name is string => Boolean(name)) ?? [];

    return [
      {
        id: info.transaction_id,
        date,
        amount,
        currency: "USD",
        status: "COMPLETED",
        itemNames,
      },
    ];
  });
}
