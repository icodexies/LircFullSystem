import Reveal from "../ui/Reveal.jsx";
import { useDigitalSources } from "../../hooks/home/useDigitalSources.js";
import { ACCESS_FORM_URL } from "../../data/home/digitalSources.js";

// How far (px) the cards behind the selected one are pushed up / down.
const STEP = 56;

/* -------------------------------------------------------------------------- */
/*                                Small pieces                                */
/* -------------------------------------------------------------------------- */

function Icon({ d, className = "h-4 w-4", strokeWidth = 2 }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

const PATHS = {
  up: "M6 15l6-6l6 6",
  down: "M6 9l6 6l6-6",
  info: "M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0 M12 9h.01 M11 12h1v4h1",
};

/* -------------------------------------------------------------------------- */
/*                                Left: content                               */
/* -------------------------------------------------------------------------- */

function InfoPanel({ source }) {
  return (
    // min height keeps the layout steady when descriptions differ in length
    <div className="min-h-[17rem]" aria-live="polite">
      {/* key remounts Reveal so the text animates in for every selected source */}
      <Reveal key={source.id} direction="blur" duration={500}>
        <h3 className="font-[Fraunces] text-2xl text-white sm:text-3xl">{source.name}</h3>
        <p className="mt-1 text-sm text-white/60">{source.tagline}</p>

        <p className="mt-5 max-w-md text-sm leading-relaxed text-white/75">{source.description}</p>

        <ul className="mt-5 flex flex-wrap gap-2">
          {source.highlights.map((h) => (
            <li key={h} className="rounded-full border border-white/25 px-2.5 py-0.5 text-xs text-white/80">
              {h}
            </li>
          ))}
        </ul>

        <a
          href={source.url || undefined}
          aria-disabled={!source.url}
          title={!source.url ? "Access link is not available yet" : undefined}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-7 inline-flex w-fit rounded-full bg-white px-5 py-2 text-sm font-semibold text-navy transition hover:bg-[#F0EDFA] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          Visit {source.name}
        </a>
        {!source.url && <p className="mt-2 text-xs text-white/60" role="status">Access link is not available yet.</p>}
      </Reveal>
    </div>
  );
}

// Applies to all three sources, so it stays the same when the selection changes.
function AccessNotice() {
  return (
    <div className="flex max-w-md gap-4 rounded-2xl border border-white/15 bg-white/5 p-4 sm:p-5">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white text-navy">
        <Icon d={PATHS.info} className="h-5 w-5" />
      </span>

      <div>
        <p className="text-sm font-semibold text-white">Request access first</p>
        <p className="mt-1 text-sm leading-relaxed text-white/70">
          All three resources need admin approval. Fill up the Google Form, then wait for the admin to
          grant your access before you open any of them.
        </p>
        <a
          href={ACCESS_FORM_URL || undefined}
          aria-disabled={!ACCESS_FORM_URL}
          title={!ACCESS_FORM_URL ? "The access request form is not available yet" : undefined}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex rounded-full border border-white/40 px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-white hover:text-navy focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          Fill up the Google Form
        </a>
        {!ACCESS_FORM_URL && <p className="mt-2 text-xs text-white/60" role="status">The access request form is not available yet.</p>}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                         Right: vertical card carousel                      */
/* -------------------------------------------------------------------------- */

// The image area has a fixed size so the stack stays aligned. Whatever the
// image's size or shape, it is scaled to fit inside (object-contain), never
// cropped or stretched.
function SourceImage({ source, compact = false }) {
  if (source.image) {
    return (
      <img
        src={source.image}
        width={source.imageWidth}
        height={source.imageHeight}
        alt={source.name}
        loading="lazy"
        decoding="async"
        className="absolute inset-0 m-auto max-h-full max-w-full object-contain"
      />
    );
  }

  return (
    <span
      className={`absolute inset-0 grid place-items-center text-center font-[Fraunces] font-semibold text-ink ${
        compact ? "text-sm" : "text-2xl"
      }`}
    >
      {source.name}
    </span>
  );
}

// Small screens only: a compact row of the sources that sits right above the
// description, so tapping one updates the text directly below it.
function SourcePicker({ sources, activeIndex, onSelect }) {
  return (
    <div role="group" aria-label="Digital sources" className="mt-6 grid grid-cols-3 gap-2 sm:gap-3 lg:hidden">
      {sources.map((source, i) => {
        const isActive = i === activeIndex;

        return (
          <Reveal key={source.id} direction="zoomUp" distance={24} duration={600} delay={i * 100}>
            <button
              type="button"
              onClick={() => onSelect(source.id)}
              aria-label={`Select ${source.name}`}
              aria-current={isActive}
              className={`flex h-24 w-full flex-col rounded-xl bg-surface p-2 text-left shadow-lg shadow-black/30 transition duration-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:h-28 ${
                isActive
                  ? "opacity-100 ring-2 ring-white ring-offset-2 ring-offset-navy"
                  : "opacity-60 hover:opacity-100"
              }`}
            >
              <div className="relative min-h-0 flex-1">
                <SourceImage source={source} compact />
              </div>
              <span className="mt-1 truncate border-t border-slate-200 pt-1 text-center text-[10px] font-semibold text-ink sm:text-xs">
                {source.name}
              </span>
            </button>
          </Reveal>
        );
      })}
    </div>
  );
}

// Built for 3 cards: one in front, one peeking above, one peeking below.
// Cards are wider than the visible area, so their right side runs off the
// screen edge. The extra right padding keeps the content inside what you see.
// Large screens only (small screens use SourcePicker above).
function SourceStack({ sources, activeIndex, onSelect }) {
  const n = sources.length;

  return (
    <div role="group" aria-label="Digital sources" className="relative h-[26rem] w-full sm:h-[30rem]">
      {sources.map((source, i) => {
        // -1 = above, 0 = selected, 1 = below
        const offset = n === 1 ? 0 : ((i - activeIndex + n + 1) % n) - 1;
        const isActive = offset === 0;

        return (
          // Each card gets its own scroll reveal, staggered from the right
          <Reveal
            key={source.id}
            direction="zoomLeft"
            distance={140}
            duration={900}
            delay={i * 150}
            className={`absolute left-0 top-1/2 h-60 w-[calc(100%+6rem)] -translate-y-1/2 sm:h-72 ${
              isActive ? "z-20" : "z-10"
            }`}
          >
            <button
              type="button"
              onClick={() => onSelect(source.id)}
              aria-label={`Select ${source.name}`}
              aria-current={isActive}
              style={{
                transform: `translateY(${offset * STEP}px) scale(${isActive ? 1 : 0.92})`,
              }}
              className={`group flex h-60 w-full flex-col rounded-2xl bg-surface py-6 pl-6 pr-[7.5rem] text-left shadow-[0_24px_50px_-12px_rgba(0,0,0,0.55)] transition-[transform,opacity,box-shadow] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white motion-reduce:transition-none sm:h-72 ${
                isActive
                  ? "cursor-default opacity-100"
                  : "cursor-pointer opacity-60 hover:opacity-100 hover:ring-2 hover:ring-white/70"
              }`}
            >
              <div className="relative min-h-0 flex-1">
                <SourceImage source={source} />
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-3">
                <span className="font-[Fraunces] text-sm text-ink">{source.name}</span>

                {isActive ? (
                  <span className="flex items-center gap-1.5 text-xs text-slate-500">
                    <span className="h-1.5 w-1.5 rounded-full bg-navy" />
                    Selected
                  </span>
                ) : (
                  <span className="grid h-7 w-7 place-items-center rounded-full border border-slate-300 text-ink transition group-hover:border-navy group-hover:bg-navy group-hover:text-white">
                    <Icon d={offset < 0 ? PATHS.up : PATHS.down} />
                  </span>
                )}
              </div>
            </button>
          </Reveal>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                         Background: flat vector art                        */
/* -------------------------------------------------------------------------- */

// A row of book spines of different sizes, built . Reads as a shelf
// skyline along the bottom of the section.
const SHELF_BASE = 154;
const SPINES = (() => {
  const widths = [34, 22, 40, 28, 46, 24, 36, 30, 44, 26, 38, 32, 42];
  const heights = [92, 130, 70, 112, 84, 148, 100, 64, 126, 90, 140, 76, 108];
  const shades = ["#111a3d", "#15204a", "#1a2759", "#1f2f6b"];
  const spines = [];
  let x = -10;
  let i = 0;

  while (x < 1450) {
    const w = widths[i % widths.length];
    const h = heights[(i * 5 + 2) % heights.length];
    spines.push({ x, w, h, fill: shades[i % shades.length], banded: i % 3 === 0 });
    x += w + 3;
    i += 1;
  }

  return spines;
})();

function BookShelf() {
  return (
    <svg
      viewBox="0 0 1440 160"
      preserveAspectRatio="xMidYMax slice"
      className="absolute inset-x-0 bottom-0 h-32 w-full lg:h-40"
    >
      {SPINES.map((s, i) => (
        <g key={i}>
          <rect x={s.x} y={SHELF_BASE - s.h} width={s.w} height={s.h} rx="2" fill={s.fill} />
          {s.banded && (
            <>
              <rect x={s.x} y={SHELF_BASE - s.h + 14} width={s.w} height="4" fill="#fff" fillOpacity="0.1" />
              <rect x={s.x} y={SHELF_BASE - s.h + 24} width={s.w} height="2" fill="#fff" fillOpacity="0.1" />
            </>
          )}
        </g>
      ))}
      <rect x="0" y={SHELF_BASE} width="1440" height="6" fill="#1f2f6b" />
    </svg>
  );
}

function Rings() {
  return (
    <svg viewBox="0 0 300 300" className="absolute left-0 top-0 h-56 w-56 lg:h-80 lg:w-80">
      <circle cx="0" cy="0" r="120" fill="#121b45" />
      {[160, 205, 250].map((r) => (
        <circle key={r} cx="0" cy="0" r={r} fill="none" stroke="#fff" strokeOpacity="0.08" strokeWidth="2" />
      ))}
    </svg>
  );
}

function BackgroundArt() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      <style>{`
        @keyframes ds-float {
          0%, 100% { transform: translateY(0) rotate(-4deg); }
          50% { transform: translateY(-14px) rotate(4deg); }
        }
        @keyframes ds-drift {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(40px, -30px); }
        }
      `}</style>

      {/* soft light behind the cards */}
      <div className="absolute inset-0 bg-[radial-gradient(60rem_40rem_at_85%_50%,#16224d,transparent_70%)]" />

      {/* faint grid that fades out toward the edges */}
      <div className="absolute inset-0 opacity-[0.07] [background-image:linear-gradient(#fff_1px,transparent_1px),linear-gradient(90deg,#fff_1px,transparent_1px)] [background-size:48px_48px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]" />

      {/* slow drifting glows */}
      <div className="absolute -left-24 bottom-32 h-72 w-72 rounded-full bg-[#1f2f6b]/40 blur-3xl animate-[ds-drift_14s_ease-in-out_infinite] motion-reduce:animate-none" />
      <div className="absolute -right-16 top-24 h-80 w-80 rounded-full bg-[#2a3d86]/25 blur-3xl animate-[ds-drift_18s_ease-in-out_infinite] [animation-delay:-6s] motion-reduce:animate-none" />

      <Rings />

      <BookShelf />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                   Section                                  */
/* -------------------------------------------------------------------------- */

function DigitalSources() {
  const d = useDigitalSources();

  return (
    <section
      aria-labelledby="digital-sources-title"
      className="relative w-full overflow-hidden bg-navy pb-32 pt-20 lg:py-36"
    >
      <BackgroundArt />

      {/* Left: title, (small screens: source picker), selected source and access notice */}
      <div className="relative mx-auto max-w-7xl px-6 lg:px-10">
        <div className="lg:grid lg:min-h-[34rem] lg:grid-cols-2 lg:items-center lg:gap-16">
          <div>
            <Reveal>
              <h2 id="digital-sources-title" className="font-[Fraunces] text-3xl text-white sm:text-4xl">
                Digital sources
              </h2>
              <p className="mt-2 max-w-md text-sm text-white/60">
                Subscription-based digital resources you can read online through the library.
              </p>
            </Reveal>

            {/* Small screens: picker sits right above the description */}
            <SourcePicker sources={d.sources} activeIndex={d.activeIndex} onSelect={d.select} />

            <Reveal delay={150} className="mt-6 border-t border-white/10 pt-6 lg:mt-8 lg:pt-8">
              {d.active ? <InfoPanel source={d.active} /> : (
                <p className="text-sm text-white/75" role="status">No digital sources are available yet.</p>
              )}
            </Reveal>

            <Reveal delay={250} className="mt-8">
              <AccessNotice />
            </Reveal>
          </div>
        </div>
      </div>

      {/* Right (large screens only): vertical carousel. It starts at the middle of
          the page and runs off the right edge of the screen. */}
      <div className="relative hidden lg:absolute lg:inset-y-0 lg:left-1/2 lg:right-0 lg:ml-8 lg:flex lg:items-center">
        <div className="w-full">
          <SourceStack sources={d.sources} activeIndex={d.activeIndex} onSelect={d.select} />
        </div>
      </div>
    </section>
  );
}

export default DigitalSources;
