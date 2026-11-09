import { describe, expect, it, vi } from "vitest";
import { fetchWithRetry, PayPalConnectionError } from "./request";

describe("PayPal request retry", () => {
  it("retries a transient connection failure once", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));

    const response = await fetchWithRetry(
      "https://api-m.sandbox.paypal.com/v1/oauth2/token",
      { method: "POST" },
      fetchMock,
    );

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("returns a safe connection error when retry also fails", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new TypeError("sensitive underlying transport detail"));

    const error = await fetchWithRetry(
      "https://api-m.sandbox.paypal.com/v1/oauth2/token",
      { method: "POST" },
      fetchMock,
    ).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(PayPalConnectionError);
    expect(error).toMatchObject({
      message: "Could not connect to PayPal. Check your connection and try again.",
    });
    expect(error).not.toHaveProperty("message", "sensitive underlying transport detail");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
