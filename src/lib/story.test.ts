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
});
