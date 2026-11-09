import {
  formatNaturalPeriod,
  getCompletedMonthKeys,
  getMonthKeysBetween,
} from "./analysis";
import type { MonthRange } from "./analysis";

export const QUESTION_TYPES = [
  "compare_periods",
  "best_worst_period",
  "item_trend",
  "totals",
  "what_changed",
  "unsupported",
] as const;

export type QuestionType = (typeof QUESTION_TYPES)[number];
export type RelativePeriod =
  | "last_month"
  | "month_before_last"
  | "last_3_months"
  | "this_year"
  | "last_year";
export type QuestionPeriod = MonthRange | RelativePeriod | string;
export type ComparisonPeriods = { a: MonthRange; b: MonthRange };

export type QuestionIntent = {
  type: QuestionType;
  period?: QuestionPeriod;
  periodA?: QuestionPeriod;
  periodB?: QuestionPeriod;
  item?: string | null;
};

export type ResolvedIntent = {
  type: Exclude<QuestionType, "unsupported">;
  period?: MonthRange;
  periodA?: MonthRange;
  periodB?: MonthRange;
  item?: string;
};

export type ConversationTurn = {
  question: string;
  intent: ResolvedIntent;
};

export type ResolvedQuestion = {
  question: string;
  type: Exclude<QuestionType, "unsupported">;
  range: MonthRange;
  comparison?: ComparisonPeriods;
  periodWasImplicit: boolean;
  item?: string;
  periodLabel: string;
  granularity: "month" | "week";
};

export type QuestionValidation =
  | { supported: true; question: ResolvedQuestion }
  | { supported: false; question: string; reason: string };

export type QuestionValidationContext = {
  today: Date;
  availableMonths: string[];
  itemNames: string[];
  useIntentPeriodWithoutQuestionPeriod?: boolean;
};

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
const RELATIVE_PERIODS = new Set<RelativePeriod>([
  "last_month",
  "month_before_last",
  "last_3_months",
  "this_year",
  "last_year",
]);
const MAX_QUESTION_LENGTH = 300;
const MONTHS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];

export function trimQuestion(question: string): string {
  return question.trim().slice(0, MAX_QUESTION_LENGTH);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseIntent(value: unknown): Record<string, unknown> | null {
  let parsed = value;
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value) as unknown;
    } catch {
      return null;
    }
  }
  return isRecord(parsed) ? parsed : null;
}

function validMonthRange(value: unknown): MonthRange | null {
  if (!isRecord(value)) {
    return null;
  }
  if (
    Object.keys(value).length !== 2 ||
    typeof value.startMonth !== "string" ||
    typeof value.endMonth !== "string" ||
    !MONTH_PATTERN.test(value.startMonth) ||
    !MONTH_PATTERN.test(value.endMonth) ||
    value.startMonth > value.endMonth
  ) {
    return null;
  }
  return { startMonth: value.startMonth, endMonth: value.endMonth };
}

function rangeForMonths(months: string[]): MonthRange | null {
  return months.length
    ? { startMonth: months[0], endMonth: months[months.length - 1] }
    : null;
}

function resolveRelativePeriod(
  period: RelativePeriod,
  context: QuestionValidationContext,
): MonthRange | null {
  const completed = getCompletedMonthKeys(
    context.today,
    Math.max(context.today.getUTCMonth() + 1, 1),
  );
  const allowed = new Set(context.availableMonths);
  if (period === "this_year") {
    return rangeForMonths(
      context.availableMonths.filter((month) =>
        month.startsWith(`${context.today.getUTCFullYear()}-`),
      ),
    );
  }
  if (period === "last_year") {
    const year = context.today.getUTCFullYear() - 1;
    const months = getMonthKeysBetween(`${year}-01`, `${year}-12`);
    if (months.some((month) => !allowed.has(month))) {
      return null;
    }
    return { startMonth: months[0], endMonth: months[months.length - 1] };
  }
  const count =
    period === "last_3_months" ? 3 : period === "month_before_last" ? 2 : 1;
  const selected = completed.slice(-count);
  const months =
    period === "month_before_last" ? selected.slice(0, 1) : selected;
  if (selected.length !== count || months.some((month) => !allowed.has(month))) {
    return null;
  }
  return rangeForMonths(months);
}

function resolveNamedMonth(
  value: string,
  availableMonths: string[],
): MonthRange | null {
  const trimmed = value.trim();
  if (MONTH_PATTERN.test(trimmed)) {
    return { startMonth: trimmed, endMonth: trimmed };
  }
  const match = trimmed.match(
    /^(january|february|march|april|may|june|july|august|september|october|november|december)(?:\s+(\d{4}))?$/i,
  );
  if (!match) {
    return null;
  }
  const monthNumber = MONTHS.indexOf(match[1].toLocaleLowerCase()) + 1;
  const matches = availableMonths.filter(
    (month) =>
      Number(month.slice(5, 7)) === monthNumber &&
      (!match[2] || month.startsWith(`${match[2]}-`)),
  );
  const mostRecent = matches[matches.length - 1];
  return mostRecent ? { startMonth: mostRecent, endMonth: mostRecent } : null;
}

