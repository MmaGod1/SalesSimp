"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  analyzeSales,
  formatMonth,
  getCompletedMonthKeys,
  type MonthRange,
} from "@/lib/analysis";
import { formatLeftOutMessage, getCurrentMonthSummary } from "@/lib/sales";
import { createSalesStory } from "@/lib/story";
import type { Sale, SalesApiResponse } from "@/lib/types";
import { AnimatedNumber } from "./AnimatedNumber";
import { AskBox } from "./AskBox";
import { FilterChips, type PeriodFilter } from "./FilterChips";
import { Header } from "./Header";
import { Story } from "./Story";

type SalesDashboardProps = {
  initialToday: string;
};

function formatCents(cents: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(cents / 100);
}

function isSalesResponse(value: unknown): value is SalesApiResponse {
  if (!value || typeof value !== "object") {
    return false;
  }

  const response = value as Partial<SalesApiResponse>;
  return (
    Array.isArray(response.sales) &&
    Number.isInteger(response.leftOutCount) &&
    Number.isInteger(response.currencyLeftOutCount) &&
    Number.isInteger(response.transactionsRead) &&
    Number.isInteger(response.liveSalesCount) &&
    typeof response.fetchedAt === "string" &&
    !Number.isNaN(Date.parse(response.fetchedAt))
  );
}

async function salesErrorMessage(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json();
    if (
      typeof body === "object" &&
      body !== null &&
      "message" in body &&
      typeof body.message === "string" &&
      body.message.trim()
    ) {
      return body.message;
    }
  } catch {
    return `PayPal request failed (HTTP ${response.status}). Please try again.`;
  }
  return `PayPal request failed (HTTP ${response.status}). Please try again.`;
}

