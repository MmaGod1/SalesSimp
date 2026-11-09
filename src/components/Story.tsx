import { useState, type CSSProperties } from "react";
import { AnimatedNumber } from "./AnimatedNumber";
import type { StorySentence } from "@/lib/story";

type StoryProps = {
  sentences: StorySentence[];
  animationKey: string;
  idPrefix?: string;
  pulseFirstButton: boolean;
  onPanelOpen: () => void;
};

function TrendIcon({ direction }: { direction: "up" | "down" | "neutral" }) {
  const path =
    direction === "up"
      ? "m5 14 5-5 3 3 6-7M14 5h5v5"
      : direction === "down"
        ? "m5 6 5 5 3-3 6 7m-5 0h5V10"
        : "M5 12h14";

  return (
    <svg
      aria-hidden="true"
      className={`trend-icon trend-icon-${direction}`}
      fill="none"
      height="24"
      viewBox="0 0 24 24"
      width="24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d={path}
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

export function Story({
  sentences,
  animationKey,
  idPrefix = "",
  pulseFirstButton,
  onPanelOpen,
}: StoryProps) {
  return (
    <div className="story-list" key={animationKey}>
      {sentences.map((sentence, index) => (
        <StoryCard
          key={sentence.id}
          idPrefix={idPrefix}
          onPanelOpen={onPanelOpen}
          pulseButton={pulseFirstButton && index === 0}
          sentence={sentence}
          staggerIndex={index}
        />
      ))}
    </div>
  );
}

function StoryCard({
  sentence,
  idPrefix,
  staggerIndex,
  pulseButton,
  onPanelOpen,
}: {
  sentence: StorySentence;
  idPrefix: string;
  staggerIndex: number;
  pulseButton: boolean;
  onPanelOpen: () => void;
}) {
  const panelId = `${idPrefix}numbers-${sentence.id}`;
  const [isOpen, setIsOpen] = useState(false);
  const sentenceStyle = {
    "--stagger-index": staggerIndex,
  } as CSSProperties;
  const pieces = sentence.countUpPercent !== undefined
    ? sentence.text.split(/(\d+%)/g)
    : [sentence.text];

  return (
    <article
      className={`story-sentence story-sentence-${sentence.tone}`}
      style={sentenceStyle}
    >
      <div className="sentence-copy">
        <TrendIcon direction={sentence.tone} />
        <p>
          {pieces.map((piece, index) =>
            sentence.countUpPercent !== undefined &&
            /^\d+%$/.test(piece) &&
            Number.parseInt(piece, 10) === sentence.countUpPercent ? (
              <span key={index} className="growth-value">
                <AnimatedNumber
                  format={(value) => `${value}%`}
                  value={sentence.countUpPercent}
                />
              </span>
            ) : (
              piece
            ),
          )}
        </p>
      </div>
      <button
        aria-controls={panelId}
        aria-expanded={isOpen}
        className={`numbers-toggle${pulseButton ? " numbers-toggle-pulse" : ""}`}
        onClick={() => {
          setIsOpen((open) => !open);
          if (!isOpen) {
            onPanelOpen();
          }
        }}
        type="button"
      >
        <span>{isOpen ? "Hide numbers" : "Show numbers"}</span>
        <svg
          aria-hidden="true"
          className={`numbers-chevron${isOpen ? " numbers-chevron-open" : ""}`}
          fill="none"
          height="18"
          viewBox="0 0 24 24"
          width="18"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="m6 9 6 6 6-6"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
          />
        </svg>
      </button>
      <div
        aria-hidden={!isOpen}
        className={`numbers-panel${isOpen ? " numbers-panel-open" : ""}`}
        id={panelId}
      >
        <dl>
          {sentence.numbers.map((number, index) => (
            <div
              className="number-row"
              key={number.label}
              style={{ "--stagger-index": index } as CSSProperties}
            >
              <dt>{number.label}</dt>
              <dd>{number.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </article>
  );
}
