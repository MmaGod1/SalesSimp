"use client";

import { useEffect, useMemo, useState } from "react";
import {
  analyzeSales,
  formatMonth,
  getCompletedMonthKeys,
  type MonthRange,
} from "@/lib/analysis";
import { createDemoHistory } from "@/lib/demoHistory";
import { normalizeTransactions } from "@/lib/paypal/normalize";
import { createSalesStory } from "@/lib/story";
import { AnimatedNumber } from "./AnimatedNumber";
import { FilterChips, type PeriodFilter } from "./FilterChips";
import { Header } from "./Header";
import { Story } from "./Story";

type SalesDashboardProps = {
  initialToday: string;
};

function formatCents(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

export function SalesDashboard({ initialToday }: SalesDashboardProps) {
  const today = useMemo(() => new Date(initialToday), [initialToday]);
  const completedMonths = useMemo(
    () => getCompletedMonthKeys(today, 4),
    [today],
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

  useEffect(() => {
    const timer = window.setTimeout(() => setPulseFirstButton(false), 850);
    return () => window.clearTimeout(timer);
  }, []);

  const sales = useMemo(
    () => normalizeTransactions(createDemoHistory(today)),
    [today],
  );
  const story = useMemo(() => createSalesStory(sales, range), [sales, range]);
  const analysis = useMemo(
    () => analyzeSales(sales, range),
    [sales, range],
  );
  const currentYear = String(today.getUTCFullYear());
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

  return (
    <main className="page-shell dashboard-layout">
      <aside className="dashboard-sidebar">
        <Header />
        <section aria-label="Selected sales period" className="period-summary">
          <p className="period-name">{story.period}</p>
          <span className="demo-badge">Includes demo history</span>
          {availableMonthsNote && (
            <p className="available-note">{availableMonthsNote}</p>
          )}
        </section>
        <section aria-label="Completed sales total" className="total-card">
          <span>Completed sales</span>
          <strong>
            <AnimatedNumber
              key={animationKey}
              format={formatCents}
              value={analysis.totalCents}
            />
          </strong>
        </section>
        <FilterChips
          activeFilter={activeFilter}
          maximumMonth={latestMonth}
          minimumMonth={earliestMonth}
          onRangeChange={changeCustomRange}
          onSelect={chooseFilter}
          range={range}
        />
        <div aria-hidden="true" className="ask-box-placeholder">
          {/* Ask box reserved for a later slice. */}
        </div>
      </aside>
      <section aria-label="Sales story" className="story-column">
        <p className="period-footnote">
          Showing completed months only, through {formatMonth(latestMonth)}.
        </p>
        {story.message ? (
          <p className="empty-message" role="status">
            {story.message}
          </p>
        ) : (
          <Story
            animationKey={animationKey}
            onPanelOpen={() => setPulseFirstButton(false)}
            pulseFirstButton={pulseFirstButton}
            sentences={story.sentences}
          />
        )}
      </section>
    </main>
  );
}
