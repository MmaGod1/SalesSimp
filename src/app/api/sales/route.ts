import {
  PayPalConfigurationError,
  PayPalRequestError,
} from "@/lib/paypal/client";
import { loadMergedSales } from "@/lib/paypal/salesData";

export const dynamic = "force-dynamic";

function publicSale(sale: Awaited<ReturnType<typeof loadMergedSales>>["sales"][number]) {
  return {
    date: sale.date,
    amount: sale.amount,
    currency: sale.currency,
    status: sale.status,
    itemNames: sale.itemNames,
    source: sale.source,
  };
}

export async function GET() {
  try {
    const data = await loadMergedSales();

    return Response.json(
      {
        ...data,
        sales: data.sales.map(publicSale),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof PayPalConfigurationError) {
      return Response.json(
        { message: error.message },
        { status: 500, headers: { "Cache-Control": "no-store" } },
      );
    }

    if (error instanceof PayPalRequestError) {
      return Response.json(
        { message: error.message },
        { status: error.status, headers: { "Cache-Control": "no-store" } },
      );
    }

    return Response.json(
      { message: "Unable to contact PayPal. Please try again." },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
