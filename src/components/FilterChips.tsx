import type { MonthRange } from "@/lib/analysis";

export type PeriodFilter = "last3" | "year" | "custom";

type FilterChipsProps = {
  activeFilter: PeriodFilter;
  range: MonthRange;
  minimumMonth: string;
  maximumMonth: string;
  onSelect: (filter: PeriodFilter) => void;
  onRangeChange: (range: MonthRange) => void;
};

export function FilterChips({
  activeFilter,
  range,
  minimumMonth,
  maximumMonth,
  onSelect,
  onRangeChange,
}: FilterChipsProps) {
  return (
    <section aria-label="Choose a period" className="filters">
      <p className="filters-label">Choose a period</p>
      <div className="filter-chips">
        <button
          aria-pressed={activeFilter === "last3"}
          className="filter-chip"
          onClick={() => onSelect("last3")}
          type="button"
        >
          Last 3 months
        </button>
        <button
          aria-pressed={activeFilter === "year"}
          className="filter-chip"
          onClick={() => onSelect("year")}
          type="button"
        >
          This year
        </button>
        <button
          aria-pressed={activeFilter === "custom"}
          className="filter-chip"
          onClick={() => onSelect("custom")}
          type="button"
        >
          Pick months
        </button>
      </div>
      {activeFilter === "custom" && (
        <div className="month-picker">
          <label>
            From
            <input
              max={range.endMonth}
              min={minimumMonth}
              onChange={(event) =>
                onRangeChange({
                  startMonth: event.target.value,
                  endMonth: range.endMonth,
                })
              }
              type="month"
              value={range.startMonth}
            />
          </label>
          <label>
            To
            <input
              max={maximumMonth}
              min={range.startMonth}
              onChange={(event) =>
                onRangeChange({
                  startMonth: range.startMonth,
                  endMonth: event.target.value,
                })
              }
              type="month"
              value={range.endMonth}
            />
          </label>
        </div>
      )}
    </section>
  );
}
