"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { buildAskExamples } from "@/lib/askExamples";
import type { ConversationTurn, ResolvedIntent } from "@/lib/questions";
import type { AskApiResponse, Sale } from "@/lib/types";
import { Story } from "./Story";

type AskBoxProps = {
  sales: Sale[];
  today: Date;
  completedThrough: string;
  onResolvedPeriod: (period: { startMonth: string; endMonth: string }) => void;
};

type ChatMessage =
  | { id: number; role: "user"; text: string }
  | { id: number; role: "assistant"; response: AskApiResponse };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isAskSentence(
  value: unknown,
): value is AskApiResponse["sentences"][number] {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.text === "string" &&
    ["up", "down", "neutral"].includes(
      typeof value.tone === "string" ? value.tone : "",
    ) &&
    Array.isArray(value.numbers) &&
    value.numbers.every(
      (number) =>
        isRecord(number) &&
        typeof number.label === "string" &&
        typeof number.value === "string",
    )
  );
}

function isMonthRange(
  value: unknown,
): value is { startMonth: string; endMonth: string } {
  return (
    isRecord(value) &&
    typeof value.startMonth === "string" &&
    /^\d{4}-(0[1-9]|1[0-2])$/.test(value.startMonth) &&
    typeof value.endMonth === "string" &&
    /^\d{4}-(0[1-9]|1[0-2])$/.test(value.endMonth) &&
    value.startMonth <= value.endMonth
  );
}

function isResolvedIntent(value: unknown): value is ResolvedIntent {
  if (
    !isRecord(value) ||
    !["compare_periods", "best_worst_period", "item_trend", "totals", "what_changed"].includes(
      typeof value.type === "string" ? value.type : "",
    )
  ) {
    return false;
  }
  return (
    (value.period === undefined || isMonthRange(value.period)) &&
    (value.periodA === undefined || isMonthRange(value.periodA)) &&
    (value.periodB === undefined || isMonthRange(value.periodB)) &&
    (value.item === undefined || typeof value.item === "string")
  );
}

function isStringList(value: unknown): value is string[] | undefined {
  return (
    value === undefined ||
    (Array.isArray(value) && value.every((item) => typeof item === "string"))
  );
}

function isAskResponse(value: unknown): value is AskApiResponse {
  if (!isRecord(value)) {
    return false;
  }
  return (
    ["answered", "unsupported", "clarify", "error"].includes(
      typeof value.status === "string" ? value.status : "",
    ) &&
    typeof value.periodLabel === "string" &&
    Array.isArray(value.sentences) &&
    value.sentences.every(isAskSentence) &&
    (value.resolvedPeriod === null || isMonthRange(value.resolvedPeriod)) &&
    (value.source === "ai" || value.source === "template") &&
    (value.message === undefined || typeof value.message === "string") &&
    isStringList(value.suggestedQuestions) &&
    isStringList(value.followUpQuestions) &&
    (value.resolvedIntent === undefined ||
      value.resolvedIntent === null ||
      isResolvedIntent(value.resolvedIntent))
  );
}

function capMessages(messages: ChatMessage[]): ChatMessage[] {
  return messages.slice(-20);
}

function errorResponse(message: string): AskApiResponse {
  return {
    status: "error",
    periodLabel: "Your sales",
    sentences: [],
    resolvedPeriod: null,
    source: "template",
    message,
  };
}

