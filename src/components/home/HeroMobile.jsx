// Phones (<640px): one screen, text first, then a swipe carousel.
//
// The carousel is a real scroll-snap track: each card is 80vw so the next one
// peeks in, the active card is kept centred, and the dots below it drive the
// shared slide index. Autoplay (from useHero) scrolls the track; touching it
// pauses autoplay because the parent section pauses on touch.
import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import Reveal from "../ui/Reveal.jsx";
import { ArrowIcon } from "./ArrowIcon.jsx";

export default function HeroMobile({
  slides,
  active,
  setActive,
  BTN_SLANT,
  pad,
  reducedMotion,
}) {
  const track = useRef(null);
  const fromScroll = useRef(false);
  const settle = useRef(null);
  const slide = slides[active];

  // Keep the active card centred (autoplay + dot clicks). Swipes already move
  // the track, so that update is skipped to avoid fighting the finger.
  useEffect(() => {
    if (fromScroll.current) {
      fromScroll.current = false;
      return;
    }
    const element = track.current;
    const card = element?.children?.[active];
    if (!element || !card) return;
    element.scrollTo({
      left: card.offsetLeft - (element.clientWidth - card.offsetWidth) / 2,
      behavior: reducedMotion ? "auto" : "smooth",
    });
  }, [active, reducedMotion]);

  // A swipe settles on the nearest card — that card becomes the active slide.
  // Debounced until scrolling stops so the smooth scroll that follows autoplay
  // (or a dot click) can't flicker the shared index while it is in flight.
  function onScroll() {
    window.clearTimeout(settle.current);
    settle.current = window.setTimeout(() => {
      const element = track.current;
      if (!element) return;
      const centre = element.scrollLeft + element.clientWidth / 2;
      let best = active;
      let bestDistance = Infinity;
      [...element.children].forEach((card, index) => {
        const distance = Math.abs(
          card.offsetLeft + card.offsetWidth / 2 - centre,
        );
        if (distance < bestDistance) {
          bestDistance = distance;
          best = index;
        }
      });
      if (best !== active) {
        fromScroll.current = true;
        setActive(best);
      }
    }, 120);
  }

  useEffect(() => () => window.clearTimeout(settle.current), []);

  return (
    <div className="relative z-10 flex min-h-svh flex-col justify-center gap-4 px-6 pb-6 pt-24">
      <Reveal
        direction="up"
        distance={40}
        duration={800}
        className="text-center [&>div]:w-full"
      >
        <div className="flex items-center justify-center gap-2">
          <span className="flex items-center gap-1.5" aria-hidden="true">
            <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
            <span className="h-1.5 w-1.5 rounded-full bg-sky-400/40" />
            <span className="h-1.5 w-1.5 rounded-full bg-sky-400/20" />
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-300">
            {slide.tag}
          </span>
        </div>

        <h1 className="mx-auto mt-3 max-w-[22rem] font-['Fraunces',serif] text-[2.35rem] font-bold leading-[1.08] tracking-tight text-white">
          {slide.title}
        </h1>

        <p className="mx-auto mt-3 max-w-[22rem] text-sm leading-relaxed text-slate-200">
          {slide.description}
        </p>

        <Link
          to={slide.to}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 bg-white px-5 py-3.5 text-sm font-semibold text-navy transition-colors hover:bg-sky-400 active:scale-[0.99]"
          style={{ clipPath: BTN_SLANT }}
        >
          {slide.cta}
          <ArrowIcon />
        </Link>
      </Reveal>

      <Reveal
        direction="up"
        distance={40}
        duration={800}
        delay={150}
        className="[&>div]:w-full"
      >
        {/* Swipe cards: 80vw each, snapping centred, no scrollbar. */}
        <div
          ref={track}
          onScroll={onScroll}
          className="-mx-6 flex snap-x snap-mandatory gap-3 overflow-x-auto px-6 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {slides.map((s, i) => {
            const on = i === active;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setActive(i)}
                aria-label={s.title}
                aria-current={on}
                className={`relative h-44 w-[80vw] shrink-0 snap-center overflow-hidden rounded-2xl border text-left transition-colors ${
                  on ? "border-white/80" : "border-white/20"
                }`}
              >
                <img
                  src={s.background}
                  srcSet={s.backgroundSrcSet}
                  sizes="80vw"
                  alt=""
                  aria-hidden="true"
                  loading="lazy"
                  decoding="async"
                  className="absolute inset-0 h-full w-full object-cover object-center"
                />
                <span className="absolute inset-0 bg-gradient-to-t from-navy/95 via-navy/35 to-transparent" />
                <span className="absolute left-3 top-3 flex h-7 min-w-7 items-center justify-center rounded-full bg-white px-1.5 text-[11px] font-bold text-navy">
                  {pad(i)}
                </span>
                <span className="absolute inset-x-0 bottom-0 block p-4">
                  <span className="block text-[10px] font-semibold uppercase tracking-[0.16em] text-sky-300">
                    {s.stat.label}
                  </span>
                  <span className="mt-1 block font-['Fraunces',serif] text-lg font-bold leading-tight text-white">
                    {s.stat.value}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        {/* Dot indicators replace the arrows and the counter on phones. */}
        <div className="mt-2 flex items-center justify-center gap-2">
          {slides.map((s, i) => {
            const on = i === active;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setActive(i)}
                aria-label={`Show ${s.title}`}
                aria-current={on}
                className={`h-1.5 rounded-full transition-all ${
                  on ? "w-6 bg-sky-400" : "w-1.5 bg-white/40"
                }`}
              />
            );
          })}
        </div>

        {/* The secondary link lives on its own small line at the bottom. */}
        <div className="mt-1.5 flex justify-center">
          {slide.secondary.to ? (
            <Link
              to={slide.secondary.to}
              className="text-xs font-semibold text-white/70 transition-colors hover:text-sky-300"
            >
              {slide.secondary.label}
            </Link>
          ) : (
            <span className="text-xs text-white/50">
              {slide.secondary.label}
            </span>
          )}
        </div>
      </Reveal>
    </div>
  );
}
