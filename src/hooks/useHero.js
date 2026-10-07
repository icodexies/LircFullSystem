import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { HERO_SLIDES } from "../data/heroSlides";
import { useCarousel } from "./useCarousel";
import { useReducedMotion } from "./useReducedMotion";

const BTN_SLANT = "polygon(12px 0, 100% 0, calc(100% - 12px) 100%, 0 100%)";
const AUTOPLAY_MS = 6000;

function subscribeVisibility(onChange) {
  document.addEventListener("visibilitychange", onChange);
  return () => document.removeEventListener("visibilitychange", onChange);
}

function isPageVisible() {
  return !document.hidden;
}

export function useHero() {
  const heroRef = useRef(null);
  const [heroVisible, setHeroVisible] = useState(true);
  const [paused, setPaused] = useState(false);
  const reducedMotion = useReducedMotion();
  const pageVisible = useSyncExternalStore(subscribeVisibility, isPageVisible, () => true);
  const { activeIndex, setActive, step } = useCarousel(HERO_SLIDES);

  useEffect(() => {
    if (!heroRef.current || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(([entry]) => {
      setHeroVisible(entry.isIntersecting);
    });
    observer.observe(heroRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (paused || reducedMotion || !pageVisible || !heroVisible || HERO_SLIDES.length < 2) return;

    const timer = setTimeout(() => {
      setActive((index) => (index + 1) % HERO_SLIDES.length);
    }, AUTOPLAY_MS);

    return () => clearTimeout(timer);
  }, [activeIndex, paused, reducedMotion, pageVisible, heroVisible, setActive]);

  return {
    heroRef,
    active: activeIndex,
    paused,
    next: () => step(1),
    prev: () => step(-1),
    setActive,
    BTN_SLANT,
    setPaused,
    slides: HERO_SLIDES,
  };
}
