import { useState } from "react";

// Shared selection and wrap-around behavior for the home page carousels.
export function useCarousel(items) {
  const [index, setActive] = useState(0);
  const activeIndex = Math.max(0, Math.min(index, items.length - 1));

  function select(id) {
    const nextIndex = items.findIndex((item) => item.id === id);
    if (nextIndex !== -1) setActive(nextIndex);
  }

  function step(direction) {
    if (items.length === 0) return;

    setActive((currentIndex) => {
      const index = Math.max(0, Math.min(currentIndex, items.length - 1));
      return ((index + direction) % items.length + items.length) % items.length;
    });
  }

  return {
    activeIndex,
    selected: items[activeIndex] ?? null,
    select,
    step,
    setActive,
  };
}
