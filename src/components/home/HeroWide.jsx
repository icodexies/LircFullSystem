// Large screens (1280px+): split layout with a featured panel.
//
// Left column (~40%): label, headline, description, CTA, then the counter and
// arrows together, all flush to the same left edge. Right column (~55%): the
// active slide as a big featured panel, with a vertical thumbnail list
// 01–04 beside it and a progress bar under the active thumbnail.
import { Link } from "react-router-dom";
import Reveal from "../ui/Reveal.jsx";
import { ArrowIcon } from "./ArrowIcon.jsx";
import { HERO_AUTOPLAY_MS } from "../../hooks/home/useHero.js";

export default function HeroWide({
  slides,
  active,
  next,
  prev,
  setActive,
  BTN_SLANT,
  pad,
  paused,
}) {
  const slide = slides[active];

  return (
    <div className="relative z-10 mx-auto flex min-h-svh w-full max-w-[1360px] items-center px-10">
      <div className="flex w-full items-center gap-12 2xl:gap-16">
        {/* Left column — text, CTA, counter + arrows (all one left edge). */}
        <Reveal
          direction="left"
          distance={60}
          duration={900}
          delay={120}
          className="w-[40%] shrink-0 [&>div]:w-full"
        >
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5" aria-hidden="true">
              <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
              <span className="h-1.5 w-1.5 rounded-full bg-sky-400/40" />
              <span className="h-1.5 w-1.5 rounded-full bg-sky-400/20" />
            </span>
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-300">
              {slide.tag}
            </span>
          </div>

          <h1 className="mt-6 font-['Fraunces',serif] text-[4rem] font-bold leading-[1.04] tracking-tight text-white 2xl:text-[4.5rem]">
            {slide.title}
          </h1>

          <p className="mt-5 max-w-md text-base leading-relaxed text-slate-200">
            {slide.description}
          </p>

          <Link
            to={slide.to}
            className="mt-8 inline-flex items-center gap-2 bg-white px-8 py-4 text-base font-semibold text-navy transition-colors hover:bg-sky-400 active:scale-[0.99]"
            style={{ clipPath: BTN_SLANT }}
          >
            {slide.cta}
            <ArrowIcon />
          </Link>

          {/* Counter + arrows live under the text, on the same left edge. */}
          <div className="mt-10 flex items-center gap-6">
            <div className="flex items-end gap-2">
              <span className="font-['Fraunces',serif] text-4xl font-bold leading-none text-white">
                {pad(active)}
              </span>
              <span className="pb-1 text-xs font-semibold tracking-widest text-slate-300">
                / {pad(slides.length - 1)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={prev}
                aria-label="Previous slide"
                className="flex h-11 w-11 items-center justify-center rounded-full border border-white/30 bg-white/10 text-white backdrop-blur-md transition-all duration-300 hover:bg-white hover:text-navy active:scale-95"
              >
                <ArrowIcon direction="left" />
              </button>
              <button
                type="button"
                onClick={next}
                aria-label="Next slide"
                className="flex h-11 w-11 items-center justify-center rounded-full border border-white/30 bg-white/10 text-white backdrop-blur-md transition-all duration-300 hover:bg-white hover:text-navy active:scale-95"
              >
                <ArrowIcon />
              </button>
            </div>
          </div>
        </Reveal>

        {/* Right column — featured panel + vertical thumbnails. */}
        <Reveal
          direction="right"
          distance={60}
          duration={900}
          delay={260}
          className="min-w-0 flex-1"
        >
          <div className="flex gap-4">
            <div className="relative h-[clamp(420px,52vh,520px)] min-w-0 flex-1 overflow-hidden rounded-3xl border border-white/10">
              {slides.map((s, i) => (
                <img
                  key={s.id}
                  src={s.background}
                  srcSet={s.backgroundSrcSet}
                  sizes="55vw"
                  width={s.backgroundWidth ?? undefined}
                  height={s.backgroundHeight ?? undefined}
                  alt=""
                  aria-hidden="true"
                  loading={i === 0 ? "eager" : "lazy"}
                  decoding="async"
                  className={`absolute inset-0 h-full w-full object-cover object-center transition-opacity duration-700 ${
                    i === active ? "opacity-100" : "opacity-0"
                  }`}
                />
              ))}
              <div className="absolute inset-0 bg-gradient-to-t from-navy via-navy/25 to-transparent" />

              <span className="absolute right-5 top-5 flex h-9 min-w-9 items-center justify-center rounded-full bg-white px-2 text-xs font-bold text-navy">
                {pad(active)}
              </span>

              <div className="absolute inset-x-0 bottom-0 p-6">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-300">
                  {slide.tag}
                </p>
                <h2 className="mt-1 font-['Fraunces',serif] text-2xl font-bold tracking-tight text-white">
                  {slide.title}
                </h2>
                <p className="mt-2 flex flex-wrap items-baseline gap-x-2 text-sm text-white/80">
                  <span className="font-['Fraunces',serif] text-2xl font-bold text-white">
                    {slide.stat.value}
                  </span>
                  {slide.stat.label}
                </p>
              </div>
            </div>

            {/* Vertical thumbnail rail with the progress bar under the active. */}
            <div className="flex w-24 shrink-0 flex-col gap-3">
              {slides.map((s, i) => {
                const on = i === active;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setActive(i)}
                    aria-label={s.title}
                    aria-current={on}
                    className="group block w-full text-left"
                  >
                    <span
                      className={`relative block h-[84px] overflow-hidden rounded-xl border transition-colors ${
                        on
                          ? "border-sky-400"
                          : "border-white/20 group-hover:border-white/50"
                      }`}
                    >
                      <img
                        src={s.thumbnail}
                        srcSet={s.thumbnailSrcSet}
                        sizes="96px"
                        alt=""
                        aria-hidden="true"
                        loading="lazy"
                        decoding="async"
                        className="absolute inset-0 h-full w-full object-cover object-center"
                      />
                      <span className="absolute inset-0 bg-navy/30" />
                      <span className="absolute left-1.5 top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1 text-[9px] font-bold text-navy">
                        {pad(i)}
                      </span>
                    </span>
                    <span
                      aria-hidden="true"
                      className="mt-1 block h-1 overflow-hidden rounded-full bg-white/10"
                    >
                      {on ? (
                        paused ? (
                          <span className="block h-full w-full rounded-full bg-sky-400" />
                        ) : (
                          <span
                            className="block h-full w-full origin-left rounded-full bg-sky-400"
                            style={{
                              animation: `hero-progress ${HERO_AUTOPLAY_MS}ms linear both`,
                            }}
                          />
                        )
                      ) : null}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </Reveal>
      </div>
    </div>
  );
}
