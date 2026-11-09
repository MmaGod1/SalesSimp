import { describe, expect, it } from "vitest";
import { buildAskExamples } from "./askExamples";
import { computeQuestionAnswer } from "./analysis";
import { getMonthKeysBetween } from "./analysis";
import { answerSalesQuestion } from "./groq-core";
import { validateQuestionIntent } from "./questions";
import type { Sale } from "./types";

describe("generated Ask examples", () => {
  const today = new Date("2026-11-04T12:00:00Z");
  const sales: Sale[] = [
    {
      id: "dress-jul",
      date: "2026-07-06T12:00:00Z",
      amount: 100,
      currency: "USD",
      status: "COMPLETED",
      itemNames: ["Ankara dress"],
    },
    {
      id: "shirt-aug",
      date: "2026-08-12T12:00:00Z",
      amount: 50,
      currency: "USD",
      status: "COMPLETED",
      itemNames: ["Linen shirt"],
    },
    {
      id: "dress-sep",
      date: "2026-09-10T12:00:00Z",
      amount: 150,
      currency: "USD",
      status: "COMPLETED",
      itemNames: ["Ankara dress"],
    },
    {
      id: "shirt-oct",
      date: "2026-10-28T12:00:00Z",
      amount: 25,
      currency: "USD",
      status: "COMPLETED",
      itemNames: ["Linen shirt"],
    },
  ];

  it("creates varied examples whose intents validate and calculate", () => {
    const examples = buildAskExamples(sales, today);
    const months = ["2026-07", "2026-08", "2026-09", "2026-10"];
    const itemNames = ["Ankara dress", "Linen shirt"];

    expect(examples).toHaveLength(5);
    expect(new Set(examples.map(({ question }) => question)).size).toBe(5);
    expect(examples.map(({ question }) => question)).toEqual([
      "Which month was my best?",
      "How did Ankara dress do over the last 3 months?",
      "Compare September with October.",
      "What were my total sales this year?",
      "What changed in October?",
    ]);

    for (const example of examples) {
      const validation = validateQuestionIntent(
        example.question,
        example.intent,
        { today, availableMonths: months, itemNames },
      );
      expect(validation.supported).toBe(true);
      if (validation.supported) {
        expect(computeQuestionAnswer(sales, validation.question)).not.toBeNull();
      }
    }

    expect(examples[2].intent).toMatchObject({
      type: "compare_periods",
      period: { startMonth: "2026-09", endMonth: "2026-10" },
    });
    expect(
      getMonthKeysBetween("2026-09", "2026-10"),
    ).toEqual(["2026-09", "2026-10"]);
  });

  it("answers all generated examples when the mocked classifier returns their intents", async () => {
    const examples = buildAskExamples(sales, today);
    for (const example of examples) {
      let requestCount = 0;
      const fetchMock = (async () => {
        requestCount += 1;
        if (requestCount === 1) {
          return new Response(
            JSON.stringify({
              choices: [
                { message: { content: JSON.stringify(example.intent) } },
              ],
            }),
            { status: 200 },
          );
        }
        return new Response("rate limited", { status: 429 });
      }) as typeof fetch;
      const result = await answerSalesQuestion(
        example.question,
        sales,
        today,
        "test-key",
        fetchMock,
      );
      expect(result.status).toBe("answered");
      expect(result.sentences.length).toBeGreaterThan(0);
    }
  });
});
