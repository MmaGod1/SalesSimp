import {
  PayPalConfigurationError,
  PayPalRequestError,
} from "@/lib/paypal/client";
import { loadMergedSales } from "@/lib/paypal/salesData";
import { answerSalesQuestion } from "@/lib/groq";

export const dynamic = "force-dynamic";

function logRouteFailure(refersToPrevious = false): void {
  if (process.env.NODE_ENV === "development") {
    console.info(
      `[api/ask] result ${JSON.stringify({
        questionType: null,
        refersToPrevious,
        call2ReturnedText: false,
        numberCheckPassed: null,
        source: "template",
        fallbackReason: "bad response",
      })}`,
    );
  }
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    logRouteFailure();
    return Response.json(
      {
        status: "error",
        periodLabel: "Your sales",
        sentences: [],
        resolvedPeriod: null,
        source: "template",
        message: "Please enter a sales question.",
      },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const question =
    typeof body === "object" && body !== null && !Array.isArray(body)
      ? (body as Record<string, unknown>).question
      : null;
  const previousTurns =
    typeof body === "object" && body !== null && !Array.isArray(body)
      ? (body as Record<string, unknown>).previousTurns
      : undefined;
  if (typeof question !== "string") {
    logRouteFailure();
    return Response.json(
      {
        status: "error",
        periodLabel: "Your sales",
        sentences: [],
        resolvedPeriod: null,
        source: "template",
        message: "Please enter a sales question.",
      },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const data = await loadMergedSales();
    const result = await answerSalesQuestion(
      question,
      data.sales,
      new Date(data.fetchedAt),
      previousTurns,
    );
    return Response.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const hasPreviousTurns =
      Array.isArray(previousTurns) && previousTurns.length > 0;
    const looksLikeFollowUp =
      /^(?:and\b|what about\b|how about\b|the same\b|compare it\b)/i.test(
        question.trim(),
      );
    logRouteFailure(hasPreviousTurns && looksLikeFollowUp);
    const message =
      error instanceof PayPalConfigurationError ||
      error instanceof PayPalRequestError
        ? error.message
        : "Unable to load sales for your question. Please try again.";
    return Response.json(
      {
        status: "error",
        periodLabel: "Your sales",
        sentences: [],
        resolvedPeriod: null,
        source: "template",
        message,
      },
      {
        status: error instanceof PayPalRequestError ? error.status : 502,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
