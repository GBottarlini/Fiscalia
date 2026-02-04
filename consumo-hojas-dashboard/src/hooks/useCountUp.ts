import { useEffect, useRef, useState } from "react";

export function useCountUp(value: number, duration = 800) {
  const [current, setCurrent] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const start = performance.now();
    const from = current;
    const delta = value - from;

    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      setCurrent(from + delta * progress);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [value, duration]);

  return current;
} 
