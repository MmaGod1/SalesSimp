import type { ResolvedIntent } from "./questions";

export type Sale = {
  id: string;
  date: string;
  amount: number;
  currency: string;
  status: string;
  itemNames: string[];
  source?: "demo" | "live";
};

export type PublicSale = Omit<Sale, "id"> & {
  source: "demo" | "live";
};

export type SalesApiResponse = {
  sales: PublicSale[];
  leftOutCount: number;
  currencyLeftOutCount: number;
  transactionsRead: number;
  liveSalesCount: number;
  fetchedAt: string;
};

export type AskApiResponse = {
  status: "answered" | "unsupported" | "clarify" | "error";
  periodLabel: string;
  sentences: Array<{
    id: string;
    tone: "up" | "down" | "neutral";
    text: string;
    numbers: Array<{ label: string; value: string }>;
  }>;
  resolvedPeriod: { startMonth: string; endMonth: string } | null;
  source: "ai" | "template";
  message?: string;
  suggestedQuestions?: string[];
  followUpQuestions?: string[];
  resolvedIntent?: ResolvedIntent | null;
};

export type PayPalTransaction = {
  transaction_info?: {
    transaction_id?: string;
    transaction_event_code?: string;
    transaction_initiation_date?: string;
    transaction_amount?: {
      value?: string;
      currency_code?: string;
    };
    transaction_status?: string;
  };
  cart_info?: {
    item_details?: Array<{
      item_name?: string;
    }>;
  };
};