function resolvePeriod(
  value: unknown,
  context: QuestionValidationContext,
): MonthRange | null {
  if (typeof value === "string") {
    if (RELATIVE_PERIODS.has(value as RelativePeriod)) {
      return resolveRelativePeriod(value as RelativePeriod, context);
    }
    return resolveNamedMonth(value, context.availableMonths);
  }
  return validMonthRange(value);
}

function periodWithinData(
  range: MonthRange,
  availableMonths: string[],
): boolean {
  const months = getMonthKeysBetween(range.startMonth, range.endMonth);
  const allowed = new Set(availableMonths);
  return months.length > 0 && months.every((month) => allowed.has(month));
}

function compareReferencesFromQuestion(question: string): [string, string] | null {
  const yearPhrases = question.match(/\b(?:this year|last year)\b/gi) ?? [];
  if (yearPhrases.length >= 2) {
    const [first, second] = yearPhrases;
    return [
      first!.toLocaleLowerCase().replace(" ", "_"),
      second!.toLocaleLowerCase().replace(" ", "_"),
    ];
  }
  const relativePhrases =
    question.match(/\b(?:last month|the month before|month before last)\b/gi) ?? [];
  if (relativePhrases.length >= 2) {
    const normalize = (phrase: string) =>
      /before/.test(phrase.toLocaleLowerCase())
        ? "month_before_last"
        : "last_month";
    const [first, second] = relativePhrases;
    return [normalize(first!), normalize(second!)];
  }
  const monthPattern =
    /\b(?:january|february|march|april|may|june|july|august|september|october|november|december)(?:\s+\d{4})?\b|\b\d{4}-(?:0[1-9]|1[0-2])\b/gi;
  const monthReferences = question.match(monthPattern) ?? [];
  if (monthReferences.length < 2) {
    return null;
  }
  const [first, second] = monthReferences;
  return [first!, second!];
}

function questionNamesPeriod(question: string): boolean {
  return /\b(?:january|february|march|april|may|june|july|august|september|october|november|december)\b|\b\d{4}-(?:0[1-9]|1[0-2])\b|\b(?:last month|month before last|the month before|last \d+ months?|this year|last year)\b/i.test(
    question,
  );
}

function comparisonPeriod(
  question: string,
  intent: Record<string, unknown>,
  context: QuestionValidationContext,
): { periods: ComparisonPeriods; range: MonthRange } | { reason: string } {
  let periodA = intent.periodA;
  let periodB = intent.periodB;
  const parsed = compareReferencesFromQuestion(question);
  if (parsed) {
    [periodA, periodB] = parsed;
  } else if (!questionNamesPeriod(question)) {
    periodA = undefined;
    periodB = undefined;
  }

  if (periodA !== undefined && periodB !== undefined) {
    const a = resolvePeriod(periodA, context);
    const b = resolvePeriod(periodB, context);
    if (!b && periodB === "last_year") {
      return { reason: "Last year is not fully covered by the available sales data." };
    }
    const hasFullYearCoverage = (ref: unknown, resolved: MonthRange | null) => {
      if (ref !== "this_year" && ref !== "last_year") {
        return true;
      }
      if (ref === "last_year") {
        return resolved !== null;
      }
      const lastCompleted = getCompletedMonthKeys(
        context.today,
        Math.max(context.today.getUTCMonth() + 1, 1),
      ).filter((month) =>
        month.startsWith(`${context.today.getUTCFullYear()}-`),
      );
      const expected = getMonthKeysBetween(
        `${context.today.getUTCFullYear()}-01`,
        lastCompleted[lastCompleted.length - 1] ?? "",
      );
      return expected.length > 0 &&
        expected.every((month) => context.availableMonths.includes(month));
    };
    if (!a || !periodWithinData(a, context.availableMonths)) {
      return { reason: `Comparison period A is outside available sales data.` };
    }
    if (!b || !periodWithinData(b, context.availableMonths)) {
      return { reason: `Comparison period B is outside available sales data.` };
    }
    if (!hasFullYearCoverage(periodA, a)) {
      return { reason: "This year is not fully covered by the available sales data." };
    }
    if (!hasFullYearCoverage(periodB, b)) {
      return { reason: "Last year is not fully covered by the available sales data." };
    }
    return {
      periods: { a, b },
      range: {
        startMonth: a.startMonth < b.startMonth ? a.startMonth : b.startMonth,
        endMonth: a.endMonth > b.endMonth ? a.endMonth : b.endMonth,
      },
    };
  }

  const base = questionNamesPeriod(question)
    ? resolvePeriod(intent.period, context)
    : rangeForMonths([...context.availableMonths].sort());
  if (!base || !periodWithinData(base, context.availableMonths)) {
    return {
      reason:
        "Name two months or periods that are covered by the available sales data.",
    };
  }
  const months = getMonthKeysBetween(base.startMonth, base.endMonth);
  if (months.length < 2) {
    return { reason: "A comparison needs two months in the available sales data." };
  }
  const split = Math.floor(months.length / 2);
  const a = { startMonth: months[0], endMonth: months[split - 1] };
  const b = { startMonth: months[split], endMonth: months[months.length - 1] };
  return { periods: { a, b }, range: base };
}

