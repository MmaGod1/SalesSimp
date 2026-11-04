import { describe, expect, it } from "vitest";
import { normalizeTransactions } from "./normalize";
import type { PayPalTransaction } from "../types";

function transaction(
  id: string,
  eventCode: string,
  status = "S",
): PayPalTransaction {
  return {
    transaction_info: {
      transaction_id: id,
      transaction_event_code: eventCode,
      transaction_initiation_date: "2026-07-14T12:00:00Z",
      transaction_amount: { value: "45.00", currency_code: "USD" },
      transaction_status: status,
    },
    cart_info: { item_details: [{ item_name: "Ankara dress" }] },
  };
}

describe("normalizeTransactions", () => {
  it("keeps successful USD payments received from buyers with item names", () => {
    expect(normalizeTransactions([transaction("sale-1", "T0006")])).toEqual([
      {
        id: "sale-1",
        date: "2026-07-14T12:00:00Z",
        amount: 45,
        currency: "USD",
        status: "COMPLETED",
        itemNames: ["Ankara dress"],
      },
    ]);
  });

  it("excludes non-payment event codes, non-successful payments, and other currencies", () => {
    const otherCurrency = transaction("eur", "T0006");
    otherCurrency.transaction_info!.transaction_amount!.currency_code = "EUR";

    expect(
      normalizeTransactions([
        transaction("deposit", "T0300"),
        transaction("fee", "T1106"),
        transaction("pending", "T0006", "P"),
        otherCurrency,
      ]),
    ).toEqual([]);
  });
});
