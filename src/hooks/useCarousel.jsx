import { useCallback, useEffect, useState } from "react";

function useHeroCarousel(length, autoplayMs = 6000) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  const next = useCallback(() => {
    setActive((current) => (current + 1) % length);
  }, [length]);

  const prev = useCallback(() => {
    setActive((current) => (current - 1 + length) % length);
  }, [length]);

  const goTo = useCallback((index) => {
    setActive(index);
  }, []);

  useEffect(() => {
    if (paused || length <= 1) return;

    const timer = setTimeout(next, autoplayMs);

    return () => clearTimeout(timer);
  }, [active, paused, next, autoplayMs, length]);

  return {
    active,
    next,
    prev,
    goTo,
    paused,
    setPaused,
  };
}

export default useHeroCarousel;