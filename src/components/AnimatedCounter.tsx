import { useEffect, useState } from 'react';
import { useReducedMotion } from 'motion/react';

interface AnimatedCounterProps {
  value: number;
  prefix?: string;
  decimals?: number;
}

export function AnimatedCounter({ value, prefix = '', decimals = 0 }: AnimatedCounterProps) {
  const reduceMotion = useReducedMotion();
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    if (reduceMotion) {
      setDisplay(value);
      return;
    }

    const start = 0;
    const duration = 450;
    const startTime = performance.now();
    let rafId = 0;

    const tick = (now: number) => {
      const progress = Math.min(1, (now - startTime) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(start + (value - start) * eased);
      if (progress < 1) {
        rafId = requestAnimationFrame(tick);
      }
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [value, reduceMotion]);

  const formatted =
    decimals > 0
      ? display.toLocaleString('en-US', {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        })
      : Math.round(display).toLocaleString('en-US');

  return (
    <span className="font-mono tabular-nums">
      {prefix}
      {formatted}
    </span>
  );
}