export function AskBox({
  sales,
  today,
  completedThrough,
  onResolvedPeriod,
}: AskBoxProps) {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationTurns, setConversationTurns] = useState<ConversationTurn[]>([]);
  const [loading, setLoading] = useState(false);
  const nextId = useRef(0);
  const newestAnswerRef = useRef<HTMLElement | null>(null);
  const threadRef = useRef<HTMLDivElement | null>(null);
  const pendingScrollRef = useRef(false);
  const preserveScrollTopRef = useRef(0);
  const shouldAutoScrollRef = useRef(true);

  const examples = useMemo(
    () => buildAskExamples(sales, today),
    [sales, today],
  );

  useEffect(() => {
    const newest = messages[messages.length - 1];
    const thread = threadRef.current;
    if (newest?.role === "assistant" && pendingScrollRef.current && thread) {
      const reducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      if (shouldAutoScrollRef.current) {
        const answer = newestAnswerRef.current;
        if (answer) {
          const top =
            answer.getBoundingClientRect().top -
            thread.getBoundingClientRect().top +
            thread.scrollTop;
          thread.scrollTo({
            top,
            behavior: reducedMotion ? "instant" : "smooth",
          });
        }
      } else {
        thread.scrollTop = preserveScrollTopRef.current;
      }
      pendingScrollRef.current = false;
    } else if (loading && newest?.role === "user" && thread) {
      if (shouldAutoScrollRef.current) {
        const reducedMotion = window.matchMedia(
          "(prefers-reduced-motion: reduce)",
        ).matches;
        thread.scrollTo({
          top: thread.scrollHeight,
          behavior: reducedMotion ? "instant" : "smooth",
        });
      } else {
        thread.scrollTop = preserveScrollTopRef.current;
      }
    }
  }, [loading, messages]);

  async function submitQuestion(value = question) {
    const trimmed = value.trim().slice(0, 300);
    if (!trimmed || loading) {
      return;
    }
    const thread = threadRef.current;
    if (thread) {
      const distanceFromBottom =
        thread.scrollHeight - thread.clientHeight - thread.scrollTop;
      shouldAutoScrollRef.current = distanceFromBottom <= 80;
      preserveScrollTopRef.current = thread.scrollTop;
    } else {
      shouldAutoScrollRef.current = true;
    }
    pendingScrollRef.current = true;
    setQuestion("");
    setLoading(true);
    setMessages((current) =>
      capMessages([
        ...current,
        { id: nextId.current++, role: "user", text: trimmed },
      ]),
    );
    try {
      const result = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: trimmed,
          previousTurns: conversationTurns.slice(-3),
        }),
      });
      const payload: unknown = await result.json();
      if (!isAskResponse(payload)) {
        throw new Error("The answer could not be read. Please try again.");
      }
      if (!result.ok && payload.status !== "error") {
        throw new Error("The answer could not be loaded. Please try again.");
      }
      setMessages((current) =>
        capMessages([
          ...current,
          { id: nextId.current++, role: "assistant", response: payload },
        ]),
      );
      if (payload.status === "answered" && payload.resolvedIntent) {
        setConversationTurns((current) =>
          [
            ...current,
            { question: trimmed, intent: payload.resolvedIntent! },
          ].slice(-3),
        );
      }
      if (payload.status === "answered" && payload.resolvedPeriod) {
        onResolvedPeriod(payload.resolvedPeriod);
      }
    } catch (error) {
      setMessages((current) =>
        capMessages([
          ...current,
          {
            id: nextId.current++,
            role: "assistant",
            response: errorResponse(
              error instanceof Error
                ? error.message
                : "Something went wrong. Please try again.",
            ),
          },
        ]),
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <section aria-label="Ask about your sales" className="ask-box">
      <header className="ask-header">
        <h2>Ask about your sales</h2>
        <button
          className="clear-conversation"
          disabled={loading || messages.length === 0}
          onClick={() => {
            setMessages([]);
            setConversationTurns([]);
          }}
          type="button"
        >
          Clear conversation
        </button>
      </header>

      <div
        aria-label="Conversation"
        className="chat-thread"
        ref={threadRef}
        tabIndex={0}
      >
        {messages.length === 0 && (
          <div className="chat-welcome">
            <p>Hi! Ask me about your completed sales, or try one of these:</p>
            <div aria-label="Example questions" className="ask-examples">
              {examples.slice(0, 4).map(({ question: example }) => (
                <button
                  disabled={loading}
                  key={example}
                  onClick={() => void submitQuestion(example)}
                  type="button"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((message, index) =>
          message.role === "user" ? (
            <p className="chat-user-message" key={message.id}>
              {message.text}
            </p>
          ) : (
            <article
              aria-live="polite"
              className="chat-assistant-message"
              key={message.id}
              ref={
                index === messages.length - 1
                  ? (element) => {
                      newestAnswerRef.current = element;
                    }
                  : undefined
              }
            >
              <h3>{message.response.periodLabel}</h3>
              {message.response.status === "answered" &&
              message.response.sentences.length > 0 ? (
                <>
                  <Story
                    animationKey={`answer-${message.id}`}
                    idPrefix={`answer-${message.id}-`}
                    onPanelOpen={() => undefined}
                    pulseFirstButton={false}
                    sentences={message.response.sentences}
                  />
                  {message.response.followUpQuestions &&
                    message.response.followUpQuestions.length > 0 && (
                      <div
                        aria-label="Suggested follow-up questions"
                        className="ask-examples chat-examples"
                      >
                        {message.response.followUpQuestions.map((example) => (
                          <button
                            disabled={loading}
                            key={example}
                            onClick={() => void submitQuestion(example)}
                            type="button"
                          >
                            {example}
                          </button>
                        ))}
                      </div>
                    )}
                </>
              ) : (
                <>
                  <p className="ask-message">
                    {message.response.message ??
                      "I can help with sales totals, comparing sales, the best or slowest month or week, and an item's trend."}
                  </p>
                  {(message.response.status === "unsupported" ||
                    message.response.status === "clarify" ||
                    message.response.suggestedQuestions !== undefined) && (
                    <div
                      aria-label="Example questions"
                      className="ask-examples chat-examples"
                    >
                      {(message.response.suggestedQuestions ??
                        examples.map(({ question: example }) => example)
                      ).map((example) => (
                        <button
                          disabled={loading}
                          key={example}
                          onClick={() => void submitQuestion(example)}
                          type="button"
                        >
                          {example}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </article>
          ),
        )}

        {loading && (
          <div className="chat-typing" role="status">
            <span aria-hidden="true" className="typing-dots">
              <i />
              <i />
              <i />
            </span>
            <span>Looking at your sales...</span>
          </div>
        )}
      </div>

      <footer className="ask-composer">
        <p className="ask-completed-note">
          Showing completed months only, through {completedThrough}.
        </p>
        <form
          className="ask-form"
          onSubmit={(event) => {
            event.preventDefault();
            void submitQuestion();
          }}
        >
          <label className="visually-hidden" htmlFor="sales-question">
            Ask about your sales
          </label>
          <input
            autoComplete="off"
            id="sales-question"
            maxLength={300}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Ask a question about your sales"
            type="text"
            value={question}
          />
          <button disabled={loading || !question.trim()} type="submit">
            Ask
          </button>
        </form>
      </footer>
    </section>
  );
}
