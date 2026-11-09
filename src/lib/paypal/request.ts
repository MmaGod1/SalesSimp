const RETRY_DELAY_MS = 250;

export class PayPalConnectionError extends Error {
  constructor() {
    super("Could not connect to PayPal. Check your connection and try again.");
    this.name = "PayPalConnectionError";
  }
}

export async function fetchWithRetry(
  input: string,
  init: RequestInit,
  fetchImpl: typeof fetch = fetch,
): Promise<Response> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    let response: Response;
    try {
      response = await fetchImpl(input, init);
    } catch {
      if (attempt === 0) {
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
        continue;
      }
      throw new PayPalConnectionError();
    }

    if (
      attempt === 0 &&
      (response.status === 429 || response.status >= 500)
    ) {
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      continue;
    }
    return response;
  }

  throw new PayPalConnectionError();
}
