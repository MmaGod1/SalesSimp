import { describe, expect, it } from "vitest";
import {
  normalizeTransactionBatch,
  normalizeTransactions,
} from "./normalize";
import { analyzeSales } from "../analysis";
import type { PayPalTransaction } from "../types";

function transaction(
  id: string,
  eventCode: string,
  status = "S",
  currency = "USD",
  itemName: string | undefined = "Ankara dress",
): PayPalTransaction {
  return {
    transaction_info: {
      transaction_id: id,
      transaction_event_code: eventCode,
      transaction_initiation_date: "2026-07-14T12:00:00Z",
      transaction_amount: { value: "45.00", currency_code: currency },
      transaction_status: status,
    },
    cart_info: { item_details: itemName ? [{ item_name: itemName }] : [] },
  };
}

describe("normalizeTransactions", () => {
  it("keeps successful received payments and derives currency from the record", () => {
    expect(normalizeTransactions([transaction("sale-1", "T0006", "S", "EUR")]))
      .toEqual([
        {
          id: "sale-1",
          date: "2026-07-14T12:00:00Z",
          amount: 45,
          currency: "EUR",
          status: "COMPLETED",
          itemNames: ["Ankara dress"],
        },
      ]);
  });

  it("counts excluded money movements and pending payments as left out", () => {
    const result = normalizeTransactionBatch([
      transaction("completed", "T0006"),
      transaction("deposit", "T0300"),
      transaction("fee", "T0107"),
      transaction("account-correction", "T1900", "S", "USD", "Initial balance"),
      transaction("pending", "T0006", "P"),
    ]);

    expect(result.sales).toHaveLength(1);
    expect(result.leftOutCount).toBe(4);
    expect(result.leftOutReasons).toEqual({
      invalid_date: 0,
      not_successful: 1,
      not_received_payment_event: 3,
      invalid_currency: 0,
      invalid_amount: 0,
    });
    expect(result.leftOutEventCodeCounts).toEqual({
      T0300: 1,
      T0107: 1,
      T1900: 1,
    });
  });

  it("counts the $5,000 T1900 initial-balance correction as left out, never as sales", () => {
    const accountCorrection = transaction(
      "account-correction",
      "T1900",
      "S",
      "USD",
      "Initial balance",
    );
    accountCorrection.transaction_info!.transaction_amount!.value = "5000.00";
    const completedPayment = transaction("completed", "T0006");
    const result = normalizeTransactionBatch([
      completedPayment,
      accountCorrection,
    ]);

    expect(result.leftOutCount).toBe(1);
    expect(result.leftOutEventCodeCounts).toEqual({ T1900: 1 });
    expect(result.sales).toMatchObject([{ amount: 45, itemNames: ["Ankara dress"] }]);
    expect(
      analyzeSales(result.sales, {
        startMonth: "2026-07",
        endMonth: "2026-07",
      }).totalCents,
    ).toBe(4500);
    expect(result.sales.some((sale) => sale.amount === 5000)).toBe(false);
  });

  it("keeps completed payments without item names", () => {
    expect(normalizeTransactions([transaction("no-item", "T0006", "S", "USD", "")]))
      .toMatchObject([{ itemNames: [], amount: 45 }]);
  });
});
