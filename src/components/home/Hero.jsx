import { HeroBG, LeftSide, RightSide } from "./HeroSection.jsx";
import { useHero } from "../../hooks/home/useHero.js";

const pad = (index) => String(index + 1).padStart(2, "0");

// Keep carousel timer updates inside this section, away from the rest of Home.
export default function Hero() {
  const {
    heroRef,
    active,
    next,
    prev,
    setActive,
    BTN_SLANT,
    setPaused,
    slides
  } = useHero();

  return (
    <section
      ref={heroRef}
      className="relative -mt-24 min-h-screen w-full overflow-hidden"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={(event) => setPaused(event.currentTarget.contains(document.activeElement))}
      onFocus={() => setPaused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setPaused(event.currentTarget.matches(":hover"));
      }}
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

      <div className="relative z-10 mx-auto flex min-h-screen max-w-7xl flex-col justify-between gap-10 px-6 pb-10 lg:flex-row lg:items-end lg:gap-8 lg:px-10 lg:pb-14">
        <LeftSide
          slides={slides}
          active={active}
          BTN_SLANT={BTN_SLANT}
        />

        <RightSide
          slides={slides}
          active={active}
          next={next}
          prev={prev}
          setActive={setActive}
          pad={pad}
        />
      </div>
    </section>
  );
}
