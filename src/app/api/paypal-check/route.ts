import {
  fetchPayPalTransactions,
  PayPalConfigurationError,
  PayPalRequestError,
} from "@/lib/paypal/client";

const LAST_30_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export async function GET() {
  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - LAST_30_DAYS_MS);

  try {
    const transactions = await fetchPayPalTransactions(startDate, endDate);

    return Response.json({
      ok: true,
      transactionCount: transactions.length,
      transactions: transactions.slice(0, 5),
    });
  } catch (error) {
    if (error instanceof PayPalConfigurationError) {
      return Response.json(
        { ok: false, message: error.message, status: 500 },
        { status: 500 },
      );
    }

    if (error instanceof PayPalRequestError) {
      return Response.json(
        { ok: false, message: error.message, status: error.status },
        { status: error.status },
      );
    }

    return Response.json(
      {
        ok: false,
        message: "Unable to contact PayPal. Please try again.",
        status: 502,
      },
      { status: 502 },
    );
  }
}
