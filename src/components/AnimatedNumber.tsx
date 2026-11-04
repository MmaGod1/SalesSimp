"use client";

import { useEffect, useState } from "react";

type AnimatedNumberProps = {
  value: number;
  format: (value: number) => string;
};

export function AnimatedNumber({ value, format }: AnimatedNumberProps) {
  const [displayedValue, setDisplayedValue] = useState(value);

  useEffect(() => {
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    );
    let frame = 0;
    let completionTimer = 0;
    let startTime: number | null = null;
    const finish = () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(completionTimer);
      setDisplayedValue(value);
    };

    if (reducedMotion.matches) {
      frame = window.requestAnimationFrame(finish);
      return () => window.cancelAnimationFrame(frame);
    }

    const animate = (timestamp: number) => {
      if (startTime === null) {
        startTime = timestamp;
        setDisplayedValue(0);
      }

      const progress = Math.min((timestamp - startTime) / 700, 1);
      const eased = 1 - (1 - progress) ** 3;
      setDisplayedValue(
        progress === 1 ? value : Math.round(value * eased),
      );
      if (progress < 1) {
        frame = window.requestAnimationFrame(animate);
      }
    };

    const handleMotionChange = (event: MediaQueryListEvent) => {
      if (event.matches) {
        finish();
      }
    };

    reducedMotion.addEventListener("change", handleMotionChange);
    frame = window.requestAnimationFrame(animate);
    completionTimer = window.setTimeout(finish, 750);
    return () => {
      reducedMotion.removeEventListener("change", handleMotionChange);
      window.cancelAnimationFrame(frame);
      window.clearTimeout(completionTimer);
    };
  }, [value]);

  return (
    <span aria-label={format(value)} aria-live="off">
      {format(displayedValue)}
    </span>
  );
}
