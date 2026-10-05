import { useState } from "react";
import { DIGITAL_SOURCES } from "../data/digitalSources";

export function useDigitalSources() {
  const [activeIndex, setActiveIndex] = useState(0);

  const select = (id) => {
    const index = DIGITAL_SOURCES.findIndex((s) => s.id === id);
    if (index !== -1) setActiveIndex(index);
  };

  return {
    sources: DIGITAL_SOURCES,
    activeIndex,
    active: DIGITAL_SOURCES[activeIndex],
    select,
  };
}