export function SalesDashboard({ initialToday }: SalesDashboardProps) {
  const initialDate = useMemo(() => new Date(initialToday), [initialToday]);
  const completedMonths = useMemo(
    () => getCompletedMonthKeys(initialDate, 4),
    [initialDate],
  );
  const initialRange = useMemo<MonthRange>(
    () => ({
      startMonth: completedMonths[1],
      endMonth: completedMonths[3],
    }),
    [completedMonths],
  );
  const [activeFilter, setActiveFilter] = useState<PeriodFilter>("last3");
  const [range, setRange] = useState<MonthRange>(initialRange);
  const [pulseFirstButton, setPulseFirstButton] = useState(true);
  const [retryNumber, setRetryNumber] = useState(0);
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [loadErrorMessage, setLoadErrorMessage] = useState(
    "We couldn't reach PayPal just now. Please try again in a minute.",
  );
  const [payload, setPayload] = useState<SalesApiResponse | null>(null);
  const [showAboutDemo, setShowAboutDemo] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    void fetch("/api/sales", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(await salesErrorMessage(response));
        }
        const result: unknown = await response.json();
        if (!isSalesResponse(result)) {
          throw new Error("Sales response was invalid.");
        }
        setPayload(result);
        setLoadErrorMessage("");
      })
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === "AbortError") {
          return;
        }
        setLoadErrorMessage(
          error instanceof Error
            ? error.message
            : "Unable to load sales from PayPal. Please try again.",
        );
        setHasError(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [retryNumber]);

  useEffect(() => {
    if (!payload) {
      return;
    }
    const timer = window.setTimeout(() => setPulseFirstButton(false), 850);
    return () => window.clearTimeout(timer);
  }, [payload]);

  const sales = useMemo<Sale[]>(
    () =>
      payload?.sales.map((sale, index) => ({
        ...sale,
        id: `${sale.source}-${index + 1}`,
      })) ?? [],
    [payload],
  );
  const currency = sales[0]?.currency ?? "USD";
  const liveSales = useMemo(
    () => sales.filter((sale) => sale.source === "live"),
    [sales],
  );
  const today = useMemo(
    () => new Date(payload?.fetchedAt ?? initialToday),
    [initialToday, payload],
  );
  const currentMonth = useMemo(
    () => (payload ? getCurrentMonthSummary(liveSales, today) : null),
    [liveSales, payload, today],
  );
  const story = useMemo(
    () => createSalesStory(sales, range, currency, currentMonth),
    [currency, currentMonth, range, sales],
  );
  const analysis = useMemo(
    () => analyzeSales(sales, range, currency),
    [currency, range, sales],
  );
  const currentYear = String(initialDate.getUTCFullYear());
  const monthsThisYear = completedMonths.filter((month) =>
    month.startsWith(`${currentYear}-`),
  );
  const earliestMonth = completedMonths[0];
  const latestMonth = completedMonths[completedMonths.length - 1];
  const requestedStartMonth =
    activeFilter === "year" ? `${currentYear}-01` : range.startMonth;
  const availableMonthsNote =
    requestedStartMonth < earliestMonth && range.startMonth > requestedStartMonth
      ? `Showing the data available, from ${formatMonth(earliestMonth)}.`
      : null;
  const animationKey = `${range.startMonth}:${range.endMonth}`;

  function chooseFilter(filter: PeriodFilter) {
    setActiveFilter(filter);
    setPulseFirstButton(false);
    if (filter === "last3") {
      setRange({
        startMonth: completedMonths[1],
        endMonth: completedMonths[3],
      });
    } else if (filter === "year") {
      setRange({
        startMonth: monthsThisYear[0] ?? `${currentYear}-01`,
        endMonth: monthsThisYear[monthsThisYear.length - 1] ?? latestMonth,
      });
    }
  }

  function changeCustomRange(nextRange: MonthRange) {
    setActiveFilter("custom");
    setPulseFirstButton(false);
    setRange(nextRange);
  }

  const syncAskedPeriod = useCallback(
    (nextRange: MonthRange) => {
      const samePeriod =
        nextRange.startMonth === range.startMonth &&
        nextRange.endMonth === range.endMonth;
      if (samePeriod) {
        return;
      }
      setPulseFirstButton(false);
      setRange(nextRange);
      const yearRange = {
        startMonth: monthsThisYear[0] ?? `${currentYear}-01`,
        endMonth: monthsThisYear[monthsThisYear.length - 1] ?? latestMonth,
      };
      setActiveFilter(
        nextRange.startMonth === completedMonths[1] &&
          nextRange.endMonth === completedMonths[3]
          ? "last3"
          : nextRange.startMonth === yearRange.startMonth &&
              nextRange.endMonth === yearRange.endMonth
            ? "year"
            : "custom",
      );
    },
    [completedMonths, currentYear, latestMonth, monthsThisYear, range],
  );

  return (
    <main
      className={`page-shell dashboard-layout${payload ? " has-ask-box" : ""}`}
    >
      <aside className="dashboard-sidebar">
        <div className="sidebar-top">
          <Header />
          <div className="dashboard-controls">
            <section aria-label="Selected sales period" className="period-summary">
              <p className="period-name">{story.period}</p>
              <span className="demo-badge">Includes demo history</span>
              <button
                className="about-demo-button"
                onClick={() => setShowAboutDemo(true)}
                type="button"
              >
                About this demo
              </button>
              {availableMonthsNote && (
                <p className="available-note">{availableMonthsNote}</p>
              )}
            </section>
            <section aria-label="Completed sales total" className="total-card">
              <span>Completed sales</span>
              {loading ? (
                <span aria-hidden="true" className="total-skeleton" />
              ) : payload ? (
                <strong>
                  <AnimatedNumber
                    key={animationKey}
                    format={(value) => formatCents(value, currency)}
                    value={analysis.totalCents}
                  />
                </strong>
              ) : (
                <strong aria-label="Not available">—</strong>
              )}
            </section>
            <FilterChips
              activeFilter={activeFilter}
              maximumMonth={latestMonth}
              minimumMonth={earliestMonth}
              onRangeChange={changeCustomRange}
              onSelect={chooseFilter}
              range={range}
            />
          </div>
        </div>
      </aside>
      <section aria-label="Sales story" className="story-column">
        {loading ? (
          <div className="loading-state" role="status">
            <p>Getting your sales from PayPal...</p>
            <div aria-hidden="true" className="story-skeleton" />
            <div aria-hidden="true" className="story-skeleton story-skeleton-short" />
            <div aria-hidden="true" className="story-skeleton" />
          </div>
        ) : hasError ? (
          <div className="error-state" role="alert">
            <p>{loadErrorMessage}</p>
            <button
              className="retry-button"
              onClick={() => {
                setLoading(true);
                setHasError(false);
                setPayload(null);
                setRetryNumber((number) => number + 1);
              }}
              type="button"
            >
              Try again
            </button>
          </div>
        ) : payload ? (
          <>
            {payload.leftOutCount > 0 && (
              <p className="live-note">
                {formatLeftOutMessage(
                  payload.leftOutCount,
                  payload.currencyLeftOutCount,
                )}
              </p>
            )}
            {story.message && (
              <p className="empty-message" role="status">
                {story.message}
              </p>
            )}
            {story.sentences.length > 0 && (
              <Story
                animationKey={animationKey}
                onPanelOpen={() => setPulseFirstButton(false)}
                pulseFirstButton={pulseFirstButton}
                sentences={story.sentences}
              />
            )}
          </>
        ) : null}
      </section>
      {payload && (
        <AskBox
          completedThrough={formatMonth(latestMonth)}
          onResolvedPeriod={syncAskedPeriod}
          sales={sales}
          today={today}
        />
      )}
      {showAboutDemo && (
        <div className="demo-dialog-backdrop">
          <section
            aria-labelledby="about-demo-title"
            aria-modal="true"
            className="demo-dialog"
            role="dialog"
          >
            <h2 id="about-demo-title">About this demo</h2>
            <p>
              SalesSimp connects to a PayPal sandbox account. Earlier months
              are built-in sample data, formatted like PayPal transactions,
              so the story has history to compare.
            </p>
            {payload && (
              <p className="connection-summary">
                Connected to the PayPal sandbox: {payload.transactionsRead}{" "}
                {payload.transactionsRead === 1 ? "transaction" : "transactions"}{" "}
                read, {payload.liveSalesCount} counted as sales,{" "}
                {payload.leftOutCount} left out. Fetched{" "}
                {new Intl.DateTimeFormat("en", {
                  dateStyle: "medium",
                  timeStyle: "short",
                }).format(new Date(payload.fetchedAt))}.
              </p>
            )}
            <button
              className="retry-button"
              onClick={() => setShowAboutDemo(false)}
              type="button"
            >
              Close
            </button>
          </section>
        </div>
      )}
    </main>
  );
}
