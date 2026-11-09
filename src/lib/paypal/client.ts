import "server-only";
import type { PayPalTransaction } from "@/lib/types";
import {
  fetchWithRetry,
  PayPalConnectionError,
} from "./request";

const PAYPAL_BASE_URL = "https://api-m.sandbox.paypal.com";
const MAX_RANGE_MS = 31 * 24 * 60 * 60 * 1000 - 1;
const PAGE_SIZE = 100;

type PayPalTokenResponse = {
  access_token?: unknown;
};

type PayPalTransactionSearchResponse = {
  transaction_details?: PayPalTransaction[];
  total_pages?: number;
};

export type SafePayPalTransaction = PayPalTransaction;

export class PayPalConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PayPalConfigurationError";
  }
}

export class PayPalRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "PayPalRequestError";
  }
}

async function readJson<T>(response: Response): Promise<T> {
  try {
    return (await response.json()) as T;
  } catch {
    throw new PayPalRequestError("PayPal returned an invalid response.", 502);
  }
}

async function requestPayPal(
  input: string,
  init: RequestInit,
): Promise<Response> {
  try {
    return await fetchWithRetry(input, init);
  } catch (error) {
    if (error instanceof PayPalConnectionError) {
      throw new PayPalRequestError(error.message, 502);
    }
    throw error;
  }
}

export async function getPayPalAccessToken(): Promise<string> {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  const missingVariables = [
    !clientId && "PAYPAL_CLIENT_ID",
    !clientSecret && "PAYPAL_CLIENT_SECRET",
  ].filter((variable): variable is string => Boolean(variable));

  if (missingVariables.length > 0) {
    throw new PayPalConfigurationError(
      `Missing required environment variables: ${missingVariables.join(", ")}.`,
    );
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString(
    "base64",
  );
  const response = await requestPayPal(`${PAYPAL_BASE_URL}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new PayPalRequestError(
      `PayPal access token request failed (HTTP ${response.status}).`,
      response.status,
    );
  }

  const payload = await readJson<PayPalTokenResponse>(response);
  if (typeof payload.access_token !== "string") {
    throw new PayPalRequestError(
      "PayPal returned an invalid access token response.",
      502,
    );
  }

  return payload.access_token;
}

function toValidDate(value: string | Date): Date {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new RangeError("The PayPal date range is invalid.");
  }
  return date;
}

function toSafeTransaction(transaction: PayPalTransaction): SafePayPalTransaction {
  const info = transaction.transaction_info;
  const itemNames = transaction.cart_info?.item_details
    ?.map((item) => item.item_name?.trim())
    .filter((name): name is string => Boolean(name));

  return {
    transaction_info: {
      transaction_initiation_date: info?.transaction_initiation_date,
      transaction_status: info?.transaction_status,
      transaction_event_code: info?.transaction_event_code,
      transaction_amount: info?.transaction_amount
        ? {
            value: info.transaction_amount.value,
            currency_code: info.transaction_amount.currency_code,
          }
        : undefined,
    },
    cart_info: {
      item_details: itemNames?.map((item_name) => ({ item_name })),
    },
  };
}

async function fetchTransactionPage(
  accessToken: string,
  startDate: Date,
  endDate: Date,
  page: number,
): Promise<PayPalTransactionSearchResponse> {
  const query = new URLSearchParams({
    start_date: startDate.toISOString(),
    end_date: endDate.toISOString(),
    fields: "all",
    page_size: String(PAGE_SIZE),
    page: String(page),
  });
  const response = await requestPayPal(
    `${PAYPAL_BASE_URL}/v1/reporting/transactions?${query}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new PayPalRequestError(
      `PayPal transaction search failed (HTTP ${response.status}).`,
      response.status,
    );
  }

  return readJson<PayPalTransactionSearchResponse>(response);
}

export async function fetchPayPalTransactions(
  start: string | Date,
  end: string | Date,
): Promise<SafePayPalTransaction[]> {
  const startDate = toValidDate(start);
  const endDate = toValidDate(end);
  if (endDate.getTime() < startDate.getTime()) {
    throw new RangeError("The PayPal date range is invalid.");
  }

  const accessToken = await getPayPalAccessToken();
  const transactions: SafePayPalTransaction[] = [];

  for (
    let windowStart = startDate;
    windowStart.getTime() <= endDate.getTime();
  ) {
    const windowEnd = new Date(
      Math.min(windowStart.getTime() + MAX_RANGE_MS, endDate.getTime()),
    );
    let page = 1;
    let totalPages: number | undefined;

    do {
      const payload = await fetchTransactionPage(
        accessToken,
        windowStart,
        windowEnd,
        page,
      );
      const transactionDetails = payload.transaction_details ?? [];
      if (
        !Array.isArray(transactionDetails) ||
        (payload.total_pages !== undefined &&
          (!Number.isInteger(payload.total_pages) || payload.total_pages < 0))
      ) {
        throw new PayPalRequestError(
          "PayPal returned an invalid transaction search response.",
          502,
        );
      }

      totalPages = payload.total_pages;
      transactions.push(...transactionDetails.map(toSafeTransaction));
      const hasMorePages =
        totalPages === undefined
          ? transactionDetails.length === PAGE_SIZE
          : page < totalPages;
      if (!hasMorePages) {
        break;
      }
      page += 1;
    } while (true);

    windowStart = new Date(windowEnd.getTime() + 1);
  }

  return transactions;
}
