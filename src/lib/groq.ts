




import "server-only";
import { answerSalesQuestion as answerWithKey } from "./groq-core";
import type { Sale } from "./types";

export async function answerSalesQuestion(
  question: string,
  sales: Sale[],
  today: Date,
  previousTurns: unknown = [],
): ReturnType<typeof answerWithKey> {
  return answerWithKey(
    question,
    sales,
    today,
    process.env.GROQ_API_KEY ?? "",
    fetch,
    previousTurns,
  );
}
