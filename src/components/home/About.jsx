import Reveal from "../ui/Reveal.jsx";
import { ABOUT, ABOUT_IMAGES } from "../../data/home/about.js";

// Gives photos a blue monochrome look. Set to false to show them in full color.
const TINT_PHOTOS = true;

// The arch is the one size everything else follows: its top half rises into the
// navy band, so the band's bottom padding and the arch's negative margin both
// come from this value.
const ARCH_WIDTH = "min(88vw, 34rem)";

/* -------------------------------------------------------------------------- */
/*                                Small pieces                                */
/* -------------------------------------------------------------------------- */

function ImageIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M15 8h.01 M3 6a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v12a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3v-12z M3 16l5 -5c.928 -.893 2.072 -.893 3 0l5 5 M14 14l1 -1c.928 -.893 2.072 -.893 3 0l3 3" />
    </svg>
  );
}

// Photo container. Shape and size come from className. It shows a dashed
// placeholder until `image.src` is filled in (see data/about.js).
function ImageSlot({ image, ratio = "1 / 1", fit = "cover", zoom = 1, bg = "bg-slate-100", className = "" }) {
  return (
    <div
      style={{ aspectRatio: ratio }}
      className={`relative w-full overflow-hidden ${bg} ${className}`}
    >
      {image.src ? (
        <>
          <img
            src={image.src}
            srcSet={image.srcSet}
            sizes={image.sizes}
            width={image.width}
            height={image.height}
            alt={image.alt}
            loading="lazy"
            decoding="async"
            style={{
              objectPosition: image.position || "center",
              transform: zoom !== 1 ? `scale(${zoom})` : undefined,
              transformOrigin: "center 65%",
            }}
            className={`absolute inset-0 h-full w-full ${fit === "contain" ? "object-contain" : "object-cover"} ${TINT_PHOTOS ? "grayscale contrast-110" : ""}`}
          />
          {TINT_PHOTOS && (
            <div aria-hidden="true" className="absolute inset-0 bg-[#2a3d86] opacity-70 mix-blend-color" />
          )}
        </>
      ) : (
        <div
          role="img"
          aria-label={`Photo placeholder: ${image.label}`}
          className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-[inherit] border-2 border-dashed border-navy/30 p-4 text-center text-ink/60"
        >
          <ImageIcon />
          <span className="text-sm font-medium">{image.label}</span>
          <span className="text-xs">{image.hint}</span>
        </div>
      )}
    </div>
  );
}

