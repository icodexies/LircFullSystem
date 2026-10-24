// Tablet and laptop (640–1279px): the reference layout — centred text with
// the expanding card strip below it and the arrows above the strip.
import { LeftSide, RightSide } from "./HeroSection.jsx";

export default function HeroStandard({
  slides,
  active,
  next,
  prev,
  setActive,
  BTN_SLANT,
}) {
  return (
    <div className="relative z-10 mx-auto flex min-h-svh w-full max-w-[1320px] flex-col justify-center gap-8 px-6 pb-8 pt-28">
      <LeftSide slides={slides} active={active} BTN_SLANT={BTN_SLANT} />
      <RightSide
        slides={slides}
        active={active}
        next={next}
        prev={prev}
        setActive={setActive}
      />
    </div>
  );
}