function unsupported(question: string, reason: string): QuestionValidation {
  return { supported: false, question, reason };
}

export function validateQuestionIntent(
  questionInput: string,
  intentInput: unknown,
  context: QuestionValidationContext,
): QuestionValidation {
  const question = trimQuestion(questionInput);
  if (!question) {
    return unsupported(question, "Please enter a question about your sales.");
  }
  if (Number.isNaN(context.today.getTime())) {
    throw new RangeError("The current date is invalid.");
  }
  const intent = parseIntent(intentInput);
  if (!intent) {
    return unsupported(question, "I couldn't understand the question classifier's response.");
  }

  const keys = Object.keys(intent);
  if (
    keys.some(
      (key) =>
        !["type", "period", "periodA", "periodB", "item"].includes(key),
    ) ||
    typeof intent.type !== "string" ||
    !QUESTION_TYPES.includes(intent.type as QuestionType) ||
    (intent.item !== undefined &&
      intent.item !== null &&
      typeof intent.item !== "string")
  ) {
    return unsupported(question, "I couldn't understand the question classifier's intent shape.");
  }

  const type = intent.type as QuestionType;
  if (type === "unsupported") {
    return unsupported(
      question,
      "I can help with sales totals, comparing sales, the best or slowest month or week, and how an item is trending.",
    );
  }

  let range: MonthRange;
  let comparison: ComparisonPeriods | undefined;
  if (type === "compare_periods") {
    const resolved = comparisonPeriod(question, intent, context);
    if ("reason" in resolved) {
      return unsupported(question, resolved.reason);
    }
    comparison = resolved.periods;
    range = resolved.range;
  } else if (
    intent.period === undefined ||
    (!questionNamesPeriod(question) &&
      !context.useIntentPeriodWithoutQuestionPeriod)
  ) {
    const available = [...context.availableMonths].sort();
    const allMonths = rangeForMonths(available);
    if (!allMonths) {
      return unsupported(question, "There are no completed months in the available sales data.");
    }
    range = allMonths;
  } else {
    const resolved = resolvePeriod(intent.period, context);
    if (!resolved || !periodWithinData(resolved, context.availableMonths)) {
      return unsupported(
        question,
        "That period is outside the available sales data.",
      );
    }
    range = resolved;
  }

  if (type === "what_changed") {
    const targetMonth = range.endMonth;
    const [yearText, monthText] = targetMonth.split("-");
    const previousDate = new Date(
      Date.UTC(Number(yearText), Number(monthText) - 2, 1),
    );
    const previousMonth = `${previousDate.getUTCFullYear()}-${String(
      previousDate.getUTCMonth() + 1,
    ).padStart(2, "0")}`;
    if (
      !context.availableMonths.includes(targetMonth) ||
      !context.availableMonths.includes(previousMonth)
    ) {
      return unsupported(
        question,
        "I need this month and the previous completed month to show what changed.",
      );
    }
    range = { startMonth: previousMonth, endMonth: targetMonth };
  }

  let item: string | undefined;
  if (typeof intent.item === "string" && intent.item.trim()) {
    const requestedItem = intent.item.trim().toLocaleLowerCase();
    item = context.itemNames.find(
      (name) => name.toLocaleLowerCase() === requestedItem,
    );
    if (!item) {
      return unsupported(
        question,
        "I couldn't find that item in the sales data. Try an item name shown in the demo.",
      );
    }
  }
  if (type === "item_trend" && !item) {
    return unsupported(
      question,
      "Tell me which item you want to compare, using its name from the sales data.",
    );
  }

  const periodLabel = comparison
    ? `${formatNaturalPeriod(comparison.a)} vs ${formatNaturalPeriod(comparison.b)}`
    : formatNaturalPeriod(range);

  return {
    supported: true,
    question: {
      question,
      type,
      range,
      ...(comparison ? { comparison } : {}),
      periodWasImplicit: !questionNamesPeriod(question),
      ...(item ? { item } : {}),
      periodLabel,
      granularity:
        type === "best_worst_period" && /\bweeks?\b/i.test(question)
          ? "week"
          : "month",
    },
  };
}
