import { HeroBG } from "./HeroSection.jsx";
import HeroMobile from "./HeroMobile.jsx";
import HeroStandard from "./HeroStandard.jsx";
import HeroWide from "./HeroWide.jsx";
import { useHero } from "../../hooks/home/useHero.js";

const pad = (index) => String(index + 1).padStart(2, "0");

// One hero, three layouts, one shared state:
//   phones        → swipe carousel with dots
//   tablet/laptop → centred text + expanding card strip (the reference)
//   large screens → split layout: text + featured panel + thumbnail rail
// The layouts are separate presentational components shown with Tailwind
// breakpoints; the active slide, autoplay and the pause state are shared, so
// resizing keeps everything in sync.
export default function Hero() {
  const {
    heroRef,
    active,
    paused,
    next,
    prev,
    setActive,
    BTN_SLANT,
    setPaused,
    reducedMotion,
    slides,
  } = useHero();

  const shared = {
    slides,
    active,
    next,
    prev,
    setActive,
    BTN_SLANT,
    pad,
    reducedMotion,
    paused,
  };

  return (
    <section
      ref={heroRef}
      className="relative -mt-24 min-h-svh w-full overflow-hidden"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={(event) =>
        setPaused(event.currentTarget.contains(document.activeElement))
      }
      onFocus={() => setPaused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget))
          setPaused(event.currentTarget.matches(":hover"));
      }}
      onTouchStart={() => setPaused(true)}
      onTouchEnd={() => setPaused(false)}
      onTouchCancel={() => setPaused(false)}
    >
      <HeroBG slides={slides} active={active} />

      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-r from-navy/90 via-navy/50 to-navy/20"
      />

      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-t from-navy/80 via-transparent to-navy/30"
      />

      <div className="sm:hidden">
        <HeroMobile {...shared} />
      </div>
      <div className="hidden sm:block xl:hidden">
        <HeroStandard {...shared} />
      </div>
      <div className="hidden xl:block">
        <HeroWide {...shared} />
      </div>
    </section>
  );
}
