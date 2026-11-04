import type { PayPalTransaction } from "@/lib/types";

const MONTHLY_ITEM_UNITS = [
  [5, 7, 3, 12],
  [8, 10, 7, 9],
  [6, 8, 7, 8],
  [8, 6, 5, 2],
  [3, 5, 4, 6],
  [7, 9, 8, 7],
  [4, 5, 4, 5],
  [6, 8, 6, 7],
] as const;

const ITEMS = [
  { key: "ankara-dress", name: "Ankara dress", unitPrice: 45 },
  { key: "linen-shirt", name: "Linen shirt", unitPrice: 28 },
  { key: "tote-bag", name: "Tote bag", unitPrice: 18 },
  { key: "silk-scarf", name: "Silk scarf", unitPrice: 15 },
  { key: "denim-jacket", name: "Denim jacket", unitPrice: 52 },
  { key: "beaded-necklace", name: "Beaded necklace", unitPrice: 12 },
  { key: "kente-skirt", name: "Kente skirt", unitPrice: 24 },
  { key: "cotton-headwrap", name: "Cotton headwrap", unitPrice: 10 },
] as const;

function monthKey(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

export function createDemoHistory(
  today: Date = new Date(),
): PayPalTransaction[] {
  const currentMonth = Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    1,
  );
  const transactions: PayPalTransaction[] = [];

  for (let monthOffset = 4; monthOffset >= 1; monthOffset -= 1) {
    const monthStart = new Date(
      Date.UTC(
        new Date(currentMonth).getUTCFullYear(),
        new Date(currentMonth).getUTCMonth() - monthOffset,
        1,
      ),
    );
    const year = monthStart.getUTCFullYear();
    const month = monthStart.getUTCMonth();
    const key = monthKey(year, month);
    const monthDays = daysInMonth(year, month);

    ITEMS.forEach((item, itemIndex) => {
      const units = MONTHLY_ITEM_UNITS[itemIndex][4 - monthOffset];
      const quantities = [Math.floor(units / 2), Math.ceil(units / 2)];

      quantities.forEach((quantity, saleIndex) => {
        const saleNumber = itemIndex * 2 + saleIndex;
        const day =
          1 + Math.floor(((saleNumber + 0.5) * monthDays) / ITEMS.length / 2);
        const transactionId = `demo-${key}-${item.key}-${saleIndex + 1}`;

        transactions.push({
          transaction_info: {
            transaction_id: transactionId,
            transaction_event_code: "T0006",
            transaction_initiation_date: new Date(
              Date.UTC(year, month, day, 12),
            ).toISOString(),
            transaction_amount: {
              value: (item.unitPrice * quantity).toFixed(2),
              currency_code: "USD",
            },
            transaction_status: "S",
          },
          cart_info: {
            item_details: [
              {
                item_name: item.name,
              },
            ],
          },
        });
      });
    });
  }

  return transactions;
}
