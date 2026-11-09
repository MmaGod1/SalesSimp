import { describe, expect, it } from "vitest";
import { createDemoHistory } from "./demoHistory";
import { normalizeTransactions } from "./paypal/normalize";
import { createSalesStory } from "./story";

describe("createSalesStory", () => {
  const sales = normalizeTransactions(
    createDemoHistory(new Date("2026-11-03T12:00:00Z")),
  );

  it("names the full period and explains growth, the dip, and item changes with figures", () => {
    const story = createSalesStory(sales, {
      startMonth: "2026-07",
      endMonth: "2026-10",
    });

    expect(story.period).toBe("July 2026 to October 2026");
    expect(story.message).toBeNull();
    expect(story.sentences.map((sentence) => sentence.id)).toEqual([
      "overall",
      "movement",
      "months",
      "top-item",
      "rising-item",
      "fading-item",
    ]);
    expect(story.sentences.find((sentence) => sentence.id === "movement")?.text)
      .toContain("dip in September");
    expect(story.sentences.find((sentence) => sentence.id === "rising-item")?.text)
      .toContain("Ankara dress");
    expect(story.sentences.find((sentence) => sentence.id === "fading-item")?.text)
      .toContain("Silk scarf");
    expect(story.sentences.find((sentence) => sentence.id === "fading-item")?.numbers.at(-1))
      .toEqual({ label: "Change", value: "-75%" });
    expect(story.sentences.every((sentence) => sentence.numbers.length > 0))
      .toBe(true);
    expect(story.sentences.join(" ").toLowerCase()).not.toMatch(
      /stock|inventory/,
    );
  });

  it("keeps the year in story month names when the period crosses calendar years", () => {
    const story = createSalesStory(
      [
        {
          id: "december-sale",
          date: "2025-12-10T12:00:00Z",
          amount: 100,
          currency: "USD",
          status: "COMPLETED",
          itemNames: ["Ankara dress"],
        },
        {
          id: "january-sale",
          date: "2026-01-10T12:00:00Z",
          amount: 150,
          currency: "USD",
          status: "COMPLETED",
          itemNames: ["Ankara dress"],
        },
      ],
      { startMonth: "2025-12", endMonth: "2026-01" },
    );

    expect(story.period).toBe("December 2025 to January 2026");
    expect(story.sentences[0].text).toContain(
      "December 2025 to January 2026",
    );
  });

  it("returns a helpful message when the range has too little data", () => {
    const story = createSalesStory(sales, {
      startMonth: "2026-10",
      endMonth: "2026-10",
    });

    expect(story.message).toContain("not enough");
    expect(story.sentences).toEqual([]);
    expect(story.period).toBe("October 2026 to October 2026");
  });

  it("suggests a wider period when no sales match the range", () => {
    const story = createSalesStory(sales, {
      startMonth: "2025-01",
      endMonth: "2025-02",
    });

    expect(story.message).toContain("no completed sales");
    expect(story.sentences).toEqual([]);
  });

  it("adds current-month payments separately from the completed-month story", () => {
    const story = createSalesStory(
      sales,
      { startMonth: "2026-07", endMonth: "2026-10" },
      "USD",
      {
        month: "2026-11",
        totalCents: 4500,
        paymentCount: 1,
        payments: [
          {
            date: "2026-11-02T12:00:00Z",
            amountCents: 4500,
            itemNames: ["Ankara dress"],
          },
        ],
      },
    );
    const currentMonthSentence = story.sentences.at(-1);

    expect(currentMonthSentence?.id).toBe("current-month");
    expect(currentMonthSentence?.text).toContain(
      "November 2026 so far: $45.00 from 1 payment",
    );
    expect(currentMonthSentence?.text).toContain(
      "not included in completed-month comparisons",
    );
    expect(currentMonthSentence?.numbers).toEqual([
      { label: "Nov 2 · Ankara dress", value: "$45.00" },
    ]);
  });

  it("does not add a current-month sentence when there are no completed live payments", () => {
    const story = createSalesStory(
      sales,
      { startMonth: "2026-07", endMonth: "2026-10" },
      "USD",
      {
        month: "2026-11",
        totalCents: 0,
        paymentCount: 0,
        payments: [],
      },
    );

    expect(story.sentences.some((sentence) => sentence.id === "current-month"))
      .toBe(false);
  });
});