function Flourish() {
  return (
    <svg
      viewBox="0 0 240 32"
      className="mx-auto h-6 w-48 text-ink sm:w-56"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      aria-hidden="true"
    >
      {/* left half */}
      <g>
        <path d="M102 16H74" />
        <path d="M74 16C63 16 57 8 62 4C67 0 74 4 71 9" />
        <path d="M60 19C52 24 43 22 41 16" />
        <path d="M38 16H8" />
        <circle cx="4" cy="16" r="1.8" fill="currentColor" stroke="none" />
      </g>

      {/* right half, mirrored */}
      <g transform="translate(240 0) scale(-1 1)">
        <path d="M102 16H74" />
        <path d="M74 16C63 16 57 8 62 4C67 0 74 4 71 9" />
        <path d="M60 19C52 24 43 22 41 16" />
        <path d="M38 16H8" />
        <circle cx="4" cy="16" r="1.8" fill="currentColor" stroke="none" />
      </g>

      {/* center diamond */}
      <path d="M120 6L129 16L120 26L111 16Z" fill="currentColor" stroke="none" />
      <circle cx="106" cy="16" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="134" cy="16" r="1.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

/* -------------------------------------------------------------------------- */
/*                       Top band: title and skyline art                      */
/* -------------------------------------------------------------------------- */

// Simple building shapes for the left half. The right half is a mirror of it.
const BUILDINGS = [
  { x: 0, w: 90, h: 70, t: "flat" },
  { x: 96, w: 56, h: 104, t: "tower" },
  { x: 158, w: 110, h: 62, t: "gable" },
  { x: 274, w: 84, h: 88, t: "flat" },
  { x: 364, w: 96, h: 112, t: "dome" },
  { x: 466, w: 70, h: 58, t: "flat" },
  { x: 542, w: 100, h: 76, t: "gable" },
  { x: 648, w: 76, h: 96, t: "tower" },
];

const SKYLINE = [...BUILDINGS, ...BUILDINGS.map((b) => ({ ...b, x: 1440 - b.x - b.w }))];

function Skyline() {
  const H = 140;

  return (
    <svg
      viewBox={`0 0 1440 ${H}`}
      preserveAspectRatio="xMidYMax slice"
      className="absolute inset-x-0 bottom-0 h-28 w-full sm:h-36"
      fill="#141e4d"
      aria-hidden="true"
    >
      {SKYLINE.map((b, i) => {
        const y = H - b.h;
        const cx = b.x + b.w / 2;

        if (b.t === "gable") {
          return (
            <g key={i}>
              <rect x={b.x} y={y + 18} width={b.w} height={b.h - 18} />
              <polygon points={`${b.x - 4},${y + 18} ${cx},${y} ${b.x + b.w + 4},${y + 18}`} />
            </g>
          );
        }

        if (b.t === "tower") {
          return (
            <g key={i}>
              <rect x={b.x + b.w * 0.25} y={y + 16} width={b.w * 0.5} height={b.h - 16} />
              <polygon points={`${b.x + b.w * 0.2},${y + 16} ${cx},${y} ${b.x + b.w * 0.8},${y + 16}`} />
            </g>
          );
        }

        if (b.t === "dome") {
          const top = y + b.w * 0.35;
          return (
            <g key={i}>
              <rect x={b.x} y={top} width={b.w} height={H - top} />
              <path d={`M${cx - b.w * 0.3} ${top}a${b.w * 0.3} ${b.w * 0.3} 0 0 1 ${b.w * 0.6} 0z`} />
            </g>
          );
        }

        return <rect key={i} x={b.x} y={y} width={b.w} height={b.h} />;
      })}
    </svg>
  );
}

/* -------------------------------------------------------------------------- */
/*                                   Section                                  */
/* -------------------------------------------------------------------------- */

function About() {
  const { title, historyTitle, paragraphs, closing } = ABOUT;

  return (
    <section aria-labelledby="about-title" className="relative w-full overflow-hidden bg-surface">
      {/* Navy band with the big title */}
      <div
        className="relative bg-navy pt-16 text-center sm:pt-20"
        style={{ paddingBottom: `calc(${ARCH_WIDTH} / 2 + 2rem)` }}
      >
        <Skyline />

        <Reveal direction="down" duration={900} >
          <h2
            id="about-title"
            className="relative font-[Fraunces] text-[clamp(0.5rem,11vw,8rem)] font-light leading-none tracking-tight text-white"
          >
            <span className="mr-1 text-[1.2em] font-light italic">{title[0]}</span>{title.slice(1)}
          </h2>
        </Reveal>
      </div>

      {/* Arch photo: its top half sits inside the band. A square photo fits well:
          the arch only trims its top corners. */}
      <div className="relative mx-auto" style={{ width: ARCH_WIDTH, marginTop: `calc(${ARCH_WIDTH} / -2)` }}>
        <Reveal direction="zoomUp" distance={48} duration={900} delay={150} >
          <div className="relative">
            {/* outline rings that circle the top of the arch */}
            <div
              aria-hidden="true"
              className="absolute -inset-x-5 -top-5 bottom-0 rounded-t-full border-2 border-b-0 border-white/30"
            />
            <div
              aria-hidden="true"
              className="absolute -inset-x-10 -top-10 bottom-0 hidden rounded-t-full border border-b-0 border-white/15 sm:block"
            />

            {/* thick white frame, then the photo in the same arch shape */}
            <div className="rounded-t-full bg-surface p-4 sm:p-5">
              <ImageSlot
                image={ABOUT_IMAGES.arch}
                ratio="1 / 1"
                fit="contain"
                zoom={1.5}
                bg="bg-surface"
                className="rounded-b-2xl rounded-t-full"
                />
            </div>
          </div>
        </Reveal>
      </div>

      {/* History: narrow, centered block with wide empty space on both sides */}
      <div className="mx-auto max-w-4xl px-8 sm:px-14 lg:pb-15">
        <Reveal  className="text-center">
          <h3 className="inline-flex items-center gap-3 font-[Fraunces] text-4xl text-ink sm:text-5xl">
            <span aria-hidden="true" className="text-5xl font-light sm:text-6xl">{"{"}</span>
            {historyTitle}
            <span aria-hidden="true" className="text-5xl font-light sm:text-6xl">{"}"}</span>
          </h3>
        </Reveal>

        {/* 3 columns: stacked images | paragraph | big photo that overlaps the paragraph column */}
        <div className="mt-12 grid gap-8 md:grid-cols-[1fr_4.2fr] md:items-start md:gap-x-6">
            {/* Left: small photo + book drawing */}
            <Reveal direction="right" distance={48} delay={100} className="order-2 mx-auto w-full max-w-sm md:order-1 md:max-w-none">
                <ImageSlot image={ABOUT_IMAGES.history} ratio="6 / 5" className="rounded-lg" />
                <div className="mt-8 hidden md:block">
                <ImageSlot image={ABOUT_IMAGES.history2} ratio="6 / 5" className="rounded-lg" />
                </div>
            </Reveal>

            {/* Right: paragraphs with the photo floated to the right, so the text wraps around it */}
            <Reveal delay={150}  className="order-1 md:order-2">
                <div className="flow-root space-y-4 text-sm leading-relaxed text-slate-600">
                {/* first paragraph: full width */}
                <p>{paragraphs[0]}</p>

                {/* photo: floats right, the text below wraps around it */}
                <div className="mx-auto w-full max-w-sm md:float-right md:mb-2 md:ml-6 md:mt-2 md:w-[48%] md:max-w-none">
                    <ImageSlot
                    image={ABOUT_IMAGES.group}
                    ratio="13 / 12"
                    className="rounded-xl border-4 border-white shadow-xl"
                    />
                </div>

                {/* remaining paragraphs: wrap to the left of the photo */}
                {paragraphs.slice(1).map((p) => (
                    <p key={p}>{p}</p>
                ))}
                </div>
            </Reveal>
            </div>

        {/* Closing statement: text inside a tilted ellipse outline */}
        <Reveal direction="zoom" duration={900} >
        <div className="group relative mx-auto w-full max-w-lg py-30">
            <div className="relative mx-auto aspect-[3/2] w-full">
            {/* 1. soft shadow on the "floor" under the disc */}
            <div
                aria-hidden="true"
                className="absolute inset-x-8 -bottom-6 h-10 rounded-[50%] bg-navy/25 blur-2xl"
            />

            {/* 2. big thin ring, tilted one way */}
            <div
                aria-hidden="true"
                className="absolute inset-0 scale-[1.12] -rotate-[8deg] rounded-[50%] border border-navy/20 transition-transform duration-700 group-hover:-rotate-[11deg]"
            />

            {/* 3. second ring, tilted the other way, so the two cross like the reference */}
            <div
                aria-hidden="true"
                className="absolute inset-0 scale-[1.06] rotate-[5deg] rounded-[50%] border border-navy/15 transition-transform duration-700 group-hover:rotate-[8deg]"
            />

            {/* 4. the raised disc: gradient, highlight on top, shading at the bottom */}
            <div
                aria-hidden="true"
                className="absolute inset-0 -rotate-[4deg] rounded-[50%] transition-transform duration-700 group-hover:-rotate-[2deg] group-hover:scale-[1.02]"
                style={{
                background:
                    "radial-gradient(120% 120% at 30% 15%, #ffffff 0%, #f1f4fb 45%, #dde3f3 100%)",
                boxShadow: [
                    "0 40px 60px -28px rgba(11,19,48,0.45)",
                    "0 14px 24px -12px rgba(11,19,48,0.25)",
                    "inset 0 3px 2px rgba(255,255,255,0.95)",
                    "inset 0 -18px 30px rgba(11,19,48,0.10)",
                    "inset 0 0 0 1px rgba(11,19,48,0.08)",
                ].join(", "),
                }}
            />

            {/* 5. thin inner gold-ish line for a premium edge */}
            <div
                aria-hidden="true"
                className="absolute inset-3 -rotate-[4deg] rounded-[50%] border border-navy/10 sm:inset-4"
            />

            {/* 6. the text, embossed */}
            <div className="relative flex h-full flex-col items-center justify-center px-10 text-center">
                {closing.lines.map((line) => (
                <p
                    key={line}
                    className="font-[Fraunces] text-3xl leading-[1.05] tracking-tight text-ink sm:text-[2.6rem]"
                    style={{ textShadow: "0 1px 0 #fff, 0 3px 6px rgba(11,19,48,0.18)" }}
                >
                    {line}
                </p>
                ))}

                <div className="my-2 w-full sm:my-3">
                <Flourish />
                </div>

                <p
                className="bg-gradient-to-b from-[#2a3d86] to-navy bg-clip-text font-[Fraunces] text-5xl font-light italic leading-none text-transparent sm:text-6xl"
                style={{ filter: "drop-shadow(0 3px 4px rgba(11,19,48,0.22))" }}
                >
                {closing.script}
                </p>
            </div>
            </div>
        </div>
        </Reveal>
      </div>
    </section>
  );
}

export default About;
