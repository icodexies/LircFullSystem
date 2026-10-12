
import { useEffect, useRef, useState } from "react";
import { REVEAL_EASINGS } from "./revealEasings.js";
import { useReducedMotion } from "../../hooks/shared/useReducedMotion.js";

/* -------------------------------------------------------------------------- */
/*                              Reveal Component                             */
/* -------------------------------------------------------------------------- */

function Reveal({
  children,
  direction = "up",
  delay = 0,
  duration = 700,
  distance = 64,
  threshold = 0.1,
  once = false,
  easing = REVEAL_EASINGS.smooth,
  className = "",
}) {
  const reducedMotion = useReducedMotion();
  const [isVisible, setIsVisible] = useState(
    () => !("IntersectionObserver" in window)
  );
  const ref = useRef(null);

  useEffect(() => {
    const element = ref.current;

    if (!element || reducedMotion || !("IntersectionObserver" in window)) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);

          if (once) {
            observer.unobserve(element);
          }
        } else if (!once) {
          setIsVisible(false);
        }
      },
      {
        threshold,
        rootMargin: "0px 0px -80px 0px",
      }
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, [threshold, once, reducedMotion]);

  const visible = isVisible || reducedMotion;

  /* ------------------------------------------------------------------------ */
  /*                              Directions                                  */
  /* ------------------------------------------------------------------------ */

  const transforms = {
    up: `translateY(${distance}px)`,
    down: `translateY(-${distance}px)`,
    left: `translateX(${distance}px)`,
    right: `translateX(-${distance}px)`,
    fade: "none",
    zoom: "scale(0.92)",
    zoomUp: `translateY(${distance}px) scale(0.96)`,
    zoomDown: `translateY(-${distance}px) scale(0.96)`,
    zoomLeft: `translateX(${distance}px) scale(0.96)`,
    zoomRight: `translateX(-${distance}px) scale(0.96)`,
    blur: "scale(0.98)",
  };

  /* ------------------------------------------------------------------------ */
  /*                                Render                                    */
  /* ------------------------------------------------------------------------ */

  return (
    <div ref={ref} className={className}>
      <div
        style={{
          transform: visible
            ? "translate3d(0, 0, 0) scale(1)"
            : transforms[direction] || transforms.up,

          opacity: visible ? 1 : 0,

          filter:
            direction === "blur"
              ? visible ? "blur(0)" : "blur(8px)"
              : undefined,

          transitionProperty: "transform, opacity, filter",
          transitionDuration: reducedMotion ? "0ms" : `${duration}ms`,
          transitionTimingFunction: REVEAL_EASINGS[easing] ?? easing,
          transitionDelay: visible && !reducedMotion ? `${delay}ms` : "0ms",

        }}
      >
        {children}
      </div>
    </div>
  );
}

export default Reveal;
