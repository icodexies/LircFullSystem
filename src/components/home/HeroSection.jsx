import { Link } from "react-router-dom";
import { useRef } from "react";
import Reveal from "../ui/Reveal.jsx";
import { ArrowIcon } from "./ArrowIcon.jsx";

// Base classes = small screens (centered, smaller). `sm:` / `lg:` restore the
// original desktop look (left-aligned, bigger).

export function HeroBG({ slides = [], active }) {
  return (
    <>
      {slides.map((s, i) => (
          <img
            key={s.id}
            src={s.background}
            srcSet={s.backgroundSrcSet}
            sizes="100vw"
            width={s.backgroundWidth}
            height={s.backgroundHeight}
            alt=""
            aria-hidden="true"
            fetchPriority={i === 0 ? "high" : "auto"}
            loading={i === 0 ? "eager" : "lazy"}
            decoding="async"
            className={`absolute inset-0 h-full w-full object-cover object-center transition-all duration-1000 ease-out ${
              i === active ? "scale-100 opacity-100" : "scale-110 opacity-0"
            }`}
          />
      ))}
    </>
  );
}

export function LeftSide({ slides = [], active, BTN_SLANT }) {
  return (
    <>
      <Reveal
        direction="left"
        distance={60}
        duration={900}
        delay={150}
        threshold={0.1}
        // [&>div]:w-full makes Reveal's inner wrapper full width so text-center works
        className="flex flex-col justify-center text-center xl:flex-1 xl:pb-10 xl:text-left [&>div]:w-full"
      >
        <div className="grid">
          {slides.map((s, i) => {
            const on = i === active;

            return (
              <div
                key={s.id}
                aria-hidden={!on}
                className={`col-start-1 row-start-1 transition-all duration-700 ${
                  on
                    ? "translate-y-0 opacity-100"
                    : "pointer-events-none translate-y-6 opacity-0"
                }`}
              >
                {/* Tag */}
                <div className="flex items-center justify-center gap-2 sm:gap-3 lg:justify-start">
                  <div className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
                    <span className="h-1.5 w-1.5 rounded-full bg-sky-400/40" />
                    <span className="h-1.5 w-1.5 rounded-full bg-sky-400/20" />
                  </div>

                  <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-300 sm:text-[11px] xl:text-xs">
                    {s.tag}
                  </span>
                </div>

                {/* Title */}
                <h1 className="mx-auto mt-4 max-w-2xl font-['Fraunces',serif] text-[2.35rem] font-bold leading-[1.08] tracking-tight text-white sm:mt-6 sm:text-5xl lg:text-6xl xl:mx-0 xl:mt-8 xl:text-[5.5rem] xl:leading-[1.03]">
                  {s.title}
                </h1>

                {/* Description */}
                <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-slate-200 sm:mt-5 sm:text-base xl:mx-0 xl:mt-6 xl:max-w-lg xl:text-lg">
                  {s.description}
                </p>

                {/* Buttons — stacked full-width on phones, inline from sm up */}
                <div className="mt-6 flex flex-col items-stretch gap-2 sm:mt-8 sm:flex-row sm:flex-wrap sm:items-center sm:justify-center sm:gap-3 xl:mt-10 xl:justify-start">
                  <Link
                    to={s.to}
                    tabIndex={on ? 0 : -1}
                    className="inline-flex items-center justify-center gap-2 bg-white px-5 py-3 text-sm font-semibold text-navy transition-all duration-300 hover:bg-sky-400 active:scale-95 sm:justify-start sm:px-7 sm:py-3 xl:px-8 xl:py-4 xl:text-base"
                    style={{
                      clipPath: BTN_SLANT,
                    }}
                  >
                    {s.cta}

                    <ArrowIcon />
                  </Link>

                  {s.secondary.to ? <Link
                    to={s.secondary.to}
                    tabIndex={on ? 0 : -1}
                    className="px-3 py-2.5 text-center text-sm font-semibold text-white transition-all duration-300 hover:-translate-y-0.5 hover:text-sky-300 sm:px-4 sm:py-3 xl:px-5 xl:py-4 xl:text-base"
                  >
                    {s.secondary.label}
                  </Link> : (
                    <button
                      type="button"
                      disabled
                      title="Thesis submissions are not available yet"
                      className="px-3 py-2.5 text-center text-sm font-semibold text-white transition-all duration-300 sm:px-4 sm:py-3 xl:px-5 xl:py-4 xl:text-base"
                    >
                      {s.secondary.label}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Reveal>
    </>
  );
}

export function RightSide({ slides = [], active, next, prev, setActive, pad }) {
  const touchStart = useRef(null);
  return (
    <>
      <Reveal
        direction="right"
        distance={60}
        duration={900}
        delay={300}
        threshold={0.1}
        className="flex w-full flex-col items-center xl:w-auto xl:items-end [&>div]:w-full"
      >
        {/* Controls */}
        <div className="mb-3 flex items-center justify-center gap-5 sm:mb-5 sm:gap-6 xl:mb-6 xl:w-full xl:min-w-[560px] xl:justify-between">
          <div className="flex items-end gap-2">
            <span className="font-['Fraunces',serif] text-2xl font-bold leading-none text-white sm:text-4xl xl:text-5xl">
              {pad(active)}
            </span>

            <span className="pb-0.5 text-[10px] font-semibold tracking-widest text-slate-300 sm:pb-1 sm:text-xs">
              / {pad(slides.length - 1)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={prev}
              aria-label="Previous slide"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/30 bg-white/10 text-white backdrop-blur-md transition-all duration-300 hover:bg-white hover:text-navy active:scale-95 sm:h-11 sm:w-11 xl:h-12 xl:w-12"
            >
              <ArrowIcon direction="left" />
            </button>

            <button
              type="button"
              onClick={next}
              aria-label="Next slide"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/30 bg-white/10 text-white backdrop-blur-md transition-all duration-300 hover:bg-white hover:text-navy active:scale-95 sm:h-11 sm:w-11 xl:h-12 xl:w-12"
            >
              <ArrowIcon />
            </button>
          </div>
        </div>

        {/* Carousel cards — edge-to-edge deck on phones (swipe to change) */}
        <div
          className="-mx-6 flex h-60 touch-pan-y items-end justify-center gap-2 overflow-hidden px-2 sm:mx-0 sm:h-56 sm:gap-3 sm:px-0 xl:h-[22rem]"
          onTouchStart={(event) => {
            touchStart.current = event.touches[0]?.clientX ?? null;
          }}
          onTouchEnd={(event) => {
            const start = touchStart.current;
            touchStart.current = null;
            if (start === null) return;
            const delta = (event.changedTouches[0]?.clientX ?? start) - start;
            if (Math.abs(delta) < 40) return;
            if (delta < 0) next();
            else prev();
          }}
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
                className={`group relative overflow-hidden rounded-xl border text-left transition-all duration-700 ease-out sm:rounded-2xl ${
                  on
                    ? "h-full w-[55%] border-white/80 shadow-2xl shadow-black/40 sm:w-52 xl:w-64"
                    : "h-[84%] w-[11%] border-white/20 opacity-80 hover:opacity-100 sm:w-24 xl:w-28"
                }`}
              >
                <img
                  src={s.thumbnail}
                  srcSet={s.thumbnailSrcSet}
                  sizes={s.thumbnailSizes}
                  width={s.thumbnailWidth}
                  height={s.thumbnailHeight}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                />

                <div className="absolute inset-0 bg-gradient-to-t from-navy/90 via-navy/20 to-transparent" />

                {/* Number */}
                <span className="absolute left-1.5 top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1 text-[9px] font-bold text-navy sm:left-3 sm:top-3 sm:h-7 sm:min-w-7 sm:px-1.5 sm:text-[11px]">
                  {pad(i)}
                </span>

                {/* Active card text */}
                <div
                  className={`absolute inset-x-0 bottom-0 p-2.5 transition-all duration-500 sm:p-4 ${
                    on
                      ? "translate-y-0 opacity-100 delay-300"
                      : "translate-y-3 opacity-0"
                  }`}
                >
                  <p className="text-[8px] font-semibold uppercase tracking-[0.16em] text-sky-300 sm:text-[10px]">
                    {s.stat.label}
                  </p>

                  <p className="mt-0.5 font-['Fraunces',serif] text-sm font-bold leading-tight text-white sm:mt-1 sm:text-lg">
                    {s.stat.value}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </Reveal>
    </>
  );
}
