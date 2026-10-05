import { useState, useEffect, useCallback } from "react";
import { slides } from "../data/heroSlides";

const BTN_SLANT =
  "polygon(12px 0, 100% 0, calc(100% - 12px) 100%, 0 100%)";
  
const AUTOPLAY_MS = 6000;
export function useHero(){

    const [active, setActive] = useState(0);
    const [paused, setPaused] = useState(false);

    const next = useCallback(
        () => setActive((i) => (i + 1) % slides.length),
        []
    );
    
    const prev = () =>
        setActive((i) => (i - 1 + slides.length) % slides.length);

    useEffect(() => {
        if (paused) return;
    
        const t = setTimeout(next, AUTOPLAY_MS);
    
        return () => clearTimeout(t);
      }, [active, paused, next]);


    return{
        active,
        paused,
        next,
        prev,
        setActive,
        BTN_SLANT,
        setPaused,
        slides
    }
}