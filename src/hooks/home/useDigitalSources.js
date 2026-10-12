import { DIGITAL_SOURCES } from "../../data/home/digitalSources.js";
import { useCarousel } from "../shared/useCarousel.js";

export function useDigitalSources() {
  const carousel = useCarousel(DIGITAL_SOURCES);

  return {
    sources: DIGITAL_SOURCES,
    activeIndex: carousel.activeIndex,
    active: carousel.selected,
    select: carousel.select,
  };
}
