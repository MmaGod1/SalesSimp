export type Sale = {
  id: string;
  date: string;
  amount: number;
  currency: string;
  status: string;
  itemNames: string[];
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
