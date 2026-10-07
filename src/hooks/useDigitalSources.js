import { DIGITAL_SOURCES } from "../data/digitalSources";
import { useCarousel } from "./useCarousel";

export function useDigitalSources() {
  const carousel = useCarousel(DIGITAL_SOURCES);

  return {
    sources: DIGITAL_SOURCES,
    activeIndex: carousel.activeIndex,
    active: carousel.selected,
    select: carousel.select,
  };
}